# Yayın Motoru Kararı (ADR-001)

> Durum: **KABUL** (2026-09-25) · Kapsam: yakalama, sahne grafiği, GPU birleştirme, ses, kodlama, kayıt, tekrar
> arabelleği ve çıkışların hangi motorla yapılacağı.

## 1. Bağlam

- Uygulamanın bugün **kendi** yakalama/birleştirme/kodlama motoru yok; görüntü ve ses OBS Studio 32.2.2'de işleniyor,
  uygulama OBS'i obs-websocket ile yönetiyor ([CURRENT_SYSTEM_AUDIT](CURRENT_SYSTEM_AUDIT.md)).
- Hedef: tek uygulamadan yakalama → sahne → birleştirme → ses → kodlama → kayıt → tekrar → çoklu yayın → topluluk
  → otomasyon. Arayüz çökse bile yayın düşmemeli; kontrol merkezi yavaşlasa bile kodlayıcı kare kaybetmemeli (§146–148).
- Donanım: RTX 5070 (NVENC H.264/HEVC/AV1), sürücü 617.14; FFmpeg (GPL derlemesi, NVENC/AMF/QSV/SVT-AV1) sistemde.

## 2. Seçenekler

### A) libobs'u uygulamaya gömmek (link)

| Artı | Eksi |
|---|---|
| Olgun yakalama (oyun yakalama kancası, WGC, DXGI, dshow, WASAPI), sahne grafiği, filtreler, kodlayıcılar, tekrar arabelleği, kayıt, eklenti ekosistemi | **GPLv2+**: libobs'a bağlanan uygulama GPL uyumlu dağıtılmalı, kaynak teklifi zorunlu (`CONFIRMED_IN_OFFICIAL_DOCS (özet)`) |
| Yıllarca test edilmiş kenar durumları | OBS derleme zinciri (CMake, Qt dışı kullanım, obs-browser/CEF, grafik arka ucu) Rust/Tauri derlemesine eklenir; bakım yükü büyük |
| | Aynı süreçte çalışırsa motor çökmesi arayüzü de düşürür (veya tersi) — §147 ihlali; ayrı yardımcı süreçte çalıştırmak ek IPC ister |

### B) Sıfırdan özel motor (Rust + Direct3D 11/12 + WGC/DXGI + WASAPI + NVENC/AMF/QSV)

| Artı | Eksi |
|---|---|
| Tam sahiplik, lisans serbestliği, derin optimizasyon | Oyun yakalama (grafik kancası, hile koruması riski), aygıt uyumluluğu, A/V senkronu, kodlayıcı kenar durumları, tarayıcı kaynağı (CEF) **aylar/yıllar** sürer |
| | Bugün çalışan yayın akışını riske atar; "100 yarım özellik" riski (§138) |

### C) OBS Studio'yu **ayrı süreçte yayın motoru** olarak yönetmek + kendi çıkış yönlendiricimiz (SEÇİLDİ)

| Artı | Eksi |
|---|---|
| Süreç yalıtımı: panel (Tauri/WebView) çökse bile OBS yayını sürer; OBS çökse bile panel ayakta kalır ve kurtarma yapar → §147/148 doğal olarak sağlanır | OBS ayrı bir uygulama; kullanıcı onu da kurmalı (zaten kurulu) |
| obs-websocket 5.7: tuvaller (`GetCanvasList`, `canvasUuid`), çıkışlar, 6 ses izi, senkron kaydırma, tekrar arabelleği, kayıt bölme/bölüm, sanal kamera, stüdyo modu, geçişler, projektörler, istatistikler — hepsi uzaktan (`CONFIRMED_IN_OFFICIAL_DOCS`) | Yeni çıkış OLUŞTURMA websocket'te yok → çoklu yayın için kendi yönlendiricimiz gerekir |
| Lisans: OBS ile ağ protokolü üzerinden konuşmak ayrı programlar arası iletişimdir; FFmpeg ayrı süreç olarak çağrılır (paketlenmez; yt-dlp gibi sistemde bulunur veya ilk kullanımda indirilir) (`INFERRED`, hukuki danışmanlık değildir) | Arayüz "tek uygulama" deneyimi için OBS'i arka planda yönetmek gerekir (başlatma, bağlanma, sağlık izleme — `launch_obs`, `obs_client` zaten var) |
| Bugünkü çalışan sistemin üzerine kurulur; gerileme riski düşük | OBS arayüzü de açık kalır; ileride "başsız" (minimize/tepsi) çalıştırma denenecek |

