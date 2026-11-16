# Resonance

Spotify / YouTube Music now-playing widget — **AxthrowA Studio** içinde gömülü.

Ayrı bir pencere açmak gerekmez: panelin üst çubuğundaki **Müzik** sekmesi bu
uygulamayı aynı origin’den `iframe` ile gösterir. Kaynak seçimi, bağlantı
durumu ve oynat/duraklat/ileri/geri kontrolleri sekmenin solundaki şeritten
yönetilir.

## URL’ler (uygulama açıkken)

- Uygulama: http://127.0.0.1:8843/resonance/
- Resonance’ın kendi OBS overlay’i: http://127.0.0.1:8843/resonance/overlay
- Spotify callback: **http://127.0.0.1:8843/api/player/spotify/callback**

Spotify Developer Dashboard > Settings > Redirect URIs listesine callback
adresini ekleyin. Spotify artık `localhost` kabul etmiyor; adres `127.0.0.1`
olmalı.

Yetkilendirme host (Rust) tarafında tamamlanır: PKCE doğrulayıcı orada tutulur,
onay sistem tarayıcısında verilir ve token değişimi yine host’ta yapılır.
Tarayıcı `sessionStorage`’ına bağımlı olmadığı için onayı hangi tarayıcının
verdiği fark etmez.

## Ortak “şu an çalan”

Rust tek bir kayıt tutar ve panel, Resonance ve overlay ekranları onu okur:

- `GET /api/now-playing` — anlık görüntü (boşsa `null`)
- `POST /api/now-playing` — Resonance köprüsü YouTube Music soketinden gelen
  durumu buraya yazar; Spotify’ı Rust kendisi yoklar
- `GET /api/player/status` — kaynak + bağlantı durumları
- `POST /api/player/command` — `play` / `pause` / `playPause` / `next` / `previous`

Bu yüzden OBS’te ayrı bir Resonance kaynağı eklemek zorunlu değil: Giriş / Mola
/ Çıkış ekranlarındaki sürükle-bırak **Şimdi Çalıyor** widget’ı aynı veriyi
gösterir.

## Geliştirme

```bash
cd resonance
npm install
npm run build
```

Kök projeden: `npm run build:resonance` veya `npm run build:all`.
`scripts\paketle.ps1` çıktıyı `cikti\portable\resonance\dist` altına aynalar.
