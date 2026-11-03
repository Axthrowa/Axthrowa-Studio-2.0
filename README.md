# Yayın Yönetim Aracı — Tauri Masaüstü

Eski HTML/JS arşivi: `legacy/`  
Yeni uygulama: Vite + React + Tauri 2 + Rust HTTP medya motoru

## Çıktı (hazır)

| Dosya | Açıklama |
|-------|----------|
| `cikti/Yayin Yonetim Araci_<sürüm>_x64-setup.exe` | NSIS kurulum (imzalı) |
| `cikti/portable/Baslat.bat` | Taşınabilir çalıştırma |
| `cikti/portable/YayinYonetimAraci.exe` | Ana exe (imzalı, optimize release) |

Yeniden paketleme + imzalama tek komut:

```bash
powershell -ExecutionPolicy Bypass -File scripts/paketle.ps1
```

## OBS Studio ile çalışma

Yayının kendisi (sahneler, kaynaklar, filtreler, kodlayıcılar, eklentiler) **kurulu OBS Studio'nun kendi
arayüzünde** yapılır. Bu uygulama OBS'e özel tarayıcı dock'u olarak eklenir ve OBS'i obs-websocket üzerinden yönetir.

1. Panel › **OBS Studio** sekmesi: OBS kurulumu, sürümü, açık/bağlı durumu.
2. **Bağlantı bilgisini OBS'ten al**: obs-websocket portu ve şifresi OBS'in kendi ayarından okunur
   (panelde şifre girilmemişse uygulama bunu kendiliğinden de kullanır).
3. **Seçilenleri OBS'e ekle** (OBS kapalıyken): sohbet, etkinlik akışı, hızlı eylemler, yayın bilgisi, kontrol
   merkezi, müzik, ses paneli ya da tüm panel OBS'in Docklar menüsüne yazılır (`%APPDATA%\obs-studio\user.ini`;
   ilk değişiklikte `user.ini.yya-yedek` yedeği alınır). Dock adresleri: `http://127.0.0.1:8843/dock?id=<kimlik>`.
4. Kısayollar, kontrol destesi, bot ve otomasyon eylemleri (sahne, ses, kayıt duraklat/böl, sanal kamera, filtre,
   Studio Mode geçişi, altyazı, medya, bas-konuş) OBS'e websocket üzerinden gider.

## Çalıştırma

1. `cikti\portable\Baslat.bat` veya kurulum exe
2. Control Panel açılır; sistem tepsisine küçültülebilir
3. OBS Browser Source URL’leri (`1920×1080`):
   - Giriş: `http://127.0.0.1:8843/starting?obs=1`
   - Çıkış: `http://127.0.0.1:8843/ending?obs=1`
   - Mola: `http://127.0.0.1:8843/brb?obs=1`
   - Chat: `http://127.0.0.1:8843/chat?obs=1`

## Birleşik sohbet

Kick + Twitch + YouTube **tek listede** akar — hem OBS katmanında hem panelin
"Canlı Chat" sekmesinde.

- Kanal alanları boşken Giriş ekranındaki sosyal hesap kullanıcı adları
  otomatik kullanılır (`autoDetect`).
- Kick: `chatroom_id` sunucu tarafında v2 → v1 → kanal sayfası zinciriyle
  çözülür (Cloudflare v2'yi engellediğinde de çalışır), ardından Pusher.
- Twitch: anonim IRC; canlılık yoklaması ve üstel geri çekilmeli yeniden bağlanma.
- YouTube: innertube polling; bekleme süresi sunucunun önerdiği `timeoutMs`
  değerinden gelir, yayın bitip yeniden başlarsa `videoId` kendiliğinden yenilenir.
- **Emote'lar görsel olarak** çizilir: Twitch `emotes` etiketi (kod noktası
  offsetleriyle), Kick `[emote:id:ad]` işaretleri, YouTube özel emoji'leri.
- **Sohbet rozetleri simge olarak**: Twitch'in gerçek rozet görselleri
  (`/api/twitch/badges` vekili üzerinden — CDN CORS göndermiyor), Kick ve
  YouTube sistem rozetleri için platform biçimli SVG simgeler.