### D) Uzun vade seçeneği: libobs'u **ayrı GPL yardımcı süreçte** barındırmak

libobs'u kendi küçük "streaming-core" yardımcı sürecimizde (GPL, kaynağı yayınlanan ayrı program) çalıştırıp panel ile
IPC üzerinden konuşmak. OBS arayüzüne ihtiyaç kalmaz; süreç yalıtımı korunur; lisans yükümlülüğü yalnız o yardımcı
programla sınırlı kalır (`INFERRED`). **Faz 3 kanıt çalışması** olarak değerlendirilecek; ürün kararı değildir.

## 3. Karar

**C seçildi.** Yayın motoru = ayrı süreçte OBS Studio; uygulamanın "Native Streaming Core" katmanı şu parçalardan oluşur:

1. **Engine Supervisor** (Rust): OBS'i başlatır, obs-websocket'e bağlanır, yeniden bağlanır, sağlığını izler
   (`GetStats`, çıkış durum olayları), tuvalleri ve çıkışları keşfeder.
2. **Output Router** (Rust + FFmpeg alt süreçleri): OBS'in tek yayın çıkışını yerel alıcıya (127.0.0.1) yönlendirip
   **tek kodlamayı birden çok hedefe paket kopyasıyla** dağıtır; hedef başına bağımsız durum makinesi, başlat/durdur,
   yeniden bağlanma, sağlık ([MULTISTREAM_ARCHITECTURE](MULTISTREAM_ARCHITECTURE.md)).
3. **Control Plane**: sahne/kaynak/ses/tekrar/kayıt denetimi obs-websocket isteklerine çevrilir; tüm eylemler izin
   ve denetim günlüğünden geçer.

Kayıpsızlık notu (§145): internet yayını kayıplı kodektir, "0 kayıp" hedeflenmez. Hedef: **gereksiz kalite kaybı
yok** — OBS tek kez kodlar, yönlendirici yeniden kodlamaz (`-c copy`), platforma göre en uygun profil seçilir.

## 4. Sonuçları

- Çoklu yayın, tek kodlama + paket çoğaltma ile yapılır; hedeflerin kodlama gereksinimleri farklıysa (ör. YouTube
  HEVC/AV1, Kick yalnız H.264) **ortak paydada** (H.264) kodlanır ya da OBS'in çoklu iz/ek tuval çıkışları kullanılır
  (ileri faz). Uyuşmazlık yayın öncesi kontrol listesinde gösterilir.
- Dikey tuval: OBS'in çoklu tuval altyapısı + ek tuval çıkışı gerektirir (bugün eklentiyle). Faz 10'da obs-websocket
  tuval desteği üzerinden ([MULTICANVAS_ARCHITECTURE](MULTICANVAS_ARCHITECTURE.md)).
- Özel motor (B) ve gömülü libobs (A) **reddedildi**; D yalnız araştırma kaydı.

## 5. Yeniden değerlendirme koşulları

- obs-websocket çıkış oluşturmayı destekler hâle gelirse Output Router'ın bir kısmı OBS'e devredilebilir.
- OBS'in başsız çalıştırma ihtiyacı kritikleşirse D seçeneği kanıt çalışmasıyla yeniden açılır.

---

# ADR-002 — Motor köprüleri: tuval ve çıkış yetenekleri nereden gelecek (2026-09-26)

## Bağlam (yeni kanıtlar)

