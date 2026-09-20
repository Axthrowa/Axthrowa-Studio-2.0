# Yayın Yönetim Aracı

Kick, YouTube ve Twitch benzeri platformlar için yayın bilgilerini (başlık,
açıklama, kategori, etiketler, kapak görseli, planlama vb.) tek bir yerden
girmenizi sağlayan yerel bir araç.

## Kullanım

`index.html` dosyasını tarayıcıda açmanız yeterlidir, kurulum ya da sunucu
gerekmez. Tüm veriler (taslak, geçmiş, şablonlar, ayarlar) yalnızca
tarayıcınızın `localStorage`'ında tutulur.

- **Genel Bilgiler**: başlık, açıklama, etiketler, dil, planlanan tarih/saat, kapak görseli.
- **Platforma Özel Ayarlar**: Twitch / YouTube / Kick sekmelerinde her platforma özgü alanlar (kategori, gizlilik, yetişkin içerik vb.).
- **Önizleme**: her platform için biçimlendirilmiş metin çıktısı; "Panoya Kopyala" ile ilgili platformun kendi panelinde kullanılmak üzere kopyalanabilir.
- **Yayınla / Tümünü Yayınla**: şu an API bağlı olmadığı için otomatik olarak panoya kopyalar ve bilgilendirme gösterir (bkz. aşağıdaki genişletme notu).
- **Geçmiş**: kaydedilen önceki yayın bilgilerini listeler, tekrar yüklenebilir veya silinebilir.
- **Şablonlar**: sık kullanılan yayın formatlarını isimlendirip kaydedin, tek tıkla forma yükleyin.
- **Ayarlar**: ileride API entegrasyonu için platform anahtar/token alanları (şu an yalnızca yerel olarak saklanır, hiçbir yere gönderilmez).
- **Dışa/İçe Aktar**: tüm geçmiş, şablon ve ayarları JSON dosyası olarak yedekleyin veya geri yükleyin.

## OBS Giriş / Çıkış Ekranı

`obs-giris-ekrani.html` (giriş) ve `obs-cikis-ekrani.html` (outro) sayfaları
aynı altyapıyı kullanır: animasyonlu parçacıklı arka plan, logo, başlık,
sosyal medya rozetleri ve kendi video / YouTube arka planı.

- **Giriş**: geri sayım + süre dolunca "CANLI YAYINDA" rozeti.
- **Çıkış**: varsayılan "YAYIN BİTTİ" / teşekkür metni + "YİNE GÖRÜŞÜRÜZ"
  rozeti; isteğe bağlı geri sayım da eklenebilir.
- Arka plan stili olarak **Kendi Videom** seçip video dosyası yükleyebilirsiniz
  (giriş → `media/bg-video.mp4`, çıkış → `media/outro-bg-video.mp4`).
- Ayarlar ayrı tutulur: giriş `ygy_obs_settings` / `obs-settings-data.json`,
  çıkış `ygy_obs_outro_settings` / `obs-outro-settings-data.json`.
- **OBS'e eklemek için**: *Kaynaklar → Ekle → Tarayıcı Kaynağı*, ilgili
  sayfanın `?obs=1` URL'sini yapıştırın. Önerilen boyut: 1920×1080.
  - Giriş: `http://localhost:8843/obs-giris-ekrani.html?obs=1`
  - Çıkış: `http://localhost:8843/obs-cikis-ekrani.html?obs=1`

## OBS Red Dragon Geçişi (Stinger Transition)

Discord `intro.webm` + `loop.webm` referans alınarak üretilen 1920×1080 stinger.

**Dosyalar**
- `media/discord-red-dragon/intro.webm` / `loop.webm` — Discord referans
- `media/discord-red-dragon/stinger-1920x1080.webm` — OBS stinger (siyah zemin)
- `media/discord-red-dragon/stinger-1920x1080-alpha.webm` — alpha varyant
- Yeniden üretmek: `scripts/build-red-dragon-stinger.ps1`

**Timeline**
- 0–3.5s: intro (ejderha sağ üstten, alev)
- **Geçiş noktası: 3000 ms**
- loop idle stinger’a eklenmez (ekran açık kalmasın diye)

**OBS**
1. Stinger Geçişi → `stinger-1920x1080.webm`
2. Transition point: **3000 ms**
3. Duration: **3500–3800 ms**

Önizleme: `Sunucuyu-Baslat.bat` → `obs-dragon-transition.html`

## Gerçek API entegrasyonuna genişletme

`app.js` içindeki `PlatformAdapters` nesnesi, her platform için `format()`
(önizleme metni) ve `publish()` (yayınlama) fonksiyonlarını içerir.
Şu anda `publish()` fonksiyonları kasıtlı olarak `not_implemented` hatası
fırlatır ve arayüz bunu yakalayıp panoya kopyalama ile telafi eder.

Gerçek entegrasyon eklemek için:

1. `openSettingsModal()` üzerinden her platform için API anahtarı/OAuth
   token alanları zaten hazır — kullanıcı bunları girip yerel olarak
   saklayabilir (`ygy_settings` anahtarı altında).
2. İlgili `publish(entry, settings)` fonksiyonunun içini gerçek bir
   `fetch()` çağrısıyla değiştirin:
   - **Twitch**: Helix API, `PATCH /channels` (Modify Channel Information).
   - **YouTube**: YouTube Data API v3, `liveBroadcasts.insert` / `update`.
   - **Kick**: Kick'in genel/kanal API'si üzerinden kanal bilgisi güncelleme.
3. OAuth akışları (özellikle Twitch ve YouTube) tarayıcı tarafında güvenli
   şekilde yürütülemeyeceğinden, gerçek token alışverişi için küçük bir
   backend/proxy eklemeniz önerilir; bu arayüz o backend'e istek atacak
   şekilde güncellenebilir.

## Dosyalar

- `index.html` — arayüz yapısı
- `style.css` — karanlık tema, platform renkleriyle uyumlu tasarım
- `app.js` — form durumu, depolama, adaptör mimarisi, olay yönetimi
- `obs-giris-ekrani.html`, `obs-cikis-ekrani.html`, `obs-style.css`, `obs-app.js` — OBS giriş/çıkış ekranları
- `obs-dragon-transition.html` — ejderha alev sahne geçiş animasyonu (Stinger)
