/**
 * Sürüm adları ve yenilikler. Her yeni düzeltme sürümünde EN ÜSTE bir satır eklenir;
 * panel başlığı ve "Yenilikler" listesi buradan okunur (package.json sürümüyle aynı tutulmalı).
 */
export interface Surum {
  surum: string;
  ad: string;
  tarih: string;
  notlar: string[];
}

export const SURUMLER: Surum[] = [
  {
    surum: '1.8.0',
    ad: 'Sohbet Görünümleri',
    tarih: '2026-10-28',
    notlar: [
      "Tek URL OBS Stüdyosu: yalnız seçili widget taşınır; başka widget'a tıklamak onu yalnız seçer, seçili widget üste alınır",
      'Sohbet yazı tipleri okunur: dar/süslü yazı tiplerinin boyutu dengelenir, gerçek kalın sürümler yüklenir; "Press Start 2P" ve "Exo 2" artık uygulanıyor',
      'Sohbet katmanına 8 görünüm stili (platform kartı, başlıklı, ad etiketi, konuşma balonu, platform şeridi, neon, kompakt, klasik) ve 8 yeni hazır tema; platformların özgün renkleri',
      "Twitch rozetleri düzeldi (çoğunun adresi bozuktu); jeton varsa kanalın kendi abone/bit rozetleri; Twitch kanal emote'ları, BTTV ve FFZ emote'ları",
      'Widget ayar penceresi: ayarlar geniş, önizleme sağda sabit; önizleme titremeden ve sohbette okunur ölçekte yakınlaşır'
    ]
  },
  {
    surum: '1.7.0',
    ad: 'Stüdyo Düzeni',
    tarih: '2026-10-28',
    notlar: [
      "Tek URL OBS Stüdyosu'nda TÜM katmanların ayarları açılır (sabitlenmiş mesaj, shoutout, izleyici sayacı, sıralama, sadakat, jenerik… eskiden açılmıyordu); kelime bulutu ve skor tablosu Tek URL'ye eklendi",
      'Sabitlenmiş mesaj: panelden kendi metnini yazıp sabitleme',
      'Emote kombo ayrı OBS sayfasında görünmüyordu (kutu genişliği 0) — düzeltildi',
      'Galeri testleri canlı önizlemede görünür ("Test et" önizlemeyi canlı kipe alır); sohbet, hedefler, etkinlik etiketleri, sabit mesaj, kral ve skor tablosuna test eklendi',
      'Canlı önizleme widget’a yakınlaşır (büyük görünür); tüm tuval / yakınlaş seçeneği',
      '!anketac virgülle de açılır: !anketac 60, Hangi oyun?, Valorant, CS2',
      'Subathon: takipler süreye eklenir (ayarlanabilir); Duraklat kalan süreyi saklar, bot kapalıyken süre akmaz, "Kaldığı yerden başlat" ile sonraki yayında sürer',
      'Müzik: gerçekte çalan şarkı (Spotify / YouTube Music) kapak fotoğrafı ve ilerlemeyle; "Now Playing" adları Resonance oldu',
      'Şarkı sözleri: sürüm seçimi çalan parçanın süresine göre (kayma düzeltmesi), senkron kaydırma ayarı, 6 yeni görünüm ve satır yazı tipi',
      'Yazı tipleri: ayarlardaki ve temalardaki tüm yazı tipleri OBS’te yüklenir; 24 yeni Türkçe karakterli yazı tipi; listede yazı tipleri kendi görünümüyle',
      'Temalar: widget’ın tanımadığı görünüm değeri artık yazılmaz (bozuk görünüm); 20 yeni tema (Nord, Dracula, Catppuccin, Synthwave, Lo-fi, Sakura, E-spor…)',
      "Yayın Yönetim Aracı'nın 'Hakkında' bölümünde StreamAxT sürümü görünür"
    ]
  },
  {
    surum: '1.6.2',
    ad: 'Düzen',
    tarih: '2026-10-28',
    notlar: [
      'Anket sonucu yalnız süre gerçekten o an dolduysa sohbete yazılır (bot kapalıyken biten eski anket ertesi gün duyurulmaz)',
      'Anket sonucu Discord sunucusuna gitmez, yalnız yayın sohbetlerine yazılır',
      '!hatirlat yanıtı botun yeniden başlamasında hatırlatmanın iptal olacağını söyler'
    ]
  },
  {
    surum: '1.6.1',
    ad: 'Vitrin',
    tarih: '2026-10-28',
    notlar: [
      'İzleyici sayacında platform logoları (Kick, Twitch, YouTube); ayarlardan renkli noktaya dönülebilir',
      'Shoutout: 13 yeni tasarım (Yumuşak kart, Kabartma, Yalnız çerçeve, Haber bandı, Ufuk, Sahne ışığı, Kor, Sinyal, Etiket, Kurdele, Konuk kartı, Fosfor ekran, Prizma)',
      'Sabitlenmiş mesaj: 7 yeni tema (Sevimli, Terminal, Rahat, Piksel, Kompakt, Kapsül, HUD)',
      'Emoji kombosu: görsel stil seçimi (Piksel, Neon, Minimal)'
    ]
  },
  {
    surum: '1.6.0',
    ad: 'Tek Bot',
    tarih: '2026-10-28',
    notlar: [
      'Widget ayarları penceresinde canlı önizleme: ayar değişince OBS görünümü yanında güncellenir (uyarı kutusunda "Örnek göster")',
      'Yeni komutlar: !cevir (yapay zekâ ile çeviri), !lurk / !unlurk, !hatirlat 15dk <not>, !emotecount, !chatstats',
      'Moderatör komutları: !timer ac|kapat, !modul ac|kapat (oyunlar, sarki, yapayzeka, bilgi, market), !nukeusername, !srclear, !skortablo',
      'Twitch: !marker (yayın işareti) ve !commercial (reklam)',
      "Yeni widget'lar: Kelime Bulutu (sohbette en çok geçenler) ve Skor Tablosu (2-6 takım, sohbetten güncellenir)",
      'Kelime bulutu penceresinde sohbet istatistikleri: en çok yazanlar, saatlere göre yoğunluk, popüler kelimeler',
      'Değişkenler: $(lastfm kullanıcı) son dinlenen şarkı, $(steam kullanıcı oyun|durum|ad) — Entegrasyonlar › Oyun & Müzik Profilleri',
      'Şans çarkı: 28 renk paleti ve tema (gökkuşağı, tek renk tonları, slot, kart oyunu, neon, matrix, vegas…)',
      'Sohbet katmanına 12, ankete 11 yeni tema; izleyici sayacına Kadife, Borsa bandı, Holografik, Çevirmeli tabela görünümleri'
    ]
  },
  {
    surum: '1.5.0',
    ad: 'Tema Atölyesi',
    tarih: '2026-10-28',
    notlar: [
      'Hedef çubuğu: 25 oyun/film/mevsim teması (Cadılar Bayramı, Retro Arcade, Siberpunk, Fantastik RPG, Uzay, Korku…); renk geçişli/çizgili/parlak dolgu, çerçeve, dolgu ucunda simge',
      'Hedef çubuğu yazıları okunur: koyu gölge, binlik ayırıcı (46.700 / 50.000)',
      'Subathon sayacı: 6 görünüm (kart, minimal, dijital saat, çevirmeli kartlar, neon, tek satır) ve 18 tema',
      'Uyarı kutusu ayarlarında her olay (takip, abone, hediye abone, bağış, raid, KICKs, host) için ayrı GIF ve ses',
      'Sohbetten anket: !anketac [süre] Soru | A | B (yayıncı ve moderatörler) · !anketbitir; süre dolunca sonuç sohbete yazılır',
      'Sohbetten çekiliş: !cekilis [dk] [ödül] · !cekilisbitir (kazananı çeker) · !cekilisiptal (yayıncı ve moderatörler)',
      'Bağış kupası: simgeler kupaya homojen dolar (bir yerde kule, yanında boşluk kalmaz)',
      'Widget ayarları penceresi boşluğa tıklayınca ya da Esc ile kapanır',
      "Yapay zekâ: Groq'ta \"güncel bilgi\" kaldırılan groq/compound yerine gpt-oss internet aramasıyla çalışır (\"model bulunamadı\" hatası)"
    ]
  },
  {
    surum: '1.4.11',
    ad: 'Dengeli Masa',
    tarih: '2026-10-27',
    notlar: [
      'Şans oyunları dengeli: ortalamada bahsin %92-96 kadarı geri döner (eskiden slot %116, kasa açma %165, soygun ~%200 veriyordu; oynayarak sınırsız puan basılıyordu)',
      'Slot: üçlü 6 kat, ikili 1,5 kat · Kasa açma: efsanevi %2 · Bomba: doğru kablo 2,85 kat · Tek kişilik yarış %48 kazanma',
      'Soygun: hedefe göre %25-60 başarı, kâr 0,5-2,2 kat; ekip bonusu kişi başı %2 (en çok 3 kişi)',
      'Yazı-tura, zar, rulet ve düello zaten adil (yarı yarıya); değişmedi'
    ]
  },
  {
    surum: '1.4.10',
    ad: 'Kalıcı Bağ',
    tarih: '2026-10-27',
    notlar: [
      'Twitch: yeniden bağlanınca eski bağlantının geç kapanışı yeni bağlantıyı kopmuş göstermez (bot mesajları gitmiyor, bekçi her dakika yeniden bağlıyordu)',
      "Yayın Yönetim Aracı: kısıtlı yetkili uzak kullanıcı yalnız izinli uçlara erişir; Kick oturum dosyaları yarım yazılmaz (yeni YYA exe'si ister)"
    ]
  },
  {
    surum: '1.4.9',
    ad: 'Denetim',
    tarih: '2026-10-27',
    notlar: [
      'Bağış simülasyonu artık sadakat puanı vermez (her deneme 5000 puan yazıyordu)',
      'Kapatılan bağış uyarısı gerçek BynoGame/webhook bağışlarında da kapalı kalır',
      'Twitch ve Discord: botun mesajları panel sohbetinde bot hesabının adıyla görünür',
      "Twitch: çok satırlı bot yanıtı (yapay zekâ) tek satır olarak gider, kesilmez",
      'Düello daveti 2 dakika geçerli; eski davet saatler sonra istemeden kabul edilmez'
    ]
  },
  {
    surum: '1.4.8',
    ad: 'Gerçek Sohbet',
    tarih: '2026-10-27',
    notlar: [
      'Canlı sohbette botun mesajı yerel "AxBot" kopyası olarak değil, sohbete gerçekten düşen hâliyle (platformdaki bot hesabının adıyla) görünür',
      "Yayın Yönetim Aracı taşınabilir kurulumda veritabanını dosyaya yazar (Dashboard 'no such table: app_meta' hatası; yeni YYA exe'si ister)"
    ]
  },
  {
    surum: '1.4.7',
    ad: 'Sıra + Sonraki',
    tarih: '2026-10-27',
    notlar: [
      "!sr isteği Spotify'da sıraya eklenip sonrakine geçilerek başlar (doğrudan \"çal\" komutu masaüstünü durduruyordu; yeni YYA exe'si ister)",
      'Spotify aramasında şarkı adı sorguyla eşleşen sonuç seçilir ("Tame Impala Loser" artık "Dracula" getirmez)',
      '"Resonance müzik çalarını aç" Yayın Yönetim Aracı içinde Müzik sekmesini açar',
      "Emote Kombo: gelen emote'lar uçup büyük emote'ta toplanır, büyük emote kombo büyüdükçe irileşir; kombo bitince emote'lar etrafa dağılıp kaybolur (ayarlardan kapatılabilir)",
      'Hazır temalara 14 oyun & film teması (Retro Arcade, Siberpunk, Fantastik RPG, Korku, Vahşi Batı, Kara Film, Çizgi Roman…) ve yazı tipleri',
      'Temalar artık hedef barı gibi kendi renk alanlarını kullanan widget\'lara da uygulanır (önceden bar rengi değişmiyordu)'
    ]
  },
  {
    surum: '1.4.6',
    ad: 'Doğru Cihaz',
    tarih: '2026-10-27',
    notlar: [
      "!sr isteği Spotify'da bu bilgisayardaki masaüstü uygulamasında çalar (başka/hayalet cihaza gidip masaüstünü durdurmaz; yeni YYA exe'si ister)",
      '"Resonance müzik çalarını aç" bağlantısı Yayın Yönetim Aracı içinde de açılır'
    ]
  },
  {
    surum: '1.4.5',
    ad: 'Güncel',
    tarih: '2026-10-27',
    notlar: [
      'Yapay zekâ "Güncel bilgi: internette ara" seçeneği: haber, maç skoru gibi sorularda internette arar (Groq: groq/compound, Gemini: Google Arama)',
      'Yapay zekâ bugünün tarihini bilir'
    ]
  },
  {
    surum: '1.4.4',
    ad: 'Her Çalarda',
    tarih: '2026-10-27',
    notlar: [
      "!sr istekleri hangi program açıksa (Spotify ya da YouTube Music Desktop) onda sıraya girer, çalan şarkı bitince kendiliğinden çalar",
      'Bot, isteği işlemeden önce Yayın Yönetim Aracı müzik durumunu tazeler (açılışta gelen ilk istek kaybolmaz)',
      'Yeni istek başlarken önceki/takılı kayıtlar kapanır; "Hemen çal" seçeneğinin çalan şarkıyı kestiği açıkça yazar'
    ]
  },
  {
    surum: '1.4.3',
    ad: 'Ücretsiz Zekâ',
    tarih: '2026-10-27',
    notlar: [
      "Groq varsayılan modeli openai/gpt-oss-120b (eski llama-3.3-70b-versatile 16 Ağustos 2026'da kapatıldı)",
      'OpenAI uyumlu sağlayıcılarda yanıt sınırı 1024 jeton (düşünen modeller boş cevap vermesin)'
    ]
  },
  {
    surum: '1.4.2',
    ad: 'Sağlam Sıra',
    tarih: '2026-10-27',
    notlar: [
      'Spotify kapalıyken gelen istek kaybolmaz; 30 sn sonra yeniden denenir (yalnız Spotify\'da bulunamayan istek kapanır)',
      'Kişi başına istek sınırı (varsayılan 2, Şarkı İsteği sayfasından ayarlanır; yayıncı ve mod muaf)',
      'Video kipine geçince bekleyen Spotify istekleri kuyrukta takılı kalmaz'
    ]
  },
  {
    surum: '1.4.1',
    ad: 'Sıradaki',
    tarih: '2026-10-27',
    notlar: [
      "!sr isteği çalan şarkıyı kesmez: Yayın Yönetim Aracı'ndaki Spotify'da istekler bot tarafında sıraya alınır, çalan şarkı bitmek üzereyken sıradaki başlar",
      'Sırada istek yoksa Spotify kendi akışıyla (rastgele/otomatik) çalmaya devam eder; istek başlayınca sohbete "Şimdi çalıyor" yazılır',
      'Şarkı Klipleri: video kipinde katman kendiliğinden açılır; kuyruk boşken Otomatik DJ önceki isteklerden rastgele çalar',
      'Atlamada sırada istek varsa doğrudan o başlar; Spotify API kipinde masaüstü uygulaması ayrıca açılmaz'
    ]
  },
  {
    surum: '1.4.0',
    ad: 'Düzen',
    tarih: '2026-10-26',
    notlar: [
      'Menü sadeleşti: 27 satır 12 ana sekmede toplandı; aynı konudaki sayfalar ana sekmenin içinde alt sekme',
      'Ana sekme, en son açtığın alt sayfayı hatırlar; başlıkta "Ana sekme › Alt sayfa" görünür',
      "Çark dilimleri kaydedilmemişse !cark çevrilmez ve puan düşmez (yayıncıya nasıl ayarlanacağı söylenir)",
      'Kapanış jeneriği KICKs gönderenleri destekçilerde gösterir',
      '"En büyük bağış" farklı para birimlerini karıştırmaz'
    ]
  },
  {
    surum: '1.3.4',
    ad: 'Kıyas',
    tarih: '2026-10-26',
    notlar: [
      'BynoGame/webhook bağışları olay kaydına yazılır: "Son bağış", "En büyük bağış" etiketleri ve kapanış jeneriği artık görür',
      'Kapanış jeneriği yalnız son N saati tarar (varsayılan 12), hediye abonelikleri sayar, test uyarılarını almaz',
      'Sohbet katmanında platform seçimi (Kick, Twitch, YouTube, TikTok, Trovo, Discord)',
      "Shoutout: belirli izleyici sayısının üstündeki raid/host'ta gelen yayıncı otomatik gösterilir",
      '!cark için bekleme süresi ve puan maliyeti widget ayarlarından ayarlanır'
    ]
  },
  {
    surum: '1.3.3',
    ad: 'Net Görüntü',
    tarih: '2026-10-26',
    notlar: [
      "Overlay Stüdyo önizlemesi: açık JumpScare katmanı tuvali kaplayıp tıklamaları yutuyordu; tam ekran katmanlar artık yalnız seçiliyken çizilir",
      'Kapalı katmanlar tuvali doldurmaz; yalnız seçilince (konumlandırmak için) soluk görünür'
    ]
  },
  {
    surum: '1.3.2',
    ad: 'İnce Ayar',
    tarih: '2026-10-26',
    notlar: ['Şarkı kuyruğu, adı benzer şarkıyı ("Hey" / "Hey Jude") yanlış eşleyip istekleri erken düşürmüyor']
  },
  {
    surum: '1.3.1',
    ad: 'Can Simidi',
    tarih: '2026-10-26',
    notlar: [
      'Sohbet Kurtarma mesajı artık gerçekten sohbete yazılıyor; yayın kapalıyken çalışmıyor (yapay zekâ kotası boşa gitmez)',
      'Sohbet Kurtarma seçili yapay zekâyı kullanır, !ai konuşma geçmişini kirletmez, yapay zekâ kapalıysa çağırmaz',
      'Kazanan çekilmeden yeni çekiliş açılırsa ücretli katılım puanları iade edilir'
    ]
  },
  {
    surum: '1.3.0',
    ad: 'Pusula',
    tarih: '2026-10-26',
    notlar: [
      'Hızlı Kurulum: platform → müzik → OBS → test uyarısı → yapay zekâ, durumlar canlı',
      'Başlıkta durum şeridi: Platform, Müzik, OBS, Yapay zekâ (tıklayınca ilgili sayfa)',
      'Menü üç gruba ayrıldı: Yayın sırasında, Etkileşim & Eğlence, Kurulum & Ayarlar',
      "Galeride her widget'a hızlı test; anket, çekiliş ve ödül widget'larının gerçek testi",
      "Spotify kartı, Yayın Yönetim Aracı'ndaki bağlantıyı gösterir (ikinci bağlantı gerekmez)"
    ]
  },
  {
    surum: '1.2.0',
    ad: 'Tek Sahne',
    tarih: '2026-10-26',
    notlar: [
      'Bot adı artık AxBot (uygulama adı StreamAxT)',
      "Tüm widget'lar tek OBS URL'sine eklenebilir; galeride \"Tek URL'ye ekle\" düğmesi",
      "Yeni Şarkı Klipleri widget'ı: !sr istekleri YouTube klibiyle OBS'te sırayla çalar",
      'Anket başlayınca tek URL katmanı kendiliğinden açılır; Kick panelinden başlatılan anket de görünür',
      "!sr, Yayın Yönetim Aracı'ndaki Spotify bağlantısını kullanır (sıraya ekleme yeni YYA exe'si ister; eski exe'de hemen çalar)",
      'Resonance içinde senkron şarkı sözleri (/resonance/lyrics)',
      'Yapay zekâ: Gemini yanında OpenAI, Claude, Groq, OpenRouter, DeepSeek, Mistral, xAI, Ollama ve özel adres',
      'Çıkış jeneriği yalnız o yayında gelen abone/destekçi/takipçileri gösterir (açılıp kapatılabilir)',
      'Düzeltmeler: etkinlik akışında abonelikler, şarkı kuyruğu eşleme, çalışmayan "AI toksisite" ayarı kaldırıldı'
    ]
  },
  {
    surum: '1.1.1',
    ad: 'Bekçi',
    tarih: '2026-10-23',
    notlar: [
      'Twitch/TikTok kopunca kendiliğinden yeniden bağlanır',
      'Puan ve seviye platforma göre ayrı',
      'İzleme süresi puanı, market TTS, bağış tutarı ve Trovo geçmişi düzeltmeleri'
    ]
  },
  {
    surum: '1.1.0',
    ad: 'Stüdyo',
    tarih: '2026-10-22',
    notlar: ['Overlay Stüdyo hizalama/yapışma, sohbet katmanı temizliği, 38 animasyon, çekiliş iyileştirmeleri']
  }
];

export const GUNCEL_SURUM = SURUMLER[0];