| Kanıt | Sınıf |
|---|---|
| obs-websocket 5.7.4 (kullanıcının OBS 32.2.2'sinde): tuvalleri **listeler** ve tuval içindeki sahne/girdi/öğe/dönüşüm/filtreyi `canvasUuid` ile yönetir; **tuval oluşturma, tuvalde program sahnesi değiştirme (`SetCurrentProgramScene` tuval parametresi almaz), çıkış ya da kodlayıcı oluşturma yok** (yalnız `GetOutputList/Start/Stop/Toggle/Get/SetOutputSettings`) | `CONFIRMED_OFFICIAL_DOCS` (protocol.md) + `OBSERVED_IN_RUNTIME` |
| Kullanıcının OBS'inde iki tuval: "Main" 1920×1080@60 ve "🚀 SE.Live: Vertical" 1080×1920@60; ikincisinin sahneleri websocket'ten görünmüyor | `OBSERVED_IN_RUNTIME` |
| SE.Live = libobs'a bağlanan **GPL-2.0 eklenti** (tuval, çıkış, kodlayıcı, ses kompozisyonu, 208 yöntemli JS API) + kapalı web arayüzü; obs-websocket vendor kaydı kodda yorum satırı (uzaktan denetim yok) | `CONFIRMED_PUBLIC_SOURCE` |
| Aitum `obs-vertical-canvas` (GPL-2.0): obs-websocket vendor'ı `aitum-vertical-canvas` — `switch_scene`, `get_scenes`, `current_scene`, akış/kayıt/backtrack/sanal kamera başlat-durdur-değiştir, `update_stream_key/server`, `add_chapter`, `status`, `version` | `CONFIRMED_PUBLIC_SOURCE` |
| OBS 31.1–32.2: çok izli video için ek tuvaller, dinamik bit hızı, yalnız Özel servis; 32.1 obs-websocket'e kısmi tuval desteği | `CONFIRMED_OFFICIAL_DOCS` (sürüm notları) |

## Karar

ADR-001'in C seçeneği (OBS ayrı süreçte motor) **korunur**; P0/P1 kararlılığı için yerel yakalama/birleştirme motoru
(B) ve süreç içi libobs (A) hâlâ reddedilir. Eksik yetenekler üç katmanlı "motor köprüsü" ile eklenir:

1. **Protokol köprüsü (şimdi):** obs-websocket 5.7'nin sunduğu her şey (tuval keşfi, tuval içeriği yönetimi,
   ana tuvalde sahne/ses/kayıt/tekrar, çıkış durumları) Rust Control Plane'e bağlanır; tüm eylemler tek
   **eylem kayıt defterinden** (izin + denetim günlüğü) geçer.
2. **Üçüncü taraf tuval sağlayıcısı köprüsü (isteğe bağlı):** kullanıcıda vendor API'si olan bir tuval eklentisi
   kuruluysa (bugün yalnız Aitum Vertical'ın belgelenmiş vendor'ı var) ikincil tuvalde sahne geçişi, bağlı sahneler,
   tuval çıkışı başlat/durdur buradan yapılır. Süreç ve protokol sınırı → GPL yükümlülüğü doğmaz. SE.Live tuvalleri
   uzaktan yönetilemez → yalnız **salt-okunur keşif** ve dürüst "desteklenmiyor" mesajı.
   **Bu kullanıcıda uygulanamaz:** StreamElements resmi belgesine göre SE.Live ve Aitum Vertical **birlikte
   kurulmamalı** (kararsızlık/çökme; `CONFIRMED_OFFICIAL_DOCS`, Dual Format makalesi, 2026-09-26). Kullanıcının OBS'inde
   SE.Live kurulu (`OBSERVED_IN_RUNTIME`) → Aitum köprüsü önerilmez; bu kullanıcı için ikincil tuval yönetimi
   SE.Live'ın kendi arayüzünde kalır ya da katman 3'ü bekler. Tuval keşfi (`/api/obs/canvases`) uygulandı (6bee4f1).
