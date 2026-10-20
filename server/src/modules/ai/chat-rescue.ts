import { EventEmitter } from 'events';
import { db } from '../../db/index.js';
import { ChatRescueSettings } from '../../db/schema.js';
import { geminiCoHost } from './gemini.js';
import { seyrekUyar } from '../../core/logger.js';

const PERSONALITY_TEMPLATES: Record<string, string[]> = {
  friendly: [
    '✨ Chat biraz sakinleşti gibi, gününüz nasıl geçiyor dostlar? Yayını nereden takip ediyorsunuz?',
    '☕ Bir çay/kahve molası mı verdiniz? Bugünün en güzel olayı neydi sizin için?',
    '🎮 Sohbeti canlandıralım! Son zamanlarda bitirdiğiniz ve en çok etkilendiğiniz oyun ya da film hangisiydi?',
    '🔥 Canlar klavyeleri görelim! Yayında en çok hangi oyunu veya içeriği izlemekten keyif alıyorsunuz?'
  ],
  troll: [
    '👀 Chat nerede ya? Klavyeleriniz mi bozuldu yoksa yayıncının yeteneği karşısında büyülendiniz mi?',
    '😴 Uyanın millet! Sohbette yaprak kımıldamıyor, afk olanları bot listesine mi alalım yani?',
    '🎯 Burası canlı yayın mı yoksa kütüphane mi? Bir ses verin bakalım kimler ayakta!',
    '🤖 Yayıncıyı izlerken çayını dökenler parmak kaldırsın, sessizliği bozalım!'
  ],
  wise: [
    '📜 "Sessizlik bilgeliğin başlangıcıdır" derler ama canlı yayında sohbet berekettir. Sizce bir oyunu harika yapan hikayesi mi yoksa oynanışı mı?',
    '🌌 Bir soru bırakıyorum: Eğer zamanda geriye gidip sadece bir tek oyunu ilk kez oynama şansınız olsaydı, hangisini seçerdiniz?',
    '💭 Hayat bir simülasyonsa şu an hangi seviyedesiniz? Chat düşünceleri alalım.'
  ],
  gamer: [
    '⚡ Takım nerede?! Boss dövüşü öncesi chatten enerji lazım, klavyelere asılın!',
    '🏆 En iyi clutch veya en komik fail anınızı hatırlıyor musunuz? Chate dökülün bakalım!',
    '🎮 Şu an oynadığımız oyun hakkında 10 üzerinden puanınız kaç? Nedenleri görelim!'
  ]
};

export class ChatRescueService extends EventEmitter {
  private lastMessageTime: number = Date.now();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startWatcher();
  }

  getSettings(): ChatRescueSettings {
    try {
      const row = db.prepare("SELECT value FROM bot_settings WHERE key = 'chat_rescue_settings'").get() as { value: string } | undefined;
      if (row?.value) {
        return JSON.parse(row.value);
      }
    } catch (e) {
      seyrekUyar('ayar:chat_rescue_settings', '[Ayar] Sohbet kurtarma ayarı okunamadı — varsayılan kullanılıyor', e);
    }

    return {
      isEnabled: true,
      inactivityMinutes: 5,
      personality: 'friendly',
      customPrompt: '',
      allowPolls: true,
      allowTrivia: true
    };
  }

  saveSettings(settings: Partial<ChatRescueSettings>): ChatRescueSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    db.prepare(`
      INSERT INTO bot_settings (key, value) VALUES ('chat_rescue_settings', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(JSON.stringify(updated));
    return updated;
  }

  recordChatMessage() {
    this.lastMessageTime = Date.now();
  }

  private startWatcher() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(async () => {
      const settings = this.getSettings();
      if (!settings.isEnabled) return;

      const idleThresholdMs = (settings.inactivityMinutes || 5) * 60 * 1000;
      const elapsed = Date.now() - this.lastMessageTime;

      if (elapsed >= idleThresholdMs) {
        await this.triggerRescue('auto');
      }
    }, 60000); // Check every 60s
  }

  async triggerRescue(triggerSource: 'auto' | 'manual' = 'manual'): Promise<string> {
    const settings = this.getSettings();
    this.lastMessageTime = Date.now(); // Reset timer

    let message = '';
    const personality = settings.personality || 'friendly';

    // Try Gemini AI first if configured
    const keyRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_api_key'").get() as { value: string } | undefined;
    if (keyRow?.value) {
      try {
        let promptText = `Canlı yayın sohbeti durgunlaştı ve izleyiciler sessiz. Sen '${personality}' kişiliğinde bir asistansın. İzleyicilerin sohbete katılması için ilgi çekici, neşeli, merak uyandıran tek bir soru veya konu başlatıcı cümle yaz (maksimum 2 cümle).`;
        if (personality === 'custom' && settings.customPrompt) {
          promptText = `${settings.customPrompt}\n\nCanlı yayın sohbetini canlandırmak için tek bir ilgi çekici soru/konu yaz.`;
        }

        const aiReply = await geminiCoHost.ask(promptText, 'Yayıncı');
        // `ask` hata durumunda "⚠️ …" metni döndürür; o metin sohbete gitmesin
        if (aiReply && !aiReply.startsWith('⚠️') && !aiReply.includes('devre dışı')) {
          message = aiReply;
        }
      } catch (err) {
        console.warn('[ChatRescue] Gemini fallback to template:', err);
      }
    }

    // Fallback to rich template if AI didn't produce
    if (!message) {
      const list = PERSONALITY_TEMPLATES[personality] || PERSONALITY_TEMPLATES.friendly;
      message = list[Math.floor(Math.random() * list.length)];
    }

    // Save rescue timestamp
    this.saveSettings({ lastRescuedAt: Date.now() });

    this.emit('rescue_triggered', {
      message,
      source: triggerSource,
      personality,
      timestamp: Date.now()
    });

    return message;
  }
}

export const chatRescueService = new ChatRescueService();
export default chatRescueService;
