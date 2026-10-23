import { eventBus, ChatMessagePayload } from './event-bus.js';
import { autoMod } from '../modules/automod/automod.js';
import { commandManager } from '../modules/commands/command-manager.js';
import { ttsEngine } from '../modules/tts/tts.js';
import { gamesEngine } from '../modules/games/games.js';
import { triviaEngine } from '../modules/games/trivia-engine.js';
import { cuzdanAdi, economy } from '../modules/economy/economy.js';
import { seviyeler } from '../modules/levels/levels.js';
import { sohbetUyarilari } from '../modules/chat-alerts/chat-alerts.js';
import { puanDususu } from '../modules/engagement/point-drops.js';
import { settingsCache } from './settings-cache.js';
import { karaListeyiUygula } from '../modules/moderation/blacklist.js';
import { kalkaniUygula } from '../modules/moderation/shield-enforce.js';
import { chatRescueService } from '../modules/ai/chat-rescue.js';
import { seyrekUyar } from './logger.js';
import { aktarimMetni, aktarimYankisiMi } from './cross-chat.js';
import { sonMesajlar } from '../modules/moderation/son-mesajlar.js';
import { SeslenmeSiniri, seslenmeAyikla } from '../modules/ai/seslenme.js';
import { geminiCoHost } from '../modules/ai/gemini.js';
import { toplulukMesaji } from '../modules/community/topluluk.js';

export class MessagePipeline {
  private recentBotOutputs: Set<string> = new Set();
  private seslenmeSiniri = new SeslenmeSiniri();

  constructor() {
    this.setupListeners();
  }

  init() {
    console.log('[MessagePipeline] Chat message processing pipeline initialized and listening to events.');
  }

  setupListeners() {
    eventBus.on('chat', async (message: ChatMessagePayload) => {
      await this.handleIncomingMessage(message);
    });

    eventBus.on('bot_message', (payload) => {
      if (payload?.message) {
        const text = payload.message.trim();
        this.recentBotOutputs.add(text);
        setTimeout(() => {
          this.recentBotOutputs.delete(text);
        }, 15000);
      }
    });
  }

