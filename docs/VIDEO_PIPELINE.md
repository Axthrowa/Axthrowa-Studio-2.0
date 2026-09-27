# Video Hattı

> ADR-001: yakalama, sahne grafiği, GPU birleştirme ve kodlama **OBS sürecinde**. Bu belge hattın uçtan uca nasıl
> aktığını ve bizim hangi noktalarda denetim/ölçüm yaptığımızı tanımlar.

```
Kaynaklar (WGC/DXGI ekran, oyun kancası, dshow kamera/capture card, medya, tarayıcı)
   → OBS sahne grafiği (tuval başına) → GPU birleştirme (D3D11)
   → renk dönüşümü (NV12/P010, Rec.709/2100, tam/sınırlı) → kodlayıcı (NVENC/AMF/QSV/x264)
   → çıkışlar: kayıt (MKV/MP4/fMP4) · tekrar arabelleği · sanal kamera · YAYIN (→ Output Router → hedefler)
```

## 1. Kayıpsızlık ilkeleri (§145)

| İlke | Nasıl |
|---|---|
| Gereksiz kopya yok | Yakalama → doku → birleştirme → kodlayıcı OBS'te GPU üzerinde; uygulama ham kareye hiç dokunmaz |
| Bir kez kodla | Çoklu yayında Output Router paketleri **kopyalar** (`-c copy`), yeniden kodlamaz (Faz 3 ölçümü) |
| Gereksiz dönüştürme yok | Renk biçimi/aralığı OBS profilinde bir kez seçilir; uygulama yalnız doğrular |
| Yüksek kaliteli yerel ana kopya | Kayıt ayrı kodlayıcıyla (ör. NVENC HEVC/AV1 yüksek bit hızı, MKV) — OBS profili |
| Platforma uygun profil | Politika tablosu sınırları ([PLATFORM_CAPABILITY_MATRIX](PLATFORM_CAPABILITY_MATRIX.md)) |

## 2. Ölçüm (§34, §130)

Karışmaması gereken sayaçlar:

| Sayaç | Kaynak |
|---|---|
| Çizim (render) atlanan kare, ortalama kare çizim süresi | OBS `GetStats` |
| Çıkış (kodlayıcı) atlanan kare | OBS `GetStats` |
| Ağ nedeniyle düşen kare / yeniden bağlanma | OBS yayın durumu (tek hedef) · Output Router hedef ilerlemesi (çok hedef) |
| Hedef bit hızı, hız (speed), kare | FFmpeg `-progress` çıktısı (hedef başına) |

## 3. Kodlayıcı seçimi (§24–26)

Kodlayıcı seçenekleri OBS'in kurulu kodlayıcılarından okunur (profil parametreleri); desteklenmeyen kodlayıcı
seçilebilir gösterilmez. Hedefler farklı kodek gerektiriyorsa ortak payda (H.264) önerilir; çoklu kodlama OBS'in
çoklu iz / ek tuval çıkışlarıyla (ileri faz).
