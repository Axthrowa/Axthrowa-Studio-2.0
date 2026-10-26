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
    surum: '1.2.0',
    ad: 'Tek Sahne',
    tarih: '2026-10-26',
    notlar: [
      'Bot adı artık AxBot (uygulama adı StreamAxT)',
      "Tüm widget'lar tek OBS URL'sine eklenebilir; galeride \"Tek URL'ye ekle\" düğmesi",
      "Yeni Şarkı Klipleri widget'ı: !sr istekleri YouTube klibiyle OBS'te sırayla çalar",
      'Anket başlayınca tek URL katmanı kendiliğinden açılır; Kick panelinden başlatılan anket de görünür',
      "!sr, Yayın Yönetim Aracı'ndaki Spotify bağlantısıyla Spotify sırasına ekler",
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
