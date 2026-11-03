# 🚀 AxBoT: Tam Teşekküllü Multi-Platform Canlı Yayın Botu & Overlay Stüdyosu
> **Geliştirici:** Axthrowa  
> Beş büyük platform (**Kick, Twitch, YouTube, Discord, TikTok**) ile entegre çalışan canlı yayın asistanı.

---

## 🌟 Öne Çıkan Özellikler

### 1. 🔗 Evrensel Platform Entegrasyonu
- **Kick.com**: Pusher WebSocket ile canlı sohbet, takipçi, abone ve hediye abonelik akışı dinleme + Kick API ile mesaj gönderme.
- **Twitch.tv**: IRC WebSocket ve EventSub ile Bits, Abone, Raid ve canlı sohbet desteği.
- **YouTube Canlı**: LiveChat API ile canlı mesaj akışı ve SuperChat bildirimleri.
- **Discord**: Discord.js v14 gateway ile canlı yayın duyuruları ve iki yönlü sohbet köprüsü (Cross-Chat bridge).
- **TikTok Live**: Canlı yayın hediyeleri (Gifts), elmas değerleri ve canlı sohbet akışı.

### 2. 💬 Çapraz Sohbet Aktarımı (Cross-Chat Relay)
- Bir platformda (örn: Kick) yazılan mesajları anında diğer bağlı platformlara (Twitch, YouTube, Discord) `[KICK] Kullanici: Mesaj` formatında aktarır.

### 3. 🎨 OBS Overlay & Widget Stüdyosu
- **OBS AlertBox**: Takipçi, Abone, Bağış, Raid ve TikTok hediyeleri için sesli, GIF/video animasyonlu ve konfetili bildirim kutusu (`/widgets/alertbox`).
- **Canlı Sohbet Overlay (ChatBox)**: Kick yeşili, Twitch moru, YouTube kırmızısı gibi platform ikonlarıyla şeffaf OBS sohbeti (`/widgets/chatbox`).
- **Hedef Barı (Goal Widget)**: Takipçi ve abone hedeflerinizi gösteren canlı ilerleme çubuğu (`/widgets/goals`).
- **Çekiliş Çarkı (Wheel Widget)**: Çekilişlerde kazanan belirlenirken OBS ekranında yavaşlayarak dönen şans çarkı (`/widgets/wheel`).
- **OBS Ses & TTS Oynatıcı**: Şarkı istekleri ve sesli okumayı masaüstü sesi yakalamadan doğrudan OBS mikserine bağlar (`/widgets/audio-player`).

### 4. ⚡ Gelişmiş Komut & Değişken Motoru
- `$(user)`: Komutu kullanan kişi.
- `$(touser)`: Etiketlenen kişi veya kullanan kişi.
- `$(query)` / `$(args)`: Komutla birlikte yazılan argümanlar.
- `$(count)`: Her kullanımda otomatik artan sayaç.
- `$(uptime)`: Kesintisiz yayın süresi.
- `$(random.1-100)`: Rastgele sayı üretici.
- `$(puan)`: Kullanıcının sadakat puanı.
- `$(eval <matematik>)`: Güvenli matematiksel hesaplama.
- `$(urlfetch <link>)`: Dış API'lerden veri çekme.
- `$(sor <soru>)`: Gemini yapay zekasına soru sorma.

### 5. 🛡️ AutoMod & Yapay Zeka Koruması
- Aşırı büyük harf (Caps Lock) filtresi.
- Emoji ve sembol spamı sınırlayıcısı.
- Güvenli alan adı (Whitelist) kontrollü link engelleyici.
- Kelime ve küfür kara listesi.
- **Gemini 2.5 Flash Yapay Zeka Moderatörü**: İğneleyici lafları, taciz ve dolaylı nefret söylemini bağlamsal olarak tespit eder.

### 6. 🎵 Şarkı İsteği (Song Request)
- `!sr <şarkı adı veya YouTube linki>` ile kuyruğa ekleme.
- `!sarki` / `!song`: Çalan şarkıyı gösterme.
- `!atla` / `!voteskip`: Şarkıyı oylamayla veya mod yetkisiyle atlama.
- `!sira` / `!queue`: Sıradaki şarkıları listeleme.

### 7. 💰 Sadakat, Ekonomi & Mini Oyunlar
- Sohbette yazanlara her 5 dakikada bir otomatik puan dağıtımı.
- `!rulet <miktar / hepsi>`: %50 şansla puanları ikiye katlama.
- `!slot <miktar>`: Slot makinesi çevirme (3 simge eşleşmesinde 5x ikramiye).
- `!duello @kullanici <miktar>`: Başka bir izleyiciyle kılıç savaşı düellosu.
- `!8ball <soru>`: Sihirli küreye soru sorma.
- `!puan` ve `!liderlik`: Puan kontrolü ve Top 50 zenginler tablosu.

### 8. 🎁 Çekilişler & Hediye Dağıtımı
- `!katil` anahtar kelimesiyle katılım.
- Abonelere 2x / 3x / 5x bilet çarpanı avantajı.
- OBS Çarkı ile senkronize kazanan belirleme.

### 9. 🤖 Yapay Zeka Eş-Sunucu (Gemini Co-Host)
- Google Gemini 2.5 Flash ile izleyicilerin sorularına yayıncı kişiliğinize uygun akıllı, samimi ve canlı yanıtlar üretir (`!sor <soru>`).

---

## 🚀 Hızlı Başlangıç

### 1. Servisleri Başlatma
Proje kök dizininde:
```bash
npm run dev
```
- **Web Kontrol Paneli**: [http://localhost:5173](http://localhost:5173)
- **Sunucu & WebSocket Motoru**: [http://localhost:3001](http://localhost:3001)

### 2. OBS Tarayıcı Kaynağı (Browser Source) Ekleme
OBS Studio'da **Kaynaklar (+) -> Tarayıcı (Browser)** seçin ve aşağıdaki linkleri yapıştırın:
- **AlertBox**: `http://localhost:5173/widgets/alertbox` (Önerilen boyut: 800 x 600)
- **Sohbet (ChatBox)**: `http://localhost:5173/widgets/chatbox` (Önerilen boyut: 450 x 700)
- **Hedef Barı**: `http://localhost:5173/widgets/goals` (Önerilen boyut: 600 x 150)
- **Çekiliş Çarkı**: `http://localhost:5173/widgets/wheel` (Önerilen boyut: 600 x 600)
- **Ses & TTS Oynatıcı**: `http://localhost:5173/widgets/audio-player` ("Sesi OBS üzerinden kontrol et" kutucuğunu işaretleyin)

---

### 👨‍💻 Geliştirici
- **Geliştirici**: Axthrowa
- **AxBoT** © 2026. Tüm Hakları Saklıdır.