  async handleIncomingMessage(message: ChatMessagePayload) {
    const rawText = (message.message || '').trim();
    if (!rawText) return;

    // Prevent echoing automated bot outputs
    if (this.recentBotOutputs.has(rawText)) {
      return;
    }

    // Çapraz aktarım yankısı: botun başka platforma yazdığı metin o platformdan
    // geri geldi. Yeniden aktarılırsa platformlar arasında döngü oluşur; komut,
    // puan ya da seviye olarak da işlenmemeli.
    const aktarimAcik = settingsCache.getBoolean('cross_chat_enabled', false);
    const aktarimBicimi = settingsCache.get('cross_chat_format', '[$platform] $user: $message');
    if (aktarimAcik && aktarimYankisiMi(aktarimBicimi, rawText)) {
      return;
    }

    // !nuke / !vanish için son mesajlar (yayıncı, mod ve botun kendisi muaf)
    sonMesajlar.ekle({
      id: String(message.id || ''),
      platform: message.platform,
      kullanici: message.user.username,
      gorunenAd: message.user.displayName || message.user.username,
      metin: rawText,
      zaman: Date.now(),
      muaf: Boolean(message.user.isBroadcaster || message.user.isMod || message.user.isSelf)
    });

    // Ignore known external chat-bot accounts so their output is not reprocessed
    const u = message.user.username.toLowerCase();
    if (u === 'botrix' || u === 'nightbot' || u === 'streamlabs') {
      return;
    }

    // Ortak kara liste: bot yok sayar; seçilen eylem (sil / kalıcı ban)
    // platformda uygulanır. OBS sohbet katmanından ws/server.ts gizler.
    if (karaListeyiUygula(message)) return;

    // Kalkan modu: yalnız abone / link / büyük harf / emoji seli kuralları.
    // Bot yok sayar; OBS sohbetinden ws/server.ts gizler; seçiliyse platformda silinir.
    if (kalkaniUygula(message)) return;

    // Notify Chat Rescue of active conversation
    chatRescueService.recordChatMessage();

    // Ilk kez yazan izleyiciyi karsila (BotRix'te 'Karsilama').
    sohbetUyarilari.sohbetMesaji(message.user.username, message);

    // Record Loyalty (Messages count, watch time activity, loyalty tier, points)
    economy.recordMessage(message);

    // Ses panosu giriş sesi (izleyicinin günün ilk mesajı); hata sohbet akışını bozmaz
    void import('../modules/pano/pano.js').then((m) => m.sesPanosu.girisKontrol(message)).catch(() => {});

    // Seviye XP'si — puandan AYRI tutulur: mağazadan alışveriş yapan izleyici
    // seviyesini kaybetmesin. Bekleme süresi spam ile seviye kasmayı engeller.
    try {
      const sv = seviyeler.mesajXp(message.user.username);
      if (sv?.atladi) {
        eventBus.emitBotMessage({
          platform: message.platform,
          channel: message.channel,
          message: `⭐ @${message.user.displayName} seviye ${sv.seviye} oldu!`
        });
      }
    } catch (e) {
      /* seviye sistemi kritik değil — mesaj işlemeye devam */
      seyrekUyar('seviye:mesajXp', '[Seviye] Mesaj XP işlenemedi', e);
    }


    // 0.9 Bil Bakalım oyu — AutoMod'dan ÖNCE: "GALATASARAY", "NOBEL KİMYA" gibi
    // büyük harfle yazılan doğru cevap eskiden oy yerine CAPS uyarısı alıyordu.
    // Yalnız geçerli bir şık/seçenek metni kabul edilir (kara liste ve kalkan
    // yukarıda zaten uygulandı), dolayısıyla moderasyon delinmez.
    if (!message.user.isSelf && triviaEngine.getState().status === 'question_active') {
      const voteResult = triviaEngine.submitVote(
        {
          username: message.user.username,
          displayName: message.user.displayName,
          platform: message.platform
        },
        message.message
      );
      if (voteResult.accepted) {
        // Vote registered and overlay updated in real time. Skip command execution for answer letters.
        return;
      }
    }

    // 1. AutoMod
    const violation = autoMod.checkMessage(message);
    if (violation) {
      // Eskiden burada SADECE sohbete uyari yaziliyordu; platformda hicbir
      // eylem yapilmiyordu. Artik kural basina secilen eylem uygulanir
      // (uyar / zaman asimi / mesaj sil), bypass rolleri gozetilir ve
      // platform desteklemiyorsa uyariya dusulur.
      await autoMod.ihlaliUygula(message, violation);
      return;
    }

    // 1.2 Topluluk: kappagen (overlay), emote bingo, emote piramidi.
    // Yanıt varsa sohbete yazılır; mesajın geri kalan işlenişi sürer.
    try {
      for (const yanit of toplulukMesaji(message, (puan, kim) => economy.addPoints(cuzdanAdi(message.platform, kim), puan))) {
        eventBus.emitBotMessage({ platform: message.platform, channel: message.channel, message: yanit });
      }
    } catch (e) {
      seyrekUyar('topluluk:mesaj', '[Topluluk] Mesaj işlenemedi', e);
    }

    // 1.4 Puan dususu anahtar kelimesi — komut degil, duz kelime oldugu icin
    // komut isleyicisinden ONCE bakilir.
    if (puanDususu.katil(cuzdanAdi(message.platform, message.user.username), message.user.displayName, rawText)) {
      return;
    }

    // 2. Chat Minigames Check (Live Trivia & Anagram unscramble answers)
    const gameReply = gamesEngine.checkChatMessage(message);
    if (gameReply) {
      eventBus.emitBotMessage({
        platform: message.platform,
        channel: message.channel,
        message: gameReply
      });
      return;
    }

    // 3. Command Processing
    const commandReply = await commandManager.processMessage(message);
    if (commandReply) {
      eventBus.emitBotMessage({
        platform: message.platform,
        channel: message.channel,
        message: commandReply
      });
      return;
    }

    // 3.5 Yapay zekâya seslenme: "@BotAdı soru" (ayar: ai_mention_enabled)
    if (!message.user.isSelf && rawText.startsWith('@') && settingsCache.getBoolean('ai_mention_enabled', false)) {
      const { platformManager } = await import('../platforms/manager.js');
      const soru = seslenmeAyikla(rawText, platformManager.botKullaniciAdlari());
      if (soru && this.seslenmeSiniri.izinVer(message.user.username)) {
        const cevap = await geminiCoHost.ask(soru, message.user.displayName);
        if (cevap?.trim()) {
          eventBus.emitBotMessage({
            platform: message.platform,
            channel: message.channel,
            message: `@${message.user.displayName} ${cevap}`
          });
        }
        return;
      }
    }

    // 3. TTS Trigger (e.g. if !tts or normal chat if configured)
    if (message.message.startsWith('!tts ')) {
      const speechText = message.message.replace('!tts ', '').trim();
      // Roller de gonderilir: minimum rol ayari uygulanabilsin.
      ttsEngine.enqueue(speechText, message.user.displayName, undefined, undefined, {
        isBroadcaster: message.user.isBroadcaster,
        isMod: message.user.isMod,
        isVip: message.user.isVip,
        isSub: message.user.isSub
      });
    }

    // 4. Cross-Chat Relay (Instant in-memory lookup)
    // Botun kendi mesajı aktarılmaz (Kick yankısı isSelf ile işaretli).
    if (aktarimAcik && !message.user.isSelf) {
      const relayText = aktarimMetni(aktarimBicimi, {
        platform: message.platform,
        user: message.user.displayName || message.user.username,
        message: message.message
      });
      // Biçim yalnız `$message` ise ayırt edici iz yoktur; birebir yankıyı
      // botun kendi çıktıları gibi ele.
      this.recentBotOutputs.add(relayText);
      setTimeout(() => this.recentBotOutputs.delete(relayText), 15000);

      // Emit relay message to all platforms except the origin
      eventBus.emit('cross_chat_relay', {
        originPlatform: message.platform,
        originChannel: message.channel,
        text: relayText
      });
    }
  }
}

export const messagePipeline = new MessagePipeline();
export default messagePipeline;
