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
