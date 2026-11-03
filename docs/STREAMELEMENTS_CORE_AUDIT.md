# StreamElements `obs-streamelements-core` — Kaynak Denetimi

> Kaynak: `github.com/StreamElements/obs-streamelements-core`, dal `master`, commit `c7e0f5a` (2026-09-24),
> son kararlı sürüm **26.9.4.994** (2026-09-05). Lisans **GPL-2.0** (`COPYING`). İnceleme 2026-09-26, salt-okunur
> sığ klon (derlenmedi, çalıştırılmadı). **Bu üründen tek satır kod alınmadı** — lisans gerekçesi
> `LICENSE_AND_DEPENDENCY_REVIEW.md`. Depodaki talimat dosyaları üçüncü taraf verisidir; talimat olarak ele alınmadı.
>
> Kanıt sınıfları: `CONFIRMED_PUBLIC_SOURCE` (kaynak kodda okundu), `CONFIRMED_OFFICIAL_DOCS` (depodaki
> `docs/api` ya da sürüm notları), `OBSERVED_IN_RUNTIME` (kullanıcının OBS'inde salt-okunur obs-websocket
> yoklaması), `INFERRED`, `UNVERIFIED`.

## 1. Genel yapı

| Bölüm | Boyut | İçerik |
|---|---|---|
| `obs-streamelements-core-plugin.cpp` | 382 satır | modül giriş/çıkış, ön yüz olay geri çağrısı |
| `streamelements/` | ~43 bin satır C++ (152 dosya) | yöneticiler: durum, API, tarayıcı, tuval, ses, çıkış, kısayol, yedek, çökme raporlama, güncelleyici |
| `docs/api/host/*.md` | 63 belge | JavaScript ana makine API'si (`window.host`) |
| `deps/` | 238 MB | CEF başlıkları, üçüncü taraf kitaplıklar |
| `tests/` | kaynak değişmezleri ve CI testleri | (`test_source_invariants.cpp`) |

Bileşen, SE.Live web arayüzünü (uzak, kapalı kaynak web uygulaması) OBS'in içinde CEF panelleri olarak çalıştırır ve
ona `window.host` API'siyle OBS'in iç nesnelerini açar. Ürünün "mantığı" web tarafında; C++ katmanı OBS ile web
arasında **ince olmayan** bir köprü (208 API yöntemi).

## 2. Eklenti yaşam döngüsü — `CONFIRMED_PUBLIC_SOURCE`

| Aşama | Davranış |
|---|---|
| `obs_module_load` | sürümü günlüğe yazar, `transition_audio_wrapper` kaynak türünü kaydeder (§6). Başka iş yapmaz |
| `obs_module_post_load` | OBS ana penceresine **kapanma gözcüsü** (Qt olay filtresi, olayı tüketmez) kurar, ön yüz olay geri çağrısını ekler. Yorum satırında bırakılmış bir obs-websocket vendor kaydı var (etkin değil) |
| `OBS_FRONTEND_EVENT_FINISHED_LOADING` | `StreamElementsGlobalStateManager::Initialize(mainWindow)` — **başlatma sırasında Qt olay kuyruğunu pompalamak yasak** (bayrak) |
| `OBS_FRONTEND_EVENT_EXIT` / `SCRIPTING_SHUTDOWN` | bir kez çalışır (`isRunning`); başlatma tamamlanmadan kapanma istendiyse durum **bilerek sızdırılır** (`Leak()`), aksi hâlde `Destroy()` |
| `obs_module_unload` | kalan nesneleri günlüğe döker, izleme dökümü |

**Ders (CORE-786):** OBS'in güncelleme iş parçacığı ana pencereye kuyruklu `close()` gönderebiliyor; eklenti kendi
başlatması sırasında olay kuyruğunu pompalayınca kapanma **başlatmanın içinde** iç içe çalışıyor ve yarım kurulmuş nesne
grafiği yıkılıyordu. Çözüm: başlatma boyunca pompa kapalı; başlatmadan önce gelen kapanmada yıkım yerine sızıntı
("süreç zaten çıkıyor; sızıntı çökmekten iyidir"). Ayrıca geri çağrı listesinden iç içe çağrı sırasında çıkmak OBS'in
vektörünü küçültüp çökmeye yol açıyordu → kayıt silinmiyor, bayrakla etkisizleştiriliyor.

