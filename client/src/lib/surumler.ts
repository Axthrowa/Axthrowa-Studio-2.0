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
