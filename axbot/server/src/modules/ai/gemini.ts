import { GoogleGenAI } from '@google/genai';
import { db } from '../../db/index.js';
import { seyrekUyar } from '../../core/logger.js';
import { anahtarSorunu } from './gemini-hata.js';
import { metinUret, saglayiciDurumu, seciliSaglayici, saglayiciAyari } from './saglayicilar.js';
import { istekHakkiAl } from './gunluk-sinir.js';

/**
 * Sozu verilen sure icinde bitmezse vazgec.
 *
 * Gerekce: kotasi dolan bir modelde SDK uzun sure bekleyebiliyor; ustune
 * `ask()` bir de yedek deneme yapinca panel 60 saniyeden fazla asili
 * kaliyordu. Kullanici "cevap vermiyor" diye goruyor.
 */
async function zamanAsimiyla<T>(is: Promise<T>, ms: number, etiket: string): Promise<T> {
  let sayac: NodeJS.Timeout;
  const alarm = new Promise<never>((_, red) => {
    sayac = setTimeout(() => red(new Error(`${etiket} ${ms} ms icinde yanit vermedi`)), ms);
  });
  try {
    return await Promise.race([is, alarm]);
  } finally {
    clearTimeout(sayac!);
  }
}

/** Tek bir uretim cagrisi icin ust sinir. */
const URETIM_ZAMAN_ASIMI = 25000;

/** "Güncel bilgi: internette ara" açık mı (haber, skor; Gemini'de Google Arama, Groq'ta gpt-oss browser_search) */
function webAramaAcik(): boolean {
  return (db.prepare("SELECT value FROM bot_settings WHERE key = 'ai_web_arama'").get() as { value?: string } | undefined)?.value === 'true';
}