- Her mesajın önünde platformun kendi logosu (Twitch / Kick / YouTube).
- Super Chat / üyelik / abonelik / raid olayları vurgulanır.
- Mesajlar tek animasyon karesinde toplu işlenir — yoğun sohbette render fırtınası olmaz.

## Müzik (Resonance)

Gömülü Resonance eklentisi `http://127.0.0.1:8843/resonance/` adresinden servis
edilir; panelin **Müzik** sekmesi de onu gömer.

**Spotify bağlama**

1. Spotify Dashboard'da bir uygulama aç, Client ID'yi kopyala.
2. Resonance > Bağlantılar > Müzik'te Client ID'yi yapıştır.
3. **Redirect URI** kutusundaki adresi kopyalayıp Spotify Dashboard >
   Settings > Redirect URIs listesine **birebir** ekle. Sunucu iki adresi de
   karşılar, Dashboard'da kayıtlı olanı seç:
   - `http://127.0.0.1:8843/resonance/callback` (varsayılan)
   - `http://127.0.0.1:8843/api/player/spotify/callback`
4. "Bağlan" — onay ekranı sistem tarayıcısında açılır, token değişimi
   uygulamada tamamlanır ve panel kendiliğinden güncellenir.

Adres kayıtlı değilse Spotify giriş sonrası
`redirect_uri: Not matching configuration` der; tek çözümü doğru adresi
Dashboard'a eklemektir.

## Özellikler

- Sınırsız video/ses: disk path + HTTP Range akışı (base64 yok, RAM'e alınmaz)
- Sürükle-bırak + merkez snap kılavuzları
- OBS WebSocket: sahne/geçiş listesi, süre, sayaçta geçiş, mic mute, Stop Stream
- BRB müzik + audio visualizer + outro jenerik scroll
- Ayarlar: `app-data/settings-*.json` (atomik yazma, yalnızca değişen ekran)

## Test

```bash
npm run typecheck                        # arayüz tip denetimi
npm test                                 # 26 arayüz birim testi (emote/rozet/ayrıştırma)
cd src-tauri && cargo test --release     # 33 birim + 10 entegrasyon testi
node scripts/stress-test.mjs             # uygulama açıkken canlı yük testi
```

Entegrasyon testleri gerçek HTTP sunucusunu ayağa kaldırır; masaüstü kabuğuna
gerek yoktur (Akıllı Uygulama Denetimi exe'yi engellediğinde de çalışır).
Arayüzü tarayıcıda denemek için:

```bash
cd src-tauri && cargo test --release --test server_api -- --ignored serve_portable --nocapture
```

## Geliştirme

```bash
npm install
npm run tauri:dev
```

Windows WDAC bazen `cargo` build-script’lerini engeller (os error 4551).  
Çözüm: `CARGO_TARGET_DIR` olarak izinli bir temp path kullanın (bkz. `ex.md`).

Docker: `docker/docker-compose.yml` (Linux CI toolchain).

## İmza

axthrowa — 2026-09-05

## Lisans

Bu ürünün tamamı (panel `src/`, `src-tauri/`, betikler) **GNU GPL-2.0-or-later** ile
lisanslanır — bkz. [LICENSE](LICENSE) ve karar kaydı [ADR-005](docs/ADR-005-DAGITIM-VE-OZGUN-MOTOR.md). Üçüncü taraf
bileşenlerin lisansları `THIRD_PARTY_NOTICES.txt` dosyasındadır (`node scripts/ucuncu-taraf-bildirimleri.mjs` üretir;
sürüm derlemesi pakete koyar). İkili dağıtılırken kaynak kodu da sunulmalıdır.

OBS Studio, OBS Project'in markasıdır; bu ürün onunla bağlantılı değildir. Uygulama kullanıcının kurulu OBS Studio'suyla
obs-websocket üzerinden konuşur; OBS bu pakete dahil değildir. Karar: [ADR-006](docs/ADR-006-OBS-STUDIO-ENTEGRASYONU.md).

