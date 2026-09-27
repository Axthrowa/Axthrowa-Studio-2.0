# Çoklu Yayın Mimarisi (Output Router)

> ADR-001'e göre görüntü OBS'te **bir kez** kodlanır; Output Router kodlanmış paketleri yeniden kodlamadan birden çok
> hedefe dağıtır ("ONE ENCODE → MULTIPLE DESTINATIONS", §29). Hedefler birbirinden bağımsız başlar, durur, düşer ve
> yeniden bağlanır (§27, §86).

## 1. Veri yolu

```
OBS (tek yayın çıkışı, Custom servis)
   │ rtmp://127.0.0.1:<rastgele port>/live/<rastgele anahtar>     ← yalnız loopback
   ▼
FFmpeg ALICI  (-listen 1 … -c copy -f flv pipe:1)       — RTMP protokolü FFmpeg'de
   │ FLV bayt akışı (stdout)
   ▼
ÇOĞALTICI (Rust, tokio)                                  — FLV etiket ayrıştırıcı
   │  önbellek: FLV başlığı, onMetaData, video/ses dizi başlıkları
   │  hedef başına sınırlı kuyruk (≈10 sn); dolarsa bir sonraki anahtar kareye kadar atla
   ├──► FFmpeg YAYINCI #1 (-f flv -i pipe:0 -c copy -f flv rtmps://…)  ─► Twitch
   ├──► FFmpeg YAYINCI #2                                              ─► Kick
   └──► FFmpeg YAYINCI #3                                              ─► YouTube / Özel RTMP(S)
```

- **Geç katılma / yeniden bağlanma:** hedefe önce FLV başlığı + metadata + dizi başlıkları yazılır, ilk **anahtar
  kareden** itibaren akış başlar; zaman damgaları hedef başına yeniden tabanlanır (ilk anahtar kare = 0).
- **Dizi başlıkları** yayın ortasında gelirse (kodlayıcı yeniden yapılandırması) hem önbelleğe hem çalışan hedeflere
  iletilir.
- **Enhanced RTMP/FLV** (HEVC, AV1): `ExVideoTagHeader` (0x80 biti) ayrıştırılır; `SequenceStart` = dizi başlığı,
  `CodedFrames/CodedFramesX` + frameType 1 = anahtar kare.
- **Yavaş hedef** diğerlerini bekletmez: kuyruğu dolan hedef "Uyarı" durumuna geçer ve bir sonraki anahtar kareye kadar
  paket düşürür; diğer hedefler etkilenmez.

### Kanıt (Faz 3, 2026-09-25, yerel ölçüm)

Kaynak: FFmpeg `testsrc2` 640×360@30 + AAC (OBS yerine), hedefler: yerel RTMP dinleyicileri. Python prototipi
(Rust modülünün mantığı):

| Senaryo | Sonuç |
|---|---|
| `tee` ile 2 hedef, 8 sn | her hedef 240 kare, yeniden kodlama yok — ancak tek hedef bağımsız durdurulamıyor → reddedildi |
| Hedef A baştan, 5. sn'de **tek başına durduruldu** | 190 kare, çözme hatası 0 |
| Hedef B 3. sn'de **geç katıldı** | 120 kare (anahtar kareden başladı), ses var, çözme hatası 0 |
| İlk denemedeki hata | dizi başlıkları yalnız önbelleğe yazılıp çalışan hedefe iletilmiyordu → düzeltildi (yukarıdaki kural) |

## 2. Hedef durum makinesi

```
Disabled ─enable─► Ready ─start─► Connecting ─ilk ilerleme─► Live
   ▲                 ▲                │                      │  │
   │                 │             hata/zaman aşımı       uyarı  hata
   │                 │                ▼                      ▼  ▼
   └──disable── Stopped ◄─stop── Reconnecting ◄──────── Warning  │
                                      │ (üstel geri çekilme: 2,4,8…60 sn)
                                      └─ ardışık 10 başarısızlık ─► Failed ─retry─► Connecting
```

| Durum | Anlamı |
|---|---|
| `Disabled` | kullanıcı kapattı; GO LIVE ile başlamaz |
| `Ready` | yapılandırma geçerli, anahtar kasada |
| `Connecting` | yayıncı süreci başladı, henüz ilerleme yok |
| `Live` | ilerleme akıyor (kare, bit hızı) |
| `Warning` | canlı ama sağlık bozuk (hız < 0.97, kuyruk dolu, paket düşürme) |
| `Reconnecting` | süreç düştü; geri çekilmeyle yeniden deneniyor |
| `Failed` | tekrar denemeleri tükendi; kullanıcı eylemi gerekir |
| `Stopped` | kullanıcı durdurdu (yayın sürerken) |

Bir hedefin hatası diğerlerini ASLA durdurmaz. "Hepsini bitir" ayrı ve onaylı eylemdir (§87).

## 3. GO LIVE akışı (§85)

1. Yayın öncesi kontrol listesi ([PLATFORM_CAPABILITY_MATRIX](PLATFORM_CAPABILITY_MATRIX.md) politika kuralları):
   FFmpeg bulundu mu, OBS bağlı mı, kodlayıcı/çözünürlük/bit hızı her hedefin sınırında mı (Kick: H.264, ≤ 8000 kbps
   CBR, ≤ 1080p60; Twitch kalite eşitliği; anahtar kare 2 sn), anahtarlar kasada mı, platform kuralı uyarıları.
2. Alıcı başlatılır (rastgele port + anahtar), OBS'in yayın servisi alıcıya yönlendirilir (önceki servis ayarı saklanır,
   çoklu yayın kapatılınca geri yüklenir).
3. OBS yayını başlatılır; alıcı ilk anahtar kareyi aldığında etkin hedefler sırayla başlatılır.
4. Her hedef `Live` olduğunda bildirilir; en az biri canlıysa genel durum LIVE, hiçbiri değilse uyarı.
5. Yayın sürerken hedef başına durdur/başlat serbest.

## 4. Güvenlik ve gizlilik

- Yayın anahtarları **Windows Kimlik Yöneticisinde** (keyring); API yalnız `hasKey` döner, anahtar asla geri okunmaz,
  günlüğe ve WebSocket'e yazılmaz. Hata metinlerindeki URL'ler maskelenir.
- Alıcı yalnız 127.0.0.1'e bağlanır, her oturumda rastgele port ve anahtar kullanır.
- Hedef URL doğrulaması: yalnız `rtmp://` ve `rtmps://`; platform ön ayarlarında resmi sunucular (Kick: RTMPS zorunlu).
- FFmpeg paketlenmez (GPL); sistemde (PATH) ya da uygulamanın yt-dlp için indirdiği kopyada bulunur.

## 5. Sınırlar ve sonraki adımlar

| Konu | Durum |
|---|---|
| Farklı kodek gerektiren hedefler (YouTube AV1 + Kick H.264) | Tek kodlama ortak paydada (H.264). Çoklu kodlama → OBS çoklu iz/ek tuval çıkışlarıyla (Faz 9+) |
| Dikey tuval hedefleri | OBS ek tuval çıkışı gerekir (Faz 10) |
| Bulut aktarımı (tek yükleme + sunucuda dağıtım) | Faz 15: aynı durum makinesi, "hedef" = bulut alıcısı |
| SRT alıcı/çıkış | FFmpeg destekler (`srt://`); arayüz Faz 15 |
| Uyarlanabilir bit hızı | OBS dinamik bit hızı (çoklu iz video) + histerezis kuralları, Faz 17 |