/** B9: yayıncının bilgi bankası (SSS); yönergeye eklenir, en çok 4000 karakter */
export function bilgiBankasiYonergesi(metin: string | undefined): string {
  const t = (metin || '').trim().slice(0, 4000);
  return t ? `\n\nYayıncı ve yayın hakkında bilgi bankası (sorulursa buna dayanarak cevap ver; burada olmayan yayın bilgisini uydurma):\n${t}` : '';
}

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
  /**
   * Kotasi dolan modeller ve ne zamana kadar atlanacaklari.
   *
   * Ucretsiz katmanda 429 genellikle DAKIKALIK istek limitidir, kalici
   * degil. Modeli oturum boyunca elemek, bir dakika sonra yine
   * kullanilabilecek en iyi modeli kaybettiriyordu.
   */
  private kotasiDolan: Map<string, number> = new Map();

  /** Model su an atlanmali mi? Suresi gecen kayitlar temizlenir. */
  private kotaKapali(model: string): boolean {
    const bitis = this.kotasiDolan.get(model);
    if (bitis === undefined) return false;
    if (Date.now() >= bitis) {
      this.kotasiDolan.delete(model);
      return false;
    }
    return true;
  }

  /** Hesapta bulunan model listesi (5 dakika onbellekli). */
  private modelOnbellek: { liste: string[]; zaman: number } = { liste: [], zaman: 0 };
  /** Son model listeleme hatası (Google gövdesi) — anahtar sorununu açıklamak için */
  private sonListeHatasi = '';

  private static readonly MODEL_CANDIDATES = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-pro-latest',
  ];

  /**
   * Hesapta GERCEKTEN bulunan modelleri listeler.
   *
   * Eskiden her aday icin bir `generateContent` cagrisi yapiliyordu: yalniz
   * dogru modeli BULMAK icin 2-3 uretim istegi harcaniyordu ve ucretsiz kota
   * bu yuzden erken doluyordu. `models.list` uretim kotasi tuketmez.
   */
  private async listelenenModeller(apiKey: string): Promise<string[]> {
    // Her cozumlemede yeniden listelemek gereksiz ag trafigi ve `models.list`
    // icin de hiz siniri var.
    if (this.modelOnbellek.liste.length && Date.now() - this.modelOnbellek.zaman < 300000) {
      return this.modelOnbellek.liste;
    }
    try {
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(apiKey),
        { signal: AbortSignal.timeout(10000) }
      );
      if (!r.ok) {
        this.sonListeHatasi = `${r.status} ${(await r.text().catch(() => '')).slice(0, 2000)}`;
        return [];
      }
      this.sonListeHatasi = '';
      const j: any = await r.json();
      const liste = (j.models || [])
        .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m: any) => String(m.name || '').replace(/^models\//, ''))
        .filter(Boolean);
      if (liste.length) this.modelOnbellek = { liste, zaman: Date.now() };
      return liste;
    } catch (e) {
      this.sonListeHatasi = String((e as Error)?.message || e);
      return [];
    }
  }

  /** Cozulmus model diske yazilir: yeniden baslatmada arama tekrarlanmasin. */
  private modeliHatirla(model: string) {
    this.workingModel = model;
    try {
      db.prepare(
        "INSERT INTO bot_settings (key, value) VALUES ('gemini_model_resolved', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(model);
    } catch (e) {
      /* ayar yazılamadı — bellekte kalır, yeniden başlatmada model yeniden aranır */
      seyrekUyar('gemini:model-yaz', '[Gemini] Çözülen model adı kaydedilemedi', e, 300_000);
    }
  }

  /**
   * Kullanilacak model.
   *
   * Sira: elle secim > bu oturumda calisan > diske yazilan > hesapta bulunan
   * adaylardan ilki. Kotasi dolan modeller atlanir.
   */
  async resolveModel(client: GoogleGenAI, apiKey = this.currentKey): Promise<string> {
    const override = (
      db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_model'").get() as { value: string } | undefined
    )?.value?.trim();
    if (override) return override;

    if (this.workingModel && !this.kotaKapali(this.workingModel)) return this.workingModel;

    const kayitli = (
      db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_model_resolved'").get() as { value: string } | undefined
    )?.value?.trim();
    if (kayitli && !this.kotaKapali(kayitli)) {
      this.workingModel = kayitli;
      return kayitli;
    }

    const mevcut = new Set(await this.listelenenModeller(apiKey));
    if (mevcut.size) {
      for (const m of GeminiCoHost.MODEL_CANDIDATES) {
        if (mevcut.has(m) && !this.kotaKapali(m)) {
          this.modeliHatirla(m);
          console.log(`[Gemini] kullanılacak model: ${m}`);
          return m;
        }
      }
      // Aday listesinde yoksa hesapta bulunan ilk flash modeline dus
      const yedek = [...mevcut].find((m) => m.includes('flash') && !this.kotaKapali(m));
      if (yedek) {
        this.modeliHatirla(yedek);
        console.log(`[Gemini] aday listesi disindan model seçildi: ${yedek}`);
        return yedek;
      }
    }

    // Hepsi kapaliysa suresi EN ONCE dolacak olani sec — sabit ilk adaya
    // donmek, kotasi dolu oldugunu bildigimiz modeli tekrar denemek olurdu.
    const acik = GeminiCoHost.MODEL_CANDIDATES.find((m) => !this.kotaKapali(m));
    if (acik) return acik;
    const enYakin = [...this.kotasiDolan.entries()].sort((a, b) => a[1] - b[1])[0];
    return enYakin?.[0] || GeminiCoHost.MODEL_CANDIDATES[0];
  }

  /** Model kapandıysa bir sonraki çağrıda yeniden aransın. */
  private forgetModel() {
    this.workingModel = '';
    try {
      db.prepare("DELETE FROM bot_settings WHERE key = 'gemini_model_resolved'").run();
    } catch {
      /* onemli degil */
    }
  }

  /** 429 alan modeli BIR DAKIKA atla; sonra yeniden denenebilir. */
  private kotayiIsaretle(model: string) {
    if (model) this.kotasiDolan.set(model, Date.now() + 60000);
    this.workingModel = '';
  }

  /** Su an kullanilan model (panelde gostermek icin). */
  aktifModel(): string {
    const saglayici = seciliSaglayici();
    if (saglayici) return `${saglayiciAyari(saglayici).tanim.ad} · ${saglayiciAyari(saglayici).model}`;
    return (
      this.workingModel ||
      (db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_model_resolved'").get() as { value: string } | undefined)?.value ||
      ''
    );
  }

  /**
   * Baglanti durumu: anahtar var mi, gecerli mi, hangi modeller acik?
   * Uretim kotasi TUKETMEZ — yalniz `models.list` cagrilir.
   */
  async durum(): Promise<{
    hazir: boolean;
    anahtarVar: boolean;
    model: string;
    modeller: string[];
    kotasiDolan: string[];
    hata?: string;
  }> {
    const saglayici = seciliSaglayici();
    if (saglayici) return { ...(await saglayiciDurumu(saglayici)), kotasiDolan: [] };
    const keyRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_api_key'").get() as { value: string } | undefined;
    const apiKey = keyRow?.value || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      return { hazir: false, anahtarVar: false, model: '', modeller: [], kotasiDolan: [], hata: 'API anahtarı girilmemiş.' };
    }

    const modeller = await this.listelenenModeller(apiKey);
    if (!modeller.length) {
      return {
        hazir: false,
        anahtarVar: true,
        model: '',
        modeller: [],
        kotasiDolan: [...this.kotasiDolan.keys()].filter((m) => this.kotaKapali(m)),
        hata:
          anahtarSorunu(this.sonListeHatasi, apiKey) ||
          (this.sonListeHatasi ? `Google'a ulaşılamadı: ${this.sonListeHatasi.slice(0, 160)}` : "Google'a ulaşılamadı.")
      };
    }

    const client = this.initClient();
    const model = client ? await this.resolveModel(client, apiKey) : '';
    return { hazir: true, anahtarVar: true, model, modeller, kotasiDolan: [...this.kotasiDolan.keys()].filter((m) => this.kotaKapali(m)) };
  }

  /** Önceki mesajlar da gönderilir: asistan konuşmayı hatırlasın. */
  private istemHazirla(prompt: string, senderName: string): string {
    const gecmis = this.conversationHistory
      .slice(-6)
      .map((h) => `${h.role}: ${h.text}`)
      .join('\n');
    return gecmis
      ? `[Önceki konuşma]\n${gecmis}\n\n${senderName} diyor ki: "${prompt}"`
      : `${senderName} diyor ki: "${prompt}"`;
  }

  private gecmiseEkle(senderName: string, prompt: string, reply: string) {
    this.conversationHistory.push({ role: senderName, text: prompt });
    this.conversationHistory.push({ role: 'AxBoT', text: reply });
    if (this.conversationHistory.length > 10) this.conversationHistory = this.conversationHistory.slice(-10);
  }

  /** Duygu/zehirlilik gibi yardımcı istekler: seçili sağlayıcı varsa ona, yoksa Gemini'ye. */
  async yardimciUret(metin: string, ms: number, etiket: string): Promise<string | null> {
    if (!istekHakkiAl()) return null; // B9: günlük sınır doldu, çağıran yapay zekâsız yola düşer
    const saglayici = seciliSaglayici();
    if (saglayici) return metinUret(saglayici, 'Kısa ve yalnız istenen biçimde yanıt ver.', metin, ms);
    const client = this.initClient();
    if (!client) return null;
    const model = await this.resolveModel(client);
    const r = await zamanAsimiyla(client.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: metin }] }] }), ms, etiket);
    return r.text?.trim() || '';
  }

  async ask(prompt: string, senderName: string = 'İzleyici'): Promise<string> {
    const enabledRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_enabled'").get() as { value: string } | undefined;
    if (enabledRow?.value === 'false') {
      return 'Yapay zeka asistanı şu an devre dışı.';
    }
    // B9: günlük sınır dolduysa sessiz kal (boş yanıt sohbete yazılmaz; panel durumu gösterir)
    if (!istekHakkiAl()) return '';

    const promptRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_prompt'").get() as { value: string } | undefined;
    const webArama = webAramaAcik();
    const bilgi = (db.prepare("SELECT value FROM bot_settings WHERE key = 'ai_bilgi_bankasi'").get() as { value?: string } | undefined)?.value;
    // Model bugünü bilmez: "bugünkü maç", "son haber" sorularında tarih gerekir
    const systemInstruction =
      (promptRow?.value || 'Sen neşeli, esprili ve zeki bir canlı yayın botusun. Cevapların kısa, dinamik ve canlı yayın sohbetine uygun olsun (en fazla 2-3 cümle).') +
      ` Bugünün tarihi: ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}.` +
      (webArama ? ' Güncel haber, skor ve sonuç sorularında internette arayıp kısa ve doğru cevap ver; bulamazsan uydurma.' : '') +
      bilgiBankasiYonergesi(bilgi);

    // Gemini dışında bir sağlayıcı seçildiyse (OpenAI, Claude, Groq…) aynı yönerge ve geçmişle ona sorulur
    const saglayici = seciliSaglayici();
    if (saglayici) {
      try {
        const reply = (await metinUret(saglayici, systemInstruction, this.istemHazirla(prompt, senderName), URETIM_ZAMAN_ASIMI)) || 'Hmm, bir şey diyemedim!';
        this.gecmiseEkle(senderName, prompt, reply);
        return reply;
      } catch (e: any) {
        return `⚠️ ${String(e?.message || e).slice(0, 160)}`;
      }
    }

    const client = this.initClient();
    if (!client) {
      return '⚠️ Gemini API anahtarı henüz girilmemiş. Lütfen AxBoT panelinden bir API anahtarı ekleyin!';
    }

    try {
      // Önceki mesajlar da gönderilir: asistan konuşmayı hatırlasın (geçmiş
      // tutuluyordu ama isteme HİÇ eklenmiyordu, her soru sıfırdan soruluyordu).
      const formattedPrompt = this.istemHazirla(prompt, senderName);

      const model = await this.resolveModel(client);
      const response = await zamanAsimiyla(
        client.models.generateContent({
          model,
          contents: [
            { role: 'user', parts: [{ text: `[Yönerge: ${systemInstruction}]\n\n${formattedPrompt}` }] }
          ],
          ...(webArama ? { config: { tools: [{ googleSearch: {} }] } } : {})
        }),
        URETIM_ZAMAN_ASIMI,
        'Gemini'
      );

      const reply = response.text?.trim() || 'Hmm, bir şey diyemedim!';
      this.gecmiseEkle(senderName, prompt, reply);
      return reply;
    } catch (error: any) {
      const msg = String(error?.message || error);
      console.error('Gemini AI error:', msg);
      // 429 = model VAR ama kotasi dolu: modeli ele, sirdakiyle dene.
      // 404 = model kapanmis: kayitli secimi unut, listeyi yeniden tara.
      if (/429|quota|rate.?limit/i.test(msg)) this.kotayiIsaretle(this.workingModel);
      else this.forgetModel();
      try {
        const model2 = await this.resolveModel(client);
        const fallbackResp = await zamanAsimiyla(
          client.models.generateContent({
            model: model2,
            contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${senderName}: ${prompt}` }] }]
          }),
          URETIM_ZAMAN_ASIMI,
          'Gemini'
        );
        return fallbackResp.text?.trim() || 'Anlaşılamadı.';
      } catch (fbError: any) {
        // Sabit cümle yerine GERÇEK sebep: kullanıcı ne yapacağını bilsin.
        const sebep = String(fbError?.message || fbError).slice(0, 200);
        if (/yanit vermedi|timeout/i.test(sebep)) return '⚠️ Gemini zamanında yanıt vermedi. Biraz sonra tekrar dene.';
        if (/quota|429/i.test(sebep)) return '⚠️ Gemini kotası doldu (429). Google AI Studio’dan kullanım/faturalandırmayı kontrol et.';
        // Ayrıntı sohbete yazılmaz (izleyici görür); panel durum ekranı tam nedeni gösterir
        if (anahtarSorunu(String(fbError?.message || fbError), this.currentKey)) {
          return '⚠️ Gemini anahtarı çalışmıyor — yayıncı panelde AI Ayarları’ndaki açıklamaya bakmalı.';
        }
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
    if (!messages.length) return null;

    const list = messages.map((m, i) => `${i + 1}. ${m}`).join('\n');
    const prompt =
      `Aşağıda "${username}" adlı izleyicinin bir canlı yayın sohbetindeki son mesajları ` +
      `eskiden yeniye sıralı olarak veriliyor. Mesajların BÜTÜNÜNE bakarak kişinin yayına ` +
      `karşı genel tutumunu değerlendir. Tek bir kelimeye değil, bağlama ve gidişata bak ` +
      `(şaka, alay, samimiyet, gerçek şikâyet ayrımını gözet).\n\n${list}\n\n` +
      `Yanıtı YALNIZ şu JSON biçiminde ver:\n` +
      `{"durum":"olumlu|notr|olumsuz","guven":0.0-1.0,"ozet":"en fazla 15 kelimelik Türkçe değerlendirme"}`;

    try {
      const raw = await this.yardimciUret(prompt, 20000, 'Gemini duygu analizi');
      if (raw === null) return null;
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
}

export const geminiCoHost = new GeminiCoHost();
export default geminiCoHost;