3. **Kendi GPL eklentimiz (P2, ayrı açık kaynak depo):** tuval oluşturma, tuvalde program sahnesi, hedef başına OBS
   çıkışı + **tembel/tüketici sayımlı kodlayıcı paylaşımı** (`ENCODER_LIFECYCLE_DESIGN.md`), hedef başına ses izi,
   tuval başına tekrar arabelleği. Ana uygulama eklentiyle yalnız obs-websocket vendor istekleri üzerinden konuşur;
   eklenti GPL-2.0 ile kaynak açık dağıtılır (`LICENSE_AND_DEPENDENCY_REVIEW.md` §4). Bugünkü FFmpeg yönlendiricisi,
   eklenti yokken ve "tek kodlama → çok hedef" için varsayılan yol olarak kalır.

## Sonuçları

- Dikey tuval / bağlı sahneler **eklenti gerektiren** özelliklerdir; uygulama gerektiğinde bunu açıkça söyler,
  desteklenmeyen işlevi etkin göstermez.
- SE.Live ile birlikte çalışma: SE.Live'ın tuvali çıkışlarını kendisi yönetir; bizim yönlendiricimiz OBS'in ana
  yayın çıkışını dağıttığı için ikisi aynı ana çıkışı kullanmaya kalkarsa çakışır → yayın öncesi kontrolde uyarı.
- Kendi eklentimiz yazılana kadar hedef başına farklı kodlama profili ve hedef başına ses izi `MISSING` kalır.

## Yeniden değerlendirme

obs-websocket tuval oluşturma / tuvalde sahne değiştirme / çıkış oluşturma eklerse 2. ve 3. katmanın bir kısmı
gereksizleşir; her OBS sürümünde protokol belgesi kontrol edilir.

# ADR-003 — Kendi yayın çekirdeğimiz: libobs tabanlı ayrı süreç (2026-09-26)