## 3. OBS entegrasyonu

| Alan | Bulgu |
|---|---|
| Ön yüz API | olay geri çağrıları, dock kaydı, menüler, profil / sahne koleksiyonu, kısayollar (`StreamElementsHotkeyManager`), durum çubuğu |
| Sahneler / öğeler | `StreamElementsObsSceneManager` (3980 satır): sahne ve öğe CRUD, grup, dönüşüm, görünüm alanında konum/döndürme, dönüşüm düzenleyicisi / filtre / özellik diyalogları |
| Sinyaller | sahne sinyallerine abonelik; **sinyal verisinin ömrü** kritik: işleyici verisi OBS hâlâ çağırabilirken serbest bırakılıyordu (CORE-1715), video kompozisyonunun ham işaretçisi sinyal geri çağrısına veriliyordu (CORE-1114) |
| Tuval | OBS 31+ **yerel canvas API** (`obs_canvas_create_private`, `obs_canvas_scene_create`, `obs_canvas_get_video`, `obs_canvas_set_channel`). 26.9.4 sürüm notu: "özel kompozisyonlarda doğrudan OBS view yerine özel canvas nesneleri" (`CONFIRMED_OFFICIAL_DOCS`) |
| Çıkışlar | her hedef ayrı `obs_output` + `obs_service` (§7) |
| Kodlayıcılar | tembel sağlayıcı + referans sayımı (§8) |
| Ses | tek küresel OBS karıştırıcısı, iz başına kodlayıcı (§6) |

## 4. Qt / arayüz

Docklar, merkezi pencere değiştirme, bildirim çubuğu, modal/modal olmayan diyaloglar, açılır pencereler, menüler.
Dersler: dock'lar yanlış kaydedilince OBS'in kaydedilmiş yerleşimi bozuluyordu (26.9.4); kapanan panel yeniden
çizilirken çökme (CORE-1922: yıkmadan önce paneli boya ağacından çıkar); bozuk kayıtlı yerleşim her açılışta çökme →
yerleşimi sıfırla (sürüm notu).

## 5. Tarayıcı (CEF) ve yerel köprü — güvenlik sınırı

