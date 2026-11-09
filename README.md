# AxthrowA Studio

Canlı yayıncılar için Windows masaüstü kontrol merkezi. OBS Studio'yu yönetir; sohbeti, müziği, sahneleri, overlay'leri ve yayın botunu tek uygulamada toplar.

Geçerli sürüm: **1.6.13** (içinde AxBoT 1.13.13).

> OBS Studio pakete dahil değildir. Yayının kendisi kurulu OBS üzerinden yapılır; Studio OBS ile obs-websocket üzerinden konuşur.

## Neler yapar

- **OBS kontrolü:** sahne, ses, kayıt, sanal kamera, filtre ve Studio Mode işlemleri; OBS'e dock olarak eklenebilen paneller.
- **Birleşik sohbet:** Kick, Twitch ve YouTube mesajları tek listede; emote ve rozetler görsel olarak çizilir.
- **Yayın ekranları:** giriş, mola, çıkış, sohbet ve widget overlay'leri OBS tarayıcı kaynağı olarak eklenir.
- **Müzik (Resonance):** Spotify ve YouTube Music ile çalan parça, şarkı sözü ve karaoke görünümleri.
- **Yayın botu (AxBoT):** komutlar, uyarılar, puan sistemi, oyunlar, çekilişler ve moderasyon "Bot" sekmesinde gömülü çalışır.
- **Kısayol ve deste:** kısayollar ve kontrol destesi eylemleri OBS'e ve bota gider.
- **Yedekleme:** ayarlar ve veriler yedeklenip geri yüklenebilir.

## Teknoloji

- **Arayüz:** React 19, Vite, Tailwind CSS (`src/`)
- **Masaüstü ve yerel sunucu:** Tauri 2, Rust (`src-tauri/`)
- **Müzik:** Resonance (`resonance/`)
- **Bot:** AxBoT, Node.js ve Express ([ayrı depo](https://github.com/Axthrowa/AxBoT-Kick))

## Geliştirme

Gerekenler: Windows, Node.js 22.5 veya üzeri, Rust araç zinciri ve WebView2.

```bash
npm install
npm --prefix resonance install
npm run tauri:dev
```

Yalnız arayüz için `npm run dev` yeterlidir, ancak Tauri'ye bağlı özellikler tarayıcıda çalışmaz.

### Testler

```bash
npm test
npm --prefix resonance test
```

```bash
cd src-tauri && cargo test --lib
```

### Tam paket

Tam paket botu da içerir, bu yüzden AxBoT'un `Desktop\StreamAxT` klasöründe bulunması beklenir. Başka bir yerdeyse `scripts/streamaxt-hazirla.mjs` betiğine `--kaynak <klasör>` verin.

```bash
powershell -ExecutionPolicy Bypass -File scripts/build-release-signed.ps1
```

İmzalama adımı için `CN=Axthrowa` kod imzalama sertifikası gerekir. Çıktılar `cikti/` klasörüne yazılır ve depoya eklenmez.

## OBS'e ekleme

Studio çalışırken aşağıdaki adresleri 1920×1080 tarayıcı kaynağı olarak ekleyin:

| Ekran | Adres |
|---|---|
| Giriş | `http://127.0.0.1:8843/starting?obs=1` |
| Mola | `http://127.0.0.1:8843/brb?obs=1` |
| Çıkış | `http://127.0.0.1:8843/ending?obs=1` |
| Sohbet | `http://127.0.0.1:8843/chat?obs=1` |

## Belgeler

Mimari kararlar ve teknik notlar [`docs/`](docs) klasöründedir. Başlangıç için: [dağıtım kararı](docs/ADR-005-DAGITIM-VE-OZGUN-MOTOR.md), [OBS entegrasyonu](docs/ADR-006-OBS-STUDIO-ENTEGRASYONU.md) ve [bilinen sınırlar](docs/KNOWN_LIMITATIONS.md).

## Lisans

GNU GPL-2.0-or-later. Ayrıntı için [LICENSE](LICENSE), üçüncü taraf bileşenler için [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) dosyasına bakın. OBS Studio, OBS Project'in markasıdır; bu ürün onunla bağlantılı değildir.