**Durum:** KABUL EDİLDİ — ürün sahibinin kararı ("kendi OBS'imizi de yapalım, çoklu yayın özellikli"; seçenekler
arasında "libobs tabanlı motor" seçildi, sınama "yalnız sentetik kaynaklar"). ADR-001'in D seçeneğini hayata geçirir;
ADR-001 C (OBS'i dışarıdan yönetmek) ve FFmpeg yönlendiricisi **yanında kalır**, hiçbiri kaldırılmadı.

## Bağlam

- Prompt §25–§58 bir yerel yayın çekirdeği (yakalama → sahne → GPU birleştirme → kodlayıcı → çıktılar, çoklu tuval,
  hedef başına kodlama) istiyor; obs-websocket ikincil tuvali, çıktı ve kodlayıcı oluşturmayı dışarıya açmıyor (ADR-002).
- Kullanıcının makinesinde OBS 32.2.2 kurulu; `obs.dll` 1050 işlev dışa aktarıyor, tuval API'si (`obs_canvas_*`) dahil
  (`OBSERVED_IN_RUNTIME`). GPU: RTX 5070 (NVENC H.264/HEVC/AV1).

## Karar

`motor/` altında ayrı bir Rust programı (`yayin-motoru`, **GPL-2.0-or-later**):

1. **Yükleme:** `obs.dll` çalışma anında kurulu OBS'ten yüklenir (`libloading`); başlık derlenmez. Yapı düzenleri
   (`obs_video_info`, `obs_audio_info`, `obs_service_info`, `obs_output_info`, `video_scale_info`, `calldata`) 32.2.2
   başlıklarıyla birebir yazıldı ve boyut testleriyle kilitlendi; başka ana sürüm reddedilir.
2. **Yalıtım:** kullanıcının OBS yapılandırmasına dokunulmaz (modül ayarları `%LOCALAPPDATA%\yayin-motoru`); OBS arayüzü
   açılmaz. Yalnız seçili modüller yüklenir; **yüklenmeyenler:** `obs-websocket` (kullanıcının OBS'iyle port çakışır),
   `frontend-tools` (OBS arayüzü ister), `rtmp-services` (açılışta obsproject.com'dan servis listesi indirir — yerine
   kendi `yym_rtmp` servis türümüz), SE.Live ve diğer üçüncü taraf eklentiler. Yakalama modülleri (`win-capture`,
   `win-dshow`, `win-wasapi`) yalnız kullanıcı yakalama kaynağı eklediğinde yüklenir.
3. **Model:** ana tuval (libobs ana karışımı) + ek tuval (`obs_canvas_create`, ör. 1080×1920); tuvale bağlı sahne;
   küresel kaynak aynı anda birden çok tuvalde farklı dönüşümle (tek yakalama/çözme — §31); tuval başına video
   kodlayıcı; aynı kodlayıcıyı paylaşan hedefler ve kayıt (§44); farklı profil isteyen hedef için ayrı kodlayıcı (§46);
   hedef başına bağımsız durum makinesi (§41, §43).
4. **IPC:** stdio üzerinden JSON satırları (`hizmet` kipi); ağ portu açılmaz. Panel çekirdeği alt süreç olarak başlatır
   (`motor_kopru.rs`), `/api/motor…` uçlarıyla yönetir (izin + denetim). Çekirdek çökerse panel etkilenmez (§26).
5. **Lisans sınırı:** çekirdek GPL-2.0-or-later ve kaynağı depoda (`motor/`, `motor/LICENSE`). Panel ayrı süreçtir ve
   çekirdekle yalnız stdio üzerinden, belgelenmiş bir protokolle konuşur → ayrı eser (`INFERRED`, hukuki görüş değil).
   Çekirdeğe panelden kod kopyalanmadı.

## Bulunan ve düzeltilen hatalar (sınamada)

1. **Kapanışta çökme:** tuval (`SCENE_REF`) sahnelere kendi referansını tutuyor; sahneyi tuvalden çıkarmadan
   (`obs_source_remove`) bırakmak `obs_shutdown`'da "double destroy" üretti → kapanış sırası düzeltildi.
2. **Durdurulan hedefin bağlantısı açık kalıyordu:** OBS'in librtmp soketleri Windows'ta devralınabilir; kayıt çıktısı
   `obs-ffmpeg-mux.exe` alt sürecini başlatınca o anda açık RTMP soketlerini devralıyor, sonra `closesocket` bağlantıyı
   kapatamıyor. Ölçüm: B hedefi durduktan 1 sn sonra çekirdekten B alıcısına ESTABLISHED bağlantı 1 (kayıtsız 0). Gerçek
   platformda durdurulan hedefin bağlantısı kayıt bitene kadar açık kalırdı. → Her çıktı başlatılmadan önce süreçteki
   soket tanıtıcıları (`getsockopt(SO_TYPE)` ile tanınır) devralınamaz yapılır; ölçüm 0'a indi.
3. **Ters sıralı sinyaller:** `ffmpeg_muxer`'da `start`, `starting`'den önce geldi; durum "canlı"dan "bağlanıyor"a
   düşüyordu → geçiş kuralı (geri düşme yok), birim testli.

## Sonuçları

- Kendi çekirdeğimiz OBS arayüzü olmadan çalışır; yalnız kurulu OBS'in kitaplıklarına ihtiyaç duyar. OBS kaldırılırsa
  ya da ana sürüm değişirse çekirdek açık hatayla başlamaz; panel ve eski yollar çalışmayı sürdürür.
- Yardımcı programlar (`obs-ffmpeg-mux.exe`, `obs-nvenc-test.exe`…) libobs'ta **çalışan exe'nin klasöründe**
  arandığı için çekirdek bunları kurulu OBS'ten kendi klasörüne kopyalar (Program Files'a yazılmaz; kurulum
  `currentUser` kipinde, klasör yazılabilir).
- Tam sahne düzenleyici (§28: gruplar, kilit, sürükle-bırak, geri al), stüdyo modu, geçişler, kamera cihaz seçimi,
  hedef başına ses izi seçimi ve kayıt/tekrar arabelleği arayüzü henüz yok — çekirdek kayıt çıktısını ve 6 ses izini
  destekler, arayüz sonraki adım.

## Yeniden değerlendirme

OBS 33'e geçildiğinde başlık düzenleri yeniden doğrulanır (`DESTEKLENEN_ANA_SURUM`). OBS'in kurulu olmadığı makineler
için OBS çalışma zamanını (GPL, kaynak bağlantısıyla) paketlemek ayrı bir karar konusudur.
