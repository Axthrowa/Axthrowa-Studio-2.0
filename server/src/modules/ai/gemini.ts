import { GoogleGenAI } from '@google/genai';
import { db } from '../../db/index.js';

class GeminiCoHost {
  private aiInstance: GoogleGenAI | null = null;
  private currentKey: string = '';
  private conversationHistory: Array<{ role: string; text: string }> = [];

  private initClient(): GoogleGenAI | null {
    const keyRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_api_key'").get() as { value: string } | undefined;
    const apiKey = keyRow?.value || process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      this.aiInstance = null;
      this.currentKey = '';
      return null;
    }

    if (this.aiInstance && this.currentKey === apiKey) {
      return this.aiInstance;
    }

    try {
      this.aiInstance = new GoogleGenAI({ apiKey });
      this.currentKey = apiKey;
      return this.aiInstance;
    } catch (err) {
      console.error('Failed to initialize Gemini AI client:', err);
      return null;
    }
  }

  /**
   * Çalışan model kimliğini bul ve hatırla.
   *
   * Model adı koda gömülüydü (`gemini-2.5-flash`, yedek `gemini-2.0-flash`).
   * Google bu modelleri YENİ hesaplara kapattı: anahtar geçerli olsa bile
   * çağrı 404 "no longer available to new users" dönüyor, iki deneme de
   * düşünce kod sabit bir cümle veriyordu — "hep aynı yanıtı veriyor"
   * şikâyeti buydu. Artık aday listesi sırayla denenir, ilk çalışan model
   * saklanır; o da kapanırsa arama yeniden yapılır.
   */
  private workingModel: string = '';

  private static readonly MODEL_CANDIDATES = [
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-pro-latest',
  ];

  /** Model gerçekten çağrılabiliyor mu? (404/400 → aday elenir) */
  private async modelWorks(client: GoogleGenAI, model: string): Promise<boolean> {
    try {
      const r = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
      });
      return typeof r.text === 'string';
    } catch (err: any) {
      const msg = String(err?.message || err);
      // 503/429 geçici: modeli elemeyelim, sırada kalsın.
      if (/503|429|overload|quota|high demand/i.test(msg)) return false;
      return false;
    }
  }

  /** Kullanılacak model; yoksa aday listesini tarar. */
  async resolveModel(client: GoogleGenAI): Promise<string> {
    const override = (
      db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_model'").get() as { value: string } | undefined
    )?.value?.trim();
    if (override) return override;
    if (this.workingModel) return this.workingModel;

    for (const m of GeminiCoHost.MODEL_CANDIDATES) {
      if (await this.modelWorks(client, m)) {
        this.workingModel = m;
        console.log(`[Gemini] kullanılacak model: ${m}`);
        return m;
      }
    }
    // Hiçbiri doğrulanamadıysa ilk adayla dene; hata mesajı kullanıcıya gider.
    return GeminiCoHost.MODEL_CANDIDATES[0];
  }

  /** Model kapandıysa bir sonraki çağrıda yeniden aransın. */
  private forgetModel() {
    this.workingModel = '';
  }

  async ask(prompt: string, senderName: string = 'İzleyici'): Promise<string> {
    const enabledRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_enabled'").get() as { value: string } | undefined;
    if (enabledRow?.value === 'false') {
      return 'Yapay zeka asistanı şu an devre dışı.';
    }

    const client = this.initClient();
    if (!client) {
      return '⚠️ Gemini API anahtarı henüz girilmemiş. Lütfen StreamAxT panelinden bir API anahtarı ekleyin!';
    }

    const promptRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_prompt'").get() as { value: string } | undefined;
    const systemInstruction = promptRow?.value || 'Sen neşeli, esprili ve zeki bir canlı yayın botusun. Cevapların kısa, dinamik ve canlı yayın sohbetine uygun olsun (en fazla 2-3 cümle).';

    try {
      // Önceki mesajlar da gönderilir: asistan konuşmayı hatırlasın (geçmiş
      // tutuluyordu ama isteme HİÇ eklenmiyordu, her soru sıfırdan soruluyordu).
      const gecmis = this.conversationHistory
        .slice(-6)
        .map((h) => `${h.role}: ${h.text}`)
        .join('\n');
      const formattedPrompt = gecmis
        ? `[Önceki konuşma]\n${gecmis}\n\n${senderName} diyor ki: "${prompt}"`
        : `${senderName} diyor ki: "${prompt}"`;

      const model = await this.resolveModel(client);
      const response = await client.models.generateContent({
        model,
        contents: [
          { role: 'user', parts: [{ text: `[Yönerge: ${systemInstruction}]\n\n${formattedPrompt}` }] }
        ]
      });

      const reply = response.text?.trim() || 'Hmm, bir şey diyemedim!';

      // Keep recent history
      this.conversationHistory.push({ role: senderName, text: prompt });
      this.conversationHistory.push({ role: 'StreamAxT', text: reply });
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      return reply;
    } catch (error: any) {
      const msg = String(error?.message || error);
      console.error('Gemini AI error:', msg);
      // Model kapanmış olabilir: listeyi yeniden tara ve BİR kez daha dene.
      this.forgetModel();
      try {
        const model2 = await this.resolveModel(client);
        const fallbackResp = await client.models.generateContent({
          model: model2,
          contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${senderName}: ${prompt}` }] }]
        });
        return fallbackResp.text?.trim() || 'Anlaşılamadı.';
      } catch (fbError: any) {
        // Sabit cümle yerine GERÇEK sebep: kullanıcı ne yapacağını bilsin.
        const sebep = String(fbError?.message || fbError).slice(0, 200);
        if (/quota|429/i.test(sebep)) return '⚠️ Gemini kotası doldu (429). Google AI Studio’dan kullanım/faturalandırmayı kontrol et.';
        if (/API key|401|403|permission/i.test(sebep)) return '⚠️ Gemini API anahtarı reddedildi. Ayarlar → Gemini AI Asistan’dan anahtarı yenile.';
        if (/404|not found|no longer available/i.test(sebep)) return `⚠️ Gemini modeli bu hesaba kapalı: ${sebep}`;
        return `⚠️ Gemini’ye ulaşılamadı: ${sebep}`;
      }
    }
  }

  /**
   * Bir izleyicinin SON MESAJLARINI birlikte değerlendirip duygu durumu çıkarır.
   *
   * Eski uç yalnız sabit bir kelime listesine bakıyordu: kelime kaç kez geçerse
   * geçsin 1 sayılıyor, "bot" gibi masum sözcükler olumsuz kabul ediliyor ve
   * bağlam (alay mı, şaka mı, gerçek şikâyet mi) hiç görülmüyordu. Burada
   * mesajlar sırayla modele verilir ve kısa bir Türkçe değerlendirme istenir.
   *
   * Anahtar yoksa `null` döner; çağıran kelime tabanlı yönteme düşer.
   */
  async analyzeSentiment(
    username: string,
    messages: string[],
  ): Promise<{ sentiment: 'positive' | 'neutral' | 'negative'; score: number; summary: string } | null> {
    const client = this.initClient();
    if (!client || !messages.length) return null;

    const list = messages.map((m, i) => `${i + 1}. ${m}`).join('\n');
    const prompt =
      `Aşağıda "${username}" adlı izleyicinin bir canlı yayın sohbetindeki son mesajları ` +
      `eskiden yeniye sıralı olarak veriliyor. Mesajların BÜTÜNÜNE bakarak kişinin yayına ` +
      `karşı genel tutumunu değerlendir. Tek bir kelimeye değil, bağlama ve gidişata bak ` +
      `(şaka, alay, samimiyet, gerçek şikâyet ayrımını gözet).\n\n${list}\n\n` +
      `Yanıtı YALNIZ şu JSON biçiminde ver:\n` +
      `{"durum":"olumlu|notr|olumsuz","guven":0.0-1.0,"ozet":"en fazla 15 kelimelik Türkçe değerlendirme"}`;

    try {
      const model = await this.resolveModel(client);
      const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      const raw = response.text?.trim() || '';
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return null;
      const out = JSON.parse(m[0]);
      const map: Record<string, 'positive' | 'neutral' | 'negative'> = {
        olumlu: 'positive',
        notr: 'neutral',
        'nötr': 'neutral',
        olumsuz: 'negative',
      };
      const sentiment = map[String(out.durum || '').toLowerCase()] || 'neutral';
      const score = Math.max(0, Math.min(1, Number(out.guven) || 0.5));
      const summary = String(out.ozet || '').slice(0, 160);
      return { sentiment, score, summary };
    } catch (err) {
      console.warn('[Gemini] duygu analizi hatası:', (err as Error).message);
      return null;
    }
  }

  async evaluateToxicity(text: string): Promise<boolean> {
    const client = this.initClient();
    if (!client) return false;

    try {
      const model = await this.resolveModel(client);
      const resp = await client.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [{
            text: `Aşağıdaki canlı yayın mesajını analiz et. Mesaj açık bir nefret söylemi, ağır hakaret, ırkçılık veya taciz içeriyor mu? SADECE tek kelimeyle EVET veya HAYIR şeklinde cevap ver.\n\nMesaj: "${text}"`
          }]
        }]
      });
      const answer = resp.text?.trim().toUpperCase();
      return answer === 'EVET';
    } catch {
      return false;
    }
  }
}

export const geminiCoHost = new GeminiCoHost();
export default geminiCoHost;
