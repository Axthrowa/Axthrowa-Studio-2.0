# Kodlayıcı Yaşam Döngüsü Tasarımı

> Girdiler: `STREAMELEMENTS_CORE_AUDIT.md` §7–8 (kaynak kodu), OBS 31–32 sürüm notları (`CONFIRMED_OFFICIAL_DOCS`),
> kendi yönlendiricimizin ölçümleri (`PERFORMANCE_REPORT.md`). Kanıt sınıfları her satırda.

## 1. Bugün (uygulanan)

| Konu | Bizde | Kanıt |
|---|---|---|
| Kodlayıcı nerede | **OBS'te tek kodlayıcı** (profilde NVENC/x264/AMF/QSV); uygulama kodlayıcı oluşturmaz | `EXISTING` |
| Çoklu hedef | OBS tek çıkış → yerel alıcı → Rust FLV çoğaltıcı → hedef başına FFmpeg `-c copy` (yeniden kodlama yok) | `IMPLEMENTED` (5ce161d) |
| Paylaşım kararı | tüm hedefler aynı kodlanmış akışı alır; platform kuralları (`policy.rs`) uyumsuzluğu uyarı/engel olarak gösterir | `IMPLEMENTED` |
| Geç katılma | önbellekli dizi başlıkları + ilk anahtar kareden başlatma, hedef başına zaman çizelgesi | `IMPLEMENTED`, testli |
| Yavaş hedef | kuyruğu dolunca bir sonraki anahtar kareye kadar atlanır (yarım GOP gönderilmez) | `IMPLEMENTED`, testli (mutasyonla doğrulandı) |
| Durdurma | stdin kapatılır, 3 sn beklenir, sonra öldürülür (son ~2 sn korunur) | `IMPLEMENTED`, testli |
| Kodlayıcı ayarlarını okuma | OBS profil dosyalarından (kodek, bit hızı, kontrol, anahtar kare, çözünürlük, FPS); yayın anahtarı dosyası hiç açılmaz | `IMPLEMENTED` |

## 2. SE.Live'dan öğrenilenler (`CONFIRMED_PUBLIC_SOURCE`)

| Kalıp | Açıklama | Bizim için |
|---|---|---|
| Şablon + tembel sağlayıcı | kodlayıcı tanımı saklanır, **ilk tüketici** gelince oluşturulur, **son tüketici** gidince bırakılır | eklenti fazında aynı ilke (§3) |
| Tüketici sayımı | tek kilit altında `+1 / −1`; oluşturma yalnız ilk, bırakma yalnız son tüketicide | CORE-865 hatası: "tüketici başına bırakma" → tek edinmeye karşı çok bırakma |
| Özellik önbelleği | temel özellikler (çözünürlük, kodek) önbelleğe alınır; UI sorgusu kodlayıcı yaratmaz | UI'nin kodlayıcıyı "dokunarak" oluşturmasını engelle |
| Dış kodlayıcı referansı | OBS'in kendi kodlayıcısı yalnız referansla kullanılır, sahiplik OBS'te | OBS yayın kodlayıcısına dokunmamamızın gerekçesi |
| Bilinmeyen biçim → NV12 | kodlayıcının beklemediği video biçimi düzeltilir | platform kurallarında renk biçimi denetimi (ileride) |
| Çok izli video | tek çıkışa birden fazla video kodlayıcı (`set_video_encoder2`) | Twitch Gelişmiş Yayın / Dual Format için OBS'in yerel yolu |

## 3. Hedef tasarım (sonraki fazlar)

```
Tuval (OBS canvas)
   │
   ├── Kodlama profili P1 (H.264 1080p60 6 Mbps, 2 sn GOP) ──► kodlayıcı K1 (tembel, tüketici sayımlı)
   │                                                          ├── Hedef Twitch
   │                                                          ├── Hedef Kick
   │                                                          └── Yerel alıcı → yönlendirici (bugünkü yol)
   └── Kodlama profili P2 (AV1 1440p60) ─────────────────────► kodlayıcı K2 → Hedef YouTube
```

**Paylaşılabilirlik anahtarı** (yalnız çözünürlük değil): `tuval + çözünürlük + FPS + kodek + profil + seviye +
hız denetimi + bit hızı + anahtar kare aralığı/GOP + piksel biçimi + renk uzayı/aralığı + HDR/SDR`. Anahtarı aynı iki
hedef aynı kodlayıcıyı paylaşır; ses ayrıca (iz) seçilir.

**Kurallar**
1. Kodlayıcı yalnız bir çıkış onu gerçekten başlatınca oluşturulur; önizleme/UI sorguları oluşturmaz.
2. Tüketici sayımı tek kilit altında, edinme/bırakma simetrik; sayaç negatife düşerse hata günlüğü + test.
3. Etkin kodlayıcının profili değiştirilemez — önce tüketiciler durur (SE'nin "etkinken değiştirilemez" kuralı).
4. Donanım oturum sınırı (tüketici NVENC eşzamanlı oturum sınırı sürücüye göre değişir — `UNVERIFIED`, sürücüden
   okunmalı) aşılacaksa çıkış başlamadan uyarı; mevcut canlı hedefler etkilenmez.
5. Kodlayıcı hatası yalnız ona bağlı hedefleri `FAILED` yapar; diğer kodlayıcılar sürer.

## 4. Neden bugün kendi kodlayıcı yöneticimiz yok

Tek kodlama + paket dağıtımı, en katı platform kuralına uyan tek profil ile tipik 2–3 hedefli kullanımı karşılıyor
ve ölçülen maliyet düşük (`PERFORMANCE_REPORT.md`). Hedef başına farklı profil (P2) OBS içinde kodlayıcı ve çıkış
oluşturmayı gerektirir; bu obs-websocket 5.7 ile mümkün değil (çıkış/kodlayıcı oluşturma isteği yok — protokol
belgesi `CONFIRMED_OFFICIAL_DOCS`) ve libobs'a bağlanan bir eklenti ister → lisans kararı
`LICENSE_AND_DEPENDENCY_REVIEW.md` §4, mimari karar `STREAMING_ENGINE_DECISION.md` ADR-002.
