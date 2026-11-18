/**
 * AxBoT — Widget galerisi "Nasıl çalışır?" ipuçları
 * Developed by AxthrowA
 *
 * Her widget için: OBS'e nasıl eklenir, ne zaman görünür, hangi olay/komutla
 * çalışır. Galeri kartında ilk madde, ayar penceresinde tamamı gösterilir.
 */

export const OBS_EKLEME =
  "OBS → Kaynaklar → + → Tarayıcı (Browser) → URL'yi yapıştır. Genişlik/yükseklik: tam ekran widget'larda 1920×1080.";

export const WIDGET_IPUCLARI: Record<string, string[]> = {
  'activity-feed': [
    'Takip, abone, bağış, raid ve KICKs olaylarını sırayla listeler.',
    'Olaylar canlı gelir; "Test" düğmesiyle örnek olay gönderebilirsin.',
    'Ayarlardan hangi olayların listeleneceğini ve en çok kaç satır görüneceğini seç.'
  ],
  'alert-box': [
    'Takip, abone, hediye abone, bağış, raid ve KICKs geldiğinde ses ve animasyonla uyarı gösterir.',
    'Her olayın görseli, sesi, metni ve süresi "AlertBox & Bildirimler" sekmesinden ayarlanır.',
    'Uyarılar sırayla oynar; panelden duraklat/atla, sohbetten !alerts pause|resume (mod).'
  ],
  'chat-overlay': [
    'Kick, Twitch, YouTube ve TikTok sohbetini tek listede gösterir; platform logosu ve özgün rozetlerle.',
    'Kick ve 7TV emote’ları görsel olarak çizilir.',
    'Komutları, botları, yayıncıyı ya da yalnız emote içeren mesajları gizleyebilir; mesajlar belirli süre sonra kaybolabilir.'
  ],
  'cloud-tts': [
    'İzleyici mesajlarını ve bağış metinlerini seslendirir (TTS motoru TTS Yöneticisi’nde seçilir).',
    'OBS’te bu kaynağın sesini "Monitör ve Çıkış" yaparsan yayına da gider.',
    'Sohbetten: !tts <metin>; minimum rol ve filtreler TTS ayarlarında.'
  ],
  tts: [
    'Sohbet ve bağış metinlerini seslendirir; ses çalar olarak OBS’e eklenir.',
    'Sohbetten: !tts <metin>. Kim kullanabilir, hangi kelimeler yasak: TTS Yöneticisi.'
  ],
  'donation-goal': [
    'Bağış hedefini çubukla gösterir; her bağış çubuğu doldurur.',
    'Hedef, başlık ve mevcut değer ayarlardan değiştirilir.'
  ],
  'follower-goal': ['Takipçi hedefini çubukla gösterir; her yeni takip çubuğu doldurur.', 'Hedef ve başlık ayarlardan değiştirilir.'],
  'subscriber-goal': ['Abone hedefini gösterir; abone ve hediye abonelikler sayılır.', 'Hedef ve başlık ayarlardan değiştirilir.'],
  'kicks-goal': ['KICKs hedefini gösterir; gelen KICKs miktarı çubuğu doldurur.', 'Hedef ve başlık ayarlardan değiştirilir.'],
  atla: [
    'İzleyici !atla yazınca oy çubuğu görünür; eşik dolunca veya mod atlayınca kart “atlandı” der.',
    'OBS tarayıcı kaynağı: /widgets/atla. Görünme süresi ayardan değişir.'
  ],
  'emote-combo': [
    'Aynı emote art arda gelince ekranda belirir, geldikçe büyür; gelmeyi kesince patlayıp etrafa saçılır.',
    'Kaç kez art arda gelince belireceği ve patlama beklemesi ayarlanır.'
  ],
  'on-screen-emotes': [
    'Sohbette yazılan emote’lar ekranda uçar (Kappagen).',
    'Mod !kappagen [emote] yazınca ortadan patlama olur; izleyicilere puanla açmak: Ekstralar → Topluluk.'
  ],
  'end-credits': [
    'Yayın boyunca gelen takipçi, abone ve bağışları film jeneriği gibi kaydırır.',
    'Yayın sonunda "Kayan Jeneriği Başlat" ile oynatılır; OBS’te kapanış sahnesine ekle.'
  ],
  'event-labels': [
    'Son takipçi, son abone, son bağış, en büyük bağış, son raid ve son KICKs’i yazar.',
    'Açılışta son olaylar veritabanından gelir, canlı olaylar üstüne yazar.',
    'Her etiketin başlığı, görünürlüğü ve rengi ayrı ayarlanır; yan yana ya da alt alta dizilebilir.'
  ],
  giveaways: [
    'Çekiliş açıkken izleyiciler sohbete katılım kelimesini yazarak katılır; başlayınca bot kelimeyi sohbete duyurur.',
    'Katılım şartları (takipçi/abone, puan bedeli, en az mesaj) ve kazanan sayısı ayarlanır; kazanan panelden çekilir.'
  ],
  'hype-train': [
    'Abone, hediye abonelik, bağış ve KICKs treni doldurur (hangileri sayılacak ayarlardan seçilir; takip varsayılan kapalı).',
    'Süre içinde destek gelmezse tren biter ve sıfırlanır; "Treni başlat (sıfırdan)" ile elle başlatılır.',
    'Seviye hedefi, büyüme oranı ve olay başına puan ayarlanır.'
  ],
  'loyalty-redemptions': [
    'İzleyiciler sadakat puanıyla ödül alınca (ses, TTS, VIP vb.) ekranda gösterir.',
    'Sohbetten: !market (ödüller), !al <ödül>. Ödüller Ekonomi sayfasında tanımlanır.'
  ],
  'now-playing': [
    'Spotify ya da YouTube Music’te GERÇEKTEN çalan şarkıyı kapak ve ilerlemeyle gösterir (Resonance).',
    'Bağlantı: Şarkı İsteği sayfasındaki Spotify kartı ya da Resonance’ın kendi ekranı (/resonance/).',
    'Görünüm (tema, renk, animasyon) Resonance’ta seçilir; OBS adresi değişmez.'
  ],
  'social-rotator': [
    'Eklediğin sosyal medya hesapları sırayla döner; her hesabın süresini ve tur arası beklemeyi seçebilirsin.',
    'Hesap eklenmedikçe yayında görünmez. Profil adresi yapıştırırsan ekranda yalnız @ad yazılır.'
  ],
  'sponsor-banner': [
    'Sponsor ve iş birliği görsellerini, GIF ve videolarını sırayla gösterir; her öğenin süresi ve alt yazısı ayrı ayarlanır.',
    'Medya eklenmedikçe yayında görünmez. Video sesi varsayılan olarak kapalıdır.'
  ],
  'pinned-messages': [
    'Öne çıkardığın sohbet mesajını ekranda sabit tutar.',
    'Canlı Multi-Chat’te mesajın yanındaki sabitle düğmesiyle seçilir; belirli süre sonra kendiliğinden kalkabilir.'
  ],
  polls: [
    'Anket açılınca ekranda belirir; izleyiciler !oy 1, !oy 2… ile oy verir, sonuç canlı güncellenir.',
    'Süre dolunca anket kendiliğinden kapanır, kazanan işaretlenir ve ayarlanan süre sonra kaybolur.',
    'Anketler Anket Stüdyosu’ndan açılır.'
  ],
  shoutout: [
    'Mod !so @kanal yazınca o yayıncıyı avatarı ve bilgisiyle gösterir.',
    'Ne kadar ekranda kalacağı ve konumu ayarlanır.'
  ],
  subathon: [
    'Geri sayan bir yayın süresi; abone, bağış ve KICKs süreyi uzatır.',
    'Başlat/durdur ve hangi olayın kaç saniye eklediği bu pencereden ayarlanır.'
  ],
  'word-cloud': [
    'Sohbette en çok geçen sözcükler büyüyen bir bulut olarak görünür (bağlaçlar ve linkler sayılmaz).',
    'Sayım bot açıldığından beri sürer; !chatstats sifirla (mod) ya da Sohbet İstatistikleri sayfasından sıfırlanır.'
  ],
  scoreboard: [
    'Takım skorları: moderatör !skortablo 1 +1, !skortablo mavi =5, !skortablo ad 1 Mavi yazar.',
    'İzleyici !skortablo ile skoru görür; değişen takım OBS’te kısa süre parlar.'
  ],
  'the-cup': [
    'Bağış, abone, hediye abonelik ve KICKs kupaya düşer; öğeler rastgele yığılır.',
    'Hangi olayların sayılacağı ve eşikler ayarlanır; kupa OBS yenilense de dolu kalır.',
    '"Kupayı sıfırla" ile boşaltılır.'
  ],
  'viewer-counter': ['Anlık izleyici sayısını gösterir; platform başına ayrı ya da toplam.', 'Tema, ikon ve hangi platformların sayılacağı ayarlanır.'],
  'trivia-quiz': [
    'Bil Bakalım açılınca soru ve şıklar ekranda belirir; izleyiciler sohbete A/B/C/D (ya da cevabı) yazar.',
    'Doğru cevap gösterildikten ayarlanan süre (varsayılan 3 sn) sonra kaybolur, yeni soruyla yeniden gelir.',
    'Sorular ve turnuva: Bil Bakalım sayfası; sohbetten !trivia (mod).'
  ],
  'wheel-of-fortune': [
    'İzleyici !cark yazınca çark çevrilir; sonuç panelde ayarlanan dilim ağırlıklarına göre seçilir ve sohbete yazılır.',
    'Çark yalnız çevrilince ya da ayarları değişince belirir, sonuçtan ayarlanan süre sonra kaybolur.',
    'İzleyici çevirmeleri arası bekleme: varsayılan 30 sn (modlar beklemez).'
  ],
  rankings: ['Puan, izleme süresi ya da mesaj sayısına göre izleyici sıralamasını gösterir.', 'Kaç kişinin listeleneceği ve yenileme aralığı ayarlanır.'],
  lyrics: [
    'Spotify/YouTube Music’te çalan şarkının sözlerini gösterir; zaman damgalı sözler şarkıyla senkron akar.',
    'Müzik bağlı değilse şarkı isteği kuyruğundaki şarkının sözleri kullanılır.',
    'Sözler lrclib.net’ten gelir; bulunamazsa bunu açıkça yazar.'
  ],
  king: [
    'İzleyiciler !tahtikap <puan> ile sadakat puanı basarak tahtı kapar; kral ekranda gösterilir.',
    '"Yalnız izleyiciler" açıkken yayıncı tahta çıkamaz; taht boşsa "Taht boş" yazar (ya da gizlenir).',
    'Sohbetten !kral ile mevcut kral görülür.'
  ],
  jumpscare: [
    'Belirlenen tutarın üstünde bağış gelince ekranda korku sahnesi oynatır.',
    'Medya, ses ve eşik Bağış & Jumpscare sayfasından ayarlanır.'
  ],
  'muzik-video': [
    '!sr istekleri YouTube klibiyle sırayla oynar; Şarkı İstekleri’nde "OBS Şarkı Klipleri" kipini seç.',
    'Video bitince ya da gömülmeye kapalıysa sıradaki istek başlar.',
    'Sesi OBS’te bu kaynaktan gelir; "Test" düğmesi 15 saniyelik örnek klip oynatır.'
  ]
};
