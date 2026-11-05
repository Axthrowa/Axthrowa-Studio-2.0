# AxBoT

Kick odaklı, çok platformlu canlı yayın botu ve OBS overlay stüdyosu. Kendi bilgisayarınızda çalışır ve tarayıcıdan yönetilir. Tek başına kullanılabilir; [AxthrowA Studio](https://github.com/Axthrowa/Axthrowa-Studio) içinde de "Bot" sekmesi olarak gömülü çalışır.

Geçerli sürüm: **1.13.9**.

## Neler yapar

- **Platformlar:** Kick, Twitch, YouTube, Discord, TikTok ve Trovo; sohbet, takip, abonelik ve hediye olayları.
- **Canlı sohbet:** tek ekranda çoklu sohbet ve platformlar arası mesaj aktarımı.
- **OBS overlay'leri:** uyarı kutusu, sohbet, hedefler, çark, anket, kelime bulutu, müzik ve daha fazla widget; tek adresle ya da ayrı ayrı eklenebilir.
- **Komutlar:** özel ve yerleşik komutlar, değişkenler, zamanlayıcılar, otomasyon kuralları ve sesli komutlar.
- **Müzik:** `!sr` ile şarkı isteği, kuyruk, oylama ve Spotify bağlantısı; karaoke görünümü için Resonance.
- **Etkileşim:** puan ve market, chat oyunları, Bil Bakalım, çekilişler, anketler, tahminler ve subathon.
- **Bağışlar:** BynoGame ve Ko-fi bildirimleri, bağış uyarıları ve TTS.
- **Moderasyon:** otomatik filtreler, kalkan modu, denetim kaydı ve Gemini destekli yapay zekâ özellikleri.

## Teknoloji

- **Sunucu:** Node.js 22.5 veya üzeri, Express, ws, yerleşik `node:sqlite` (`server/`)
- **Panel ve widget'lar:** React 19, Vite, Tailwind CSS 4 (`client/`)
- **Müzik:** Resonance (`resonance/`)

## Kurulum

```bash
npm install
npm --prefix resonance install
npm run dev
```

- Panel: `http://localhost:5173`
- Sunucu ve WebSocket: `http://localhost:3001`

Platformları panelin **Bağlantılar** sayfasından bağlayın. Veriler, sunucunun çalıştığı klasördeki `data/` altında tutulur ve depoya eklenmez.

### Derleme

```bash
npm run build
npm start
```

Derlenmiş panel `http://localhost:3001` adresinden sunulur.

### Testler

```bash
npm --prefix server exec vitest run
npm --prefix client exec vitest run
```

## OBS'e ekleme

**Overlay Stüdyo** sayfası adresleri hazır verir. Tek bir tarayıcı kaynağı için 1920×1080 **Tek URL**'yi, ayrı kaynaklar için widget adreslerini kopyalayın. Örnek: `http://localhost:3001/widgets/alertbox`.

## Bağış bildirimleri

Bağış siteleri bilgisayarınıza doğrudan ulaşamaz, bu yüzden bir tünel gerekir:

```bash
cloudflared tunnel --url http://localhost:3001
```

Verilen https adresini **Puan & Bağış → Bağış & JumpScare** sayfasına kaydedin ve panelin gösterdiği adresi bağış sitesine yapıştırın.

Adres gizli anahtar taşır; kimseyle paylaşmayın. Tünelden yalnız iki bağış ucuna ulaşılır. Tünelin Host başlığını `localhost` yapan ayarını açmayın, yoksa API'nin tamamı internete açılır.

## Güvenlik

- Sunucu varsayılan olarak yalnız bu bilgisayardan erişilecek şekilde çalışır.
- `.env`, `data/` ve veritabanı dosyalarını depoya eklemeyin.

## Lisans

© 2026 Axthrowa. Tüm hakları saklıdır.
