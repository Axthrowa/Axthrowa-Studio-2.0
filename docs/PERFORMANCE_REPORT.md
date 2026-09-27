# Performans Raporu — Çoklu Yayın Yönlendiricisi

Ölçüm tarihi: 2026-09-26. Tüm sayılar bu makinede **gerçekten ölçüldü**; tahmin ya da örnek veri yok.

## Düzenek

| | |
|---|---|
| Makine | Windows 11 Pro 26200, 12 mantıksal çekirdek. **Not:** kullanıcı aynı anda bilgisayarı kullanıyordu (tam ekran oyun olabilir); sayılar yön göstericidir, laboratuvar ölçümü değildir. |
| Yazılım | `headless_server` **release** derlemesi (panel sunucusunun masaüstü penceresi olmadan çalışan hâli), FFmpeg 9.0.1 (gyan.dev full build) |
| Kaynak | Önceden kodlanmış 10 sn klip: 1920×1080 @ 60 fps, H.264 ~6,3 Mbps + AAC 160 kbps (toplam ~6,45 Mbps), `-re -stream_loop -1 -c copy` ile döngü — kaynak tarafında yeniden kodlama **yok** |
| Hedefler | N adet yerel `ffmpeg -listen 1 … -f null -` dinleyicisi (yalnız 127.0.0.1, diske yazmaz) |
| Pencere | 8 sn ısınma + 30 sn ölçüm; CPU = süreç işlemci zamanı farkı ÷ duvar saati (tek çekirdeğin yüzdesi) |
| Betik | `scratchpad/perf/olc.py` (oturumu açar, ölçer, kapatır, hedefleri siler) |

## Sonuçlar

| Hedef sayısı | Yönlendirici (fan-out) CPU / RAM | Alıcı (ingest FFmpeg) CPU | Yayıncı başına CPU / RAM | **Toplam CPU / RAM** | Hedef başına sonuç |
|---|---|---|---|---|---|
| 1 | %0,8 / 19,0 MB | %5,1 | %22,0 / 22,9 MB | **%27,9 / 66,5 MB** | 6445 kbps, 60,97 fps, hız 1,02×, 0 düşen, 0 hata |
| 3 | %1,1 / 18,6 MB | %5,5 | %26,4 / 22,9 MB | **%85,9 / 111,5 MB** | 3/3 canlı, ~6459 kbps, ~60,9 fps, 1,02×, 0 düşen |
| 5 | %3,3 / 20,0 MB | %4,9 | %30,3 / 23,1 MB | **%159,8 / 159,9 MB** | 5/5 canlı, ~6459 kbps, ~60,9 fps, 1,02×, 0 düşen |