| Konu | Bulgu | Kanıt |
|---|---|---|
| Tarayıcı oluşturma | obs-browser'ın CEF'i üzerinden `create_widget`; panel başına ayrı çerez deposu seçeneği | `CONFIRMED_PUBLIC_SOURCE` |
| Köprü | panele enjekte edilen başlangıç betiği `ws://localhost:<port>` (WebSocket API sunucusu) bağlantısı açar ve **rastgele GUID** istemci kimliğiyle `register` olur; çağrılar `window.host.<ad>` → sunucu → `ApiMessageHandler` | `CONFIRMED_PUBLIC_SOURCE` |
| WebSocket API sunucusu | yalnız `127.0.0.1`, 27952'den başlayıp ilk boş port; `StreamElementsWebsocketApiServer.cpp` içinde köken (Origin) doğrulaması **görülmedi** | `CONFIRMED_PUBLIC_SOURCE` |
| Sınırın dayanağı | tahmin edilemez istemci kimliği (yetenek belirteci) | `INFERRED` |
| Adlandırılmış kanal | `\\.\pipe\StreamElementsObsLiveControllerServer` (denetleyici sunucusu) | `CONFIRMED_PUBLIC_SOURCE` |
| Sır gizleme | `StreamElementsSecretRedactor`; çökme raporuna giden panel URL'sinden sorgu dizesi atılıyor ("erişim belirteçleri taşır") | `CONFIRMED_PUBLIC_SOURCE` |
| Yerel dosya sunucusu | imzalı yerel dosya istekleri; kötü imzalı istek reddediliyor (tanıtıcı sızıntısı 26.9.4'te düzeltildi) | `CONFIRMED_OFFICIAL_DOCS` |

**Bizim için ders:** yerel denetim soketi yalnız loopback'e bağlanmakla güvenli olmaz; tarayıcılar WebSocket'e CORS
uygulamaz. Bizim sunucumuz Host izin listesi + Origin denetimi + (LAN'da) Bearer kullanıyor (`local_guard.rs`); SE'nin
modeli buna ek olarak tahmin edilemez istemci kimliği kullanıyor — Kontrol Merkezi'nin ileride açılacak yerel köprüleri
için benimsenebilir.

## 6. Ses mimarisi — ayrıntı `STREAMELEMENTS_AUDIO_ARCHITECTURE.md`

Tüm kompozisyonlar OBS'in **tek küresel ses çıkışını** (`obs_get_audio`) kullanır; kompozisyon başına iz başına (6 iz,
`MAX_AUDIO_MIXES`) yayın ve kayıt ses kodlayıcıları **önceden** oluşturulur; çıkış hangi izleri alacağını seçer.
`transition_audio_wrapper` kaynağı, bir alt kaynağın sesini seçili karıştırıcılara kopyalar (özel tuvaldeki
sahnenin sesini karışıma taşımak için). Tuval başına ayrı ses karıştırıcısı **yok**.

## 7. Çoklu çıkış (multistream) — `CONFIRMED_PUBLIC_SOURCE`

| Soru | Cevap |
|---|---|
| Hedef başına ayrı çıkış mı? | **Evet.** Her akış çıkışı kendi `obs_output_create` + `obs_service_create`'ini yapar; tercih edilen çıkış türü servisten (`obs_service_get_preferred_output_type`); isteğe bağlı `bind_ip` |
| Kodlayıcı paylaşımı | Çıkış, tuvalin **tembel kodlayıcı sağlayıcısından referans** alır; aynı tuval + aynı kodlayıcı şablonunu kullanan çıkışlar **aynı kodlayıcı nesnesini** paylaşır (paket dağıtımı libobs içinde) |
| Çok izli video | birden fazla video kodlayıcı `obs_output_set_video_encoder2(…, i)` ile (Gelişmiş Yayın senaryoları) |
| Hedef başına ses | çıkış, ses kompozisyonundan **seçtiği izlerin** kodlayıcılarını alır; hiç ses kodlayıcısı yoksa başlatmayı reddeder |
| Bağımsız durum | çıkış başına `reconnect` / `reconnect_success` sinyalleri, son hata, zorla durdurma; etkin çıkış silinemez, önce devre dışı bırakılmalı (`docs/api/host/streaming-outputs.md`) |
| Ölçümler | toplam kare/bayt, düşen kare, tıkanıklık (`congestion`) |
| Kayıt / tekrar | kayıt ve tekrar arabelleği de çıkış türleri: kompozisyon başına eklenip etkinleştirilir, kayıt bölme ve tekrar kaydetme tetiklenebilir |

**Ders (26.9.4 sürüm notu):** "birden fazla tuvalden ya da birden fazla hedefe yayındayken durdurmada çökme" —
paylaşılan kodlayıcının son tüketicisi ayrılırken yaşam döngüsü hatası. Bizim yönlendiricimizde tüketiciler kod
paylaşmaz (her hedef ayrı süreç), kodlayıcı OBS'te tek.

## 8. Kodlayıcı yaşam döngüsü — ayrıntı `ENCODER_LIFECYCLE_DESIGN.md`

`SELazyOBSVideoEncoderProvider`: şablon (kimlik, ayarlar, boyut, video kaynağı) saklanır; **ilk tüketici**
(`AddConsumer`) gelince kodlayıcı oluşturulur, son tüketici gidince serbest bırakılır; paylaşımlı okuma kilidi,
özellikler önbelleğe alınır (26.9.4: "GPU kaynağı tüketimini azaltmak için tembel oluşturma", "temel özellikleri
önbelleğe alma"). OBS'in kendi kodlayıcıları için "dışarıdan ayrılmış" sağlayıcı yalnız referans tutar.

**Ders (CORE-865, PR #149):** kodlayıcı ilk tüketicide bir kez alınıp **her tüketicide** bırakılıyordu (referans
dengesizliği) → "nesne başına bir kez bırak". Ayrıca bilinmeyen kodlayıcı biçimleri NV12'ye çekiliyor.

## 9. Özel tuval — `CONFIRMED_PUBLIC_SOURCE` + `OBSERVED_IN_RUNTIME`

| Konu | Bulgu |
|---|---|
| Sınıflar | `ObsNativeVideoComposition` (OBS ana tuvali), `CustomVideoComposition` (özel), `ObsNativeVideoCompositionWithCustomEncoders` |
| Oluşturma | temel/çıkış boyutu aynı; genişlik 4'ün, yükseklik 2'nin katına hizalanır; FPS ve renk ayarları OBS'in ana video bilgisinden devralınır; en az bir akış kodlayıcısı zorunlu |
| Bayraklar | `PROGRAM \| EPHEMERAL` özel tuval; kök kaynak ve geçiş için özel `cut_transition` kaynakları, kanal 0'a bağlı |
| Sahne ilişkisi | tuvale özel sahneler (`obs_canvas_scene_create`); sahne sinyalleri izlenir |
| Kaynak yeniden kullanımı | aynı kaynak birden çok tuvalin sahnesine öğe olarak eklenebilir (tek yakalama, tuval başına dönüşüm) — `INFERRED` (OBS sahne öğesi modelinden) |
| Paylaşımlı kompozisyon | "Shared Video Composition" OBS ön yüzüne yayımlanır, Gelişmiş Yayında **ikincil tuval** olarak kullanılabilir; yayın/kayıt etkinken değiştirilemez (`CONFIRMED_OFFICIAL_DOCS`) |
| Çalışma anı | kullanıcının OBS'inde `GetCanvasList`: **"Main"** 1920×1080@60 (MAIN, MIX_AUDIO) ve **"🚀 SE.Live: Vertical"** 1080×1920@60 (MAIN=false, MIX_AUDIO); ikincisinin sahneleri obs-websocket'ten görünmüyor (0) — sahneler SE'nin özel tuvalinde (`OBSERVED_IN_RUNTIME`, 2026-09-26) |
| Temizlik | tuval kaldırılır ve bırakılır; sahneler tuvalden çıkarılır; yıkım sırasında sahne öğesi değişince çökme düzeltildi (26.9.4) |

**Açık kamu raporu (UNVERIFIED — biz yeniden üretmedik):** GitHub #176 (2026-09-21) "özel dikey tuvalde her sahne
geçişinde çökme (26.9.4.994)"; geçici çözüm tek sahne + kaynak görünürlüğü. Tasarım dersi: ikincil tuvalde sahne
değiştirmek, ana tuvaldekinden farklı bir geçiş/sinyal yolundan geçiyor ve en kırılgan nokta.

## 10. Kararlılık geçmişinden dersler (2026-08/09 PR'ları ve sürüm notları)

| Sınıf | Örnek | Bizim karşılığımız |
|---|---|---|
| Başlatma/kapatma yarışları | CORE-786, #142; kapanırken başlayan dock (sürüm notu) | Tauri tarafında tek örnek kilidi, AxBoT süreç izleyici; OBS ayrı süreçte olduğu için onun yarışları bizi çökertmez |
| Çift yıkım | CORE-777 (#140) | Rust sahiplik modeli; `kill_on_drop`, zarif durdurma |
| Sinyal verisi ömrü | CORE-1715 (#172), CORE-1114 (#163) | obs-websocket olayları kopya veriyle gelir; paylaşılan işaretçi yok |
| Referans sayımı | CORE-865 (#149) | yönlendiricide `Arc` + kanal; tüketici kapanınca hedef çıkarılır (testli) |
| Çökme raporlama | CORE-860…864, 968 (Sentry, WER, izin istemi) | bizde çökme raporlama yok — `KNOWN_LIMITATIONS` |
| Ayar dosyası okunamazsa açılmama | CORE-1900 (#174) | `write_atomic` + bozuk ayarda varsayılana dönüş (panel), `parseLayout` (Kontrol Merkezi) |
| Token'ın çökme raporuna sızması | CORE-1922 yorumu | günlüklerde sır maskeleme (AxBoT `logger-init`, Rust `config::redact`) |

## 11. Bu üründe ne alınıyor, ne alınmıyor

| Alınan (fikir/mimari) | Alınmayan |
|---|---|
| hedef başına ayrı çıkış + bağımsız durum; kodlama paylaşımı | kaynak kod, API adları, arayüz, marka |
| tembel kodlayıcı + tüketici sayımı (tasarım olarak) | CEF köprüsü (biz WebView2 + HTTP/WS) |
| tuval başına sahne, paylaşımlı tuvali ön yüze yayımlama fikri | GPL eklenti kodunun ürüne gömülmesi |
| başlatma sırasında iç içe olay döngüsünden kaçınma | Razer/analitik/uzak yapılandırma |