(CPU yüzdeleri tek çekirdeğe göredir: %159,8 ≈ 1,6 çekirdek ≈ 12 çekirdekli makinenin ~%13'ü.)

### Referans: yönlendirici olmadan

Aynı klip doğrudan tek bir dinleyiciye (`ffmpeg … -c copy -f flv rtmp://…`): gönderen FFmpeg **%21,8** tek çekirdek,
22,4 MB; dinleyici %4,8. Yani hedef başına ~%22'lik maliyet **FFmpeg'in RTMP çıkışının kendisine** aittir; bizim
yayıncımız (`-f flv -i pipe:0 -c copy … rtmp://…`) aynı maliyeti taşır. Yönlendiricinin (FLV ayrıştırma, anahtar kare
önbelleği, hedef başına zaman çizelgesi, fan-out) eklediği pay 1–5 hedefte tek çekirdeğin **%1–3'ü**, ~19 MB.

## Yorum

- **Doğrusal ölçekleme:** her hedef ~%22–30 tek çekirdek + ~23 MB ekler. Yayıncı başına maliyetin N ile hafif artışı
  (22 → 30) paylaşılan makine yükünden (N dinleyici + kullanıcının kendi işi) kaynaklanıyor.
- **Kodlama maliyeti yok:** tek kodlama OBS'te yapılır; çoklu yayın ek kodlayıcı açmaz. OBS'in kendi çoklu çıkış
  eklentileriyle her hedef için ayrı x264 kodlaması yapılsaydı maliyet hedef başına çekirdekler mertebesinde olurdu.
- **Kalite:** ölçülen tüm koşularda hiçbir hedefte kare düşmedi, hız 1,02× (gerçek zaman), bit hızı kaynağa eşit.
- **Olası iyileştirme:** FFmpeg yayıncısı yerine yerel (Rust) RTMP yayıncısı hedef başına ~%20'lik payı düşürebilir.
  Bugünkü seviye tipik 2–3 hedefli kullanım için kabul edilebilir bulundu; KNOWN_LIMITATIONS.md §5.

## Ölçülmeyenler

- **Uçtan uca gecikme** (OBS → platform izleyicisi): gerçek platform olmadan anlamlı ölçülemez; yönlendirici
  kareleri tamponlamaz (anahtar kare önbelleği yalnız geç katılan hedefin ilk karesi içindir).
- **Gerçek ağ koşulları** (paket kaybı, yavaş hedef): kopan/geç açılan hedefin diğerini etkilemediği ve geri bağlandığı
  uçtan uca testte doğrulandı. Yavaş hedefin kuyruğu dolunca bir sonraki anahtar kareye kadar düşürülmesi birim testli
  (`yavas_hedef_anahtar_kareye_kadar_atlanir_digeri_etkilenmez`: yavaş hedef ara kare almaz, anahtar karede devam
  eder, düşmeler sayılır, hızlı hedef tüm kareleri alır; düşürme satırı bozulunca test başarısız oluyor), ancak bant
  genişliği kısıtlı gerçek bir ağda ölçülmedi.
- **Panel arayüzü:** ana JS paketi 1292 kB (bu turdan önce de 1200 kB uyarı sınırının üstündeydi); Kontrol Merkezi
  tembel yüklenen ayrı ~30 kB parça.

## Mikro ölçümler (uçtan uca testler)

`src-tauri/tests/multistream_e2e.rs` gerçek FFmpeg ile (platform yok):
- `tek_kodlama_iki_hedef_bagimsiz_baslat_durdur`: A baştan, B geç katılır; A yayın sürerken tek başına durur, B canlı
  kalır; B kaynağın sonuna kadar ≥ 120 kare alır (zarif kapanış öncesinde son ~2 sn kayboluyordu), iki çıktıda da
  0 çözme hatası (geç katılan hedefe dizi başlığı + anahtar kare kuralı).
- `dusen_hedef_digerini_etkilemez_ve_geri_baglanir`: B'nin sunucusu başta yok; A etkilenmez, B sunucu gelince geri
  bağlanır.

## Yerel yayın çekirdeği (ADR-003) — 2026-09-26

Düzenek: `yayin-motoru sinama` (sentetik kaynaklar), Ryzen 5 7500F (12 mantıksal çekirdek), RTX 5070, 32 GB.
Yük: ana tuval 1920×1080@60 + dikey tuval 1080×1920@60; kaynaklar renk ×2, yazı, **720p60 H.264 test videosu (yazılımla
çözülür)** — aynı video iki tuvalde; 2 NVENC H.264 kodlayıcı (6000 + 3500 kbps CBR) + AAC; 4 RTMP hedefi (3 canlı,
1 kapalı porta) + MKV kayıt (yatay kodlayıcıyı paylaşır); sınama boyunca önizleme dönüşümü açık. Örnekleme: 1 sn, 37 örnek.

| Ölçüt | Değer |
|---|---|
| Çekirdek CPU (tek çekirdeğin yüzdesi) | ort. %45, en çok %80 (toplam CPU'nun ~%4'ü) |
| Çekirdek bellek (çalışma kümesi) | ort. 279 MB, en çok 462 MB |
| NVENC oturumu | 2 (tuval başına bir; hedefler ve kayıt paylaşır) |
| GPU / kodlayıcı kullanımı (`nvidia-smi`) | GPU ~%10, kodlayıcı ~%34 |
| İşleme | 60 fps, ort. kare süresi ~0,5–0,9 ms, geciken kare 0 |
| Çıktılar | düşen kare 0, çözme hatası 0 (ffprobe) |
| Açılış (libobs + modüller) | ~0,5 sn |

Yorum: CPU'nun çoğu test videosunun yazılımla çözülmesinden gelir (donanım çözme kapalı); gerçek oyun yakalamada bu
maliyet yoktur, yerine yakalama gelir (ölçülmedi — kullanıcı kuralı: yalnız sentetik). Paylaşılan kodlayıcı sayesinde
hedef ve kayıt eklemek NVENC oturumu artırmaz.
