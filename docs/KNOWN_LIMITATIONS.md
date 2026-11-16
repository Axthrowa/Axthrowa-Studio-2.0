# Bilinen Sınırlamalar — Streaming OS turu (2026-09-25/26)

Bu liste bilerek yapılmayanları, doğrulanamayanları ve ödünleşimleri dürüstçe kaydeder. "Destekleniyor" demediğimiz
hiçbir şey arayüzde destekleniyor gibi gösterilmez.

## Canlı ortamda DOĞRULANMAYANLAR

| Konu | Durum | Neden |
|---|---|---|
| Gerçek platformlara (Kick, Twitch, YouTube) çoklu yayın | **UNVERIFIED** | Kullanıcı kuralı: gerçek yayın başlatılmaz. Tüm uçtan uca testler yerel RTMP dinleyicileriyle (127.0.0.1) yapıldı. |
| RTMPS hedefleri (Twitch `rtmps://live.twitch.tv:443/app`, YouTube `rtmps://a.rtmps.youtube.com:443/live2`, Kick) | **UNVERIFIED** | Ön ayarlar resmi belgelere göre; FFmpeg RTMPS desteği var ama canlı bağlantı denenmedi. |
| Platform kuralları (Kick ≤ 8000 kbps, yalnız H.264, 2 sn anahtar kare; YouTube anahtar kare ≤ 4 sn; Twitch eşzamanlı yayın koşulları) | CONFIRMED_IN_OFFICIAL_DOCS (tarih: 2026-09-25) | Platformlar kuralları değiştirebilir; tablo `multistream/policy.rs`'te tek yerde. |
| LAN kipinde WS şifre ayıklaması | birim testli, canlı LAN denenmedi | 0.0.0.0'a bağlanmak Windows Güvenlik Duvarı penceresi açıp kullanıcının tam ekran oyununu bölebilirdi. |
| Kontrol Merkezi "Sahne & Ses" paneli ile gerçek OBS | **kısmi** (2026-09-26): istemci katmanı gerçek OBS 32.2.2'ye karşı yalnız okuma çağrılarıyla doğrulandı (`examples/obs_probe`: 5 sahne, 11 giriş, 2 tuval, 8 girişte ses ölçümü, 12 sn boşta ölçer aboneliğinin kapanması); sahne geçişi / susturma canlı denenmedi | Kullanıcının canlı OBS sahnesini test için değiştirmedim. Tarayıcı düzeneğinde panel OBS'e JS istemcisiyle bağlanır ve parola ister — parola girmek kural dışı; ölçer çubuklarının arayüzde canlı görünümü bu yüzden **UNVERIFIED** (Tauri uygulamasında sunucu yolunu kullanır). |
| BotRix / StreamElements arayüz araştırmasının bir kısmı | **kısmen giderildi (2026-09-26)** | Chrome bağlandı: StreamElements'in beş SE.Live makalesi ve Ground Control makalesi tam metin okundu (`CONFIRMED_OFFICIAL_DOCS`). BotRix paneli oturum olmadığı için `NOT_ACCESSIBLE` (giriş yapılmadı); herkese açık BotRix belgeleri okundu. SE.Live / Ground Control uygulama arayüzleri gözlenmedi (masaüstü girdi otomasyonu yapılmıyor). |

## Mimari ödünleşimler

1. **Tek kodlama → tüm hedefler aynı akış.** Çözünürlük, bit hızı ve ses izi hedef başına farklılaşamaz; en katı
   platform (çoğunlukla Kick: ≤ 8000 kbps, H.264) OBS kodlayıcı ayarını belirler. Yayın öncesi kontrol bu çakışmayı
   uyarı/engel olarak gösterir. Hedef başına yeniden kodlama (ikinci kodlayıcı) sonraki faz.
2. **Hedef başına ses izi seçimi yok** (AUDIO_ENGINE.md §3): tüm hedefler OBS'in yayın izini alır.
3. **Dikey tuval / Twitch Dual Format uygulanmadı** (MULTICANVAS_ARCHITECTURE.md): OBS 32'de ek tuval altyapısı
   var, ancak ayrı çıkış eklenti/Enhanced Broadcasting gerektiriyor; yalnız mimari ve rehber hazır.
4. **Alıcı (ingest) yayın anahtarını doğrulamaz.** FFmpeg `-listen 1` anahtar denetimi yapmaz. Azaltımlar: yalnız
   127.0.0.1'e bağlanır, her oturumda rastgele port + rastgele anahtar, oturum kapanınca kapanır. Oturum açıkken aynı
   bilgisayardaki başka bir süreç alıcıya yayın gönderebilir (yerel ayrıcalık gerektirir).
5. **Yayıncı maliyeti FFmpeg RTMP çıkışından gelir:** hedef başına tek çekirdeğin ~%22–30'u (PERFORMANCE_REPORT.md).
   Yönlendiricinin kendi payı ~%1–3. Yerel bir Rust RTMP yayıncısı bu maliyeti düşürebilir — sonraki faz.
6. **Kontrol Merkezi yerleşimi ızgaradır:** gizle, sırala, genişlik (1–3), hazır düzenler. Bölme ağacı, sekme yığını
   ve ayrı pencere (CONTROL_CENTER_ARCHITECTURE.md §2) yapılmadı.
7. ~~Sahne geçişi ve susturma denetim günlüğüne yazılmaz~~ → Kontrol Merkezi'nden (Sahne & Ses, Hızlı eylemler,
   Kontrol destesi) yapılanlar artık eylem kayıt defterinden geçer ve `ACTION:<id>` olarak günlüğe düşer (e58c677).
   T6: Dashboard'daki OBS kartı da (sahne, kaynak göster/gizle, susturma) eylem kayıt defterinden geçer. Küresel
   kısayolların eski türleri (sahne, mikrofon, kaynak, ses, filtre, kayıt) kendi OBS yürütücüsüyle çalışır (OBS
   bağlantısı kopmuşsa yeniden bağlanır) ama `ACTION:<kayıt defteri kimliği>`, `via: "hotkey"` olarak günlüğe yazılır;
   karşılığı olmayanlar (`muteAll`, `sceneNext`, `obsHotkey`, kayıt aç/kapa) `ACTION:hotkey.<tür>`. **Kalan:** katman
   işlemleri (çoğalt, kilitle, öne/arkaya al, sil) kayıt defterinde yok, günlüğe yazılmaz.
8. ~~Ses karıştırıcıda seviye ölçer yok~~ → Sahne & Ses panelinde tepe/ortalama ölçer (4b8b20d). Ses seviyesi
   (fader) ayarı yok; yalnız susturma.

## Güvenlik ödünleşimleri

1. **LAN'dan yüklenen overlay OBS şifresini almaz** (0077750). Aynı bilgisayardaki OBS (127.0.0.1) etkilenmez. İki
   bilgisayarlı kurulumda BRB overlay'inin OBS'e doğrudan bağlanan otomasyonu (mikrofon susturma, sahne dönüşü) OBS
   WebSocket kimlik doğrulaması açıksa çalışmaz. Bu, şifrenin LAN'daki her cihaza açık olmasından daha güvenli bir
   varsayılan olarak seçildi.
2. **Loopback WS istemcileri OBS şifresini almaya devam eder** (aynı bilgisayardaki overlay otomasyonu için gerekli).
   Yabancı web sitelerinin WS el sıkışması köken denetimiyle zaten reddediliyor (`local_guard.rs`).
3. **Uzak kullanıcılar `broadcast.outputs` izniyle özel RTMP hedefi ekleyebilir;** hedef adresi herhangi bir ana
   makine olabilir (iç ağ dahil). Yalnız yöneticinin verdiği izinle; tüm eklemeler denetim günlüğünde.

## Kullanıcıyı etkileyen tek seferlik durumlar

1. **Sırlar önceden hiç kalıcı değildi** (keyring mock deposu, a76f2b5). Düzeltmeden önce girilen OBS şifresi ve
   Kick oturumu diske/kasaya yazılmamıştı: **OBS şifresini ve Kick girişini bir kez yeniden girmek gerekir.**
   Düzeltmeyi geri almak (eski sürüme dönmek) bu sorunu geri getirir.
2. **AxBoT'ta çapraz sohbet aktarımı (`cross_chat_enabled`) kullanıcının veritabanlarında açık.** Twitch'e
   eşzamanlı yayında birleşik sohbeti yayında göstermek Twitch koşullarıyla çelişebilir; yayın öncesi kontrol bunu
   uyarı olarak gösterir. Kapatmak kullanıcının kararıdır, kendiliğinden değiştirilmedi.
3. **Kick yetkilendirmesi güncelleme anında yarımdaysa** (auth-url açılmış, geri dönüş gelmemiş) yeni sürümde `state`
   eşleşmez; panelden bir kez yeniden başlatılmalı.

## AxBoT (bot) tarafı

1. **Kalkan modunda "yalnız takipçi" ve "en az hesap yaşı" uygulanmaz** — sohbet olayları bu bilgiyi taşımıyor;
   sayfa bunu gerekçesiyle "desteklenmiyor" diye gösterir. Platformun kendi sohbet modları (takipçi modu, yavaş mod)
   AxBoT'tan değiştirilmez.
2. **Kalkanın platformda silmesi varsayılan kapalı** (onayla açılır); kapalıyken yalnız bot yok sayar ve OBS
   sohbetinde gizler.
3. **Kaydedilmemiş değişiklik şeridi dört sayfada** (Ayarlar, Bot Moderasyonu, Chat Oyunları, Gemini AI). Diğer
   sayfalar otomatik kaydediyor ya da tek alanlı formlar.

## Derleme

- Panel ana JS paketi 1292 kB (sınır uyarısı 1200 kB) — bu turdan önce de aşılıyordu; Kontrol Merkezi ayrı ~30 kB
  parçaya bölündü. Kod bölme sonraki iş.

## İkinci tur (2026-09-26, "Creator Streaming OS")

| Konu | Durum | Açıklama |
|---|---|---|
| OBS 32 + SE.Live kararlılığı | `CONFIRMED_OFFICIAL_DOCS` uyarı | StreamElements, OBS 32'de SE.Live dahil birçok eklentiyi etkileyen kararlılık sorunları olduğunu ve çökmede OBS 31'e dönmeyi öneriyor. Kullanıcı OBS 32.2.2 + SE.Live kullanıyor. Uygulamamız OBS'e yalnız obs-websocket üzerinden, SE.Live'a hiç dokunmadan bağlanır. |
| SE.Live ikincil tuvali | yalnız **keşif** | obs-websocket 5.7 ikincil tuvalde sahne değiştirmeye, tuval oluşturmaya, tuval Backtrack'ini tetiklemeye izin vermiyor; SE.Live'ın uzaktan denetim API'si yok. Tuval listesi gösterilir, "SE.Live yönetir" yazılır. |
| Aitum Vertical köprüsü (ADR-002 katman 2) | bu kullanıcıda **uygulanamaz** | Resmi belge: SE.Live ve Aitum Vertical birlikte kurulmamalı. |
| Kendi GPL-2.0 OBS eklentimiz (tuval oluşturma, hedef başına kodlayıcı/ses izi) | **PLANNED** (P2) | OBS SDK derleme zinciri, ayrı açık kaynak depo ve imzalı dağıtım gerektirir; bu turda başlanmadı. Tasarım: `ENCODER_LIFECYCLE_DESIGN.md`, `STREAMING_ENGINE_DECISION.md` ADR-002. |
| Donanım Stream Deck | HTTP yolu VERIFIED (curl), Elgato yazılımıyla **UNVERIFIED** | Stream Deck yazılımı/donanımı bu makinede yok. Yerel Elgato eklentisi PLANNED. Donanım tuşunda `confirm: true` göndermek çift dokunuş korumasını atlar (belgelendi). |
| Kontrol destesi yapılandırması | son yazan kazanır | Yapılandırma panel ayarlarında tek kayıt; iki cihazdan aynı anda düzenlenirse sonuncusu geçerli olur (sürüm kilidi yok). |
| Twitch sohbet modları, mesaj silme | canlı **UNVERIFIED** | Gerçek moderasyon kullanıcı kuralı gereği tetiklenmedi. Gövde kuralları Twitch resmi belgesine göre (yavaş mod 3–120 sn, takipçi modu 0–129600 dk) birim testli; hata/yetenek yolları yalıtılmış AxBoT'a karşı 8 durumda doğrulandı. Kick ve YouTube'da resmi sohbet modu API'si yok → devre dışı + neden. |
| Ses ölçerleri | yalnız okuma, talebe bağlı | OBS aboneliği ilk istekte açılır, 10 sn istek gelmezse kapanır; arayüz 5/sn yoklar. Tüm girişler o an sessiz olduğu için canlı ölçümde yalnız -100 dBFS görüldü; dönüşüm birim testli. |
| Tek seferlik test başarısızlığı | izleniyor | `server_api` paketinde bir çalıştırmada 22 testten 1'i başarısız oldu; çıktı o an filtrelendiği için hangi test olduğu kaydedilmedi. Sonraki 41 çalıştırmada (12 sıralı, 4 eşzamanlı yük altında, 25 döngü) tekrar etmedi. Test devre dışı bırakılmadı; olası neden paylaşılan ortam/port yarışı. Yeniden görülürse tam çıktı saklanacak. |
| Eski AxBoT dağıtım arşivleri | dikkat | `release\AxBoT-v1.0.0-*.zip` arşivleri AGPL `tiktok-live-connector` 2.5.0 içerir; klasörler 2.4.0'a indirildi ama arşivler yeniden paketlenmedi. |

## Yerel yayın çekirdeği (ADR-003) — 2026-09-26

| Konu | Durum | Açıklama |
|---|---|---|
| Kurulu OBS gerekir | tasarım gereği | Çekirdek kullanıcının kurulu OBS 32.x kitaplıklarını kullanır; OBS yoksa ya da ana sürüm farklıysa açık hatayla başlamaz (panelin geri kalanı etkilenmez). |
| Yakalama kaynakları (ekran, oyun, mikrofon, masaüstü sesi) | **UNVERIFIED** | Kod yolu var; kullanıcı kuralı gereği sınamada ekran/oyun/cihaz yakalanmadı. Oyun yakalama, libobs'un oyuna kanca enjeksiyonunu kullanır (OBS ile aynı mekanizma). |
| Kamera, pencere yakalama | MISSING | Cihaz/pencere seçimi arayüzü yok. |
| Sahne düzenleyici | PARTIAL | Kaynaklar tuvale sığdırılarak ya da sol üste eklenir; sürükle-bırak, kırpma, kilit, grup, geri al yok. Tek sahne/tuval. |
| Hedef başına ses izi / ayrı ses karışımı | MISSING (arayüz) | Çekirdek 6 iz destekler; panel tek AAC kodlayıcı kullanır. |
| Kayıt ve tekrar arabelleği | PARTIAL | Çekirdek kaydı destekler (sınamada paylaşılan kodlayıcıyla); panelde kayıt düğmesi ve tekrar arabelleği yok. |
| Hedef tuvali | oturum içinde sabit | Bir hedef bir motor oturumunda ilk bağlandığı tuvalde kalır; değiştirmek için motor yeniden başlatılır. |
| Önizleme boyutu | ilk istek belirler | Bir tuvalin önizlemesi ilk istenen genişlikte açılır (varsayılan 480). |
| Kurulum dosyası (NSIS) | motor YOK | Motor portable pakete girer; Tauri kaynaklarına eklemek, motor derlenmemişken panelin kendi derlemesini kıracağı için kurulum dosyasına henüz eklenmedi. |
| Yardımcı programlar | kopyalanır | `obs-ffmpeg-mux.exe`, `obs-nvenc-test.exe` vb. kurulu OBS'ten çekirdeğin klasörüne kopyalanır (libobs onları çalışan exe'nin yanında arar). |
| GO LIVE bütünleşmesi | PARTIAL | Motor hedefleri Yayın motoru panelinden tek tek başlatılır; mevcut "GO LIVE" düğmesi FFmpeg yönlendiricisini kullanır. |

## OBS iş akışı paritesi (2026-09-28) — güncel durum

Yukarıdaki "Yerel yayın çekirdeği" tablosundaki şu satırlar **artık geçerli değil**: sahne düzenleyici (çoklu sahne,
sürükle/boyutlandır, kırpma, kilit, grup, geri al var), hedef başına ses izi (profil ataması), kayıt ve tekrar
arayüzü, hedef tuvali (hedef atama değişince çıktı yeniden kurulur), GO LIVE bütünleşmesi (Denetimler dock'u motoru
kullanır), NSIS (motor kurulum dosyasına girer). Ayrıntı: [OBS_FUNCTIONAL_PARITY_SPEC](OBS_FUNCTIONAL_PARITY_SPEC.md).

| Konu | Durum | Not |
|---|---|---|
| Ekran/pencere/oyun/kamera/mikrofon/masaüstü/uygulama sesi yakalama | UNVERIFIED | Kullanıcı kararı: yalnız sentetik sınama. Özellik anahtarları örneksiz doğrulandı; oyun yakalama örneği hiç oluşturulmadı |
| Ses izleme | yalnız "kapalı" sınandı | Hoparlöre ses verilmez kuralı |
| Küresel kısayol basışı | UNVERIFIED | Masaüstü girdi otomasyonu kullanılmaz; eylemler kayıt defteri üzerinden sınandı |
| Gerçek platforma yayın | UNVERIFIED | Yalnız 127.0.0.1 alıcıları; "Sına" yalnız TCP bağlantısı |
| Ek tuvaller (OBS 31+) içe aktarımı | KISMİ | Sahneler `canvas_uuid` ile kendi ek tuvallerine aktarılır (en çok 8); OBS tuval boyutunu dosyada saklamadığı için 1920×1080 alınır ve not düşülür |
| Solo | YOK | OBS'te de yok |
| Video/ses ayarı değişimi | çıktı yokken | Kare hızı, çözünürlük, renk, örnekleme değişince motor yeniden başlar; yayın/kayıt sürerken reddedilir (OBS'te de) |
| HDR (Rec. 2100) | UNVERIFIED | Ayar ve 10 bit biçim zorunluluğu var; HDR kodlama/ekran çıktısı sınanmadı |
| Etkileşim: tuş iletimi arayüzden | kısmi doğrulama | Motor sınamasında "g" tuşu sayfaya ulaştı; arayüzde tıklama doğrulandı, arayüz üzerinden yazma ölçümü tamamlanmadı |

**2026-09-28 ikinci tur — kapananlar** (önceki sürümde YOK olan satırlar): Etkileşim penceresi (tarayıcı kaynağına
tıklama/tekerlek/klavye; motor `sinama` + tarayıcı bölmesinde tıklama → zemin rengi değişti), Alt+sürükle kırpma,
öğe gösterme/gizleme geçişleri (OBS içe aktarımı dahil), sahne ve grup filtreleri, dock sekme grupları + Çoklu
Sohbet / Etkinlik Akışı / Hızlı Eylemler dockları, ayarlanabilir taban/çıkış çözünürlüğü ve ölçek filtresi, kare
hızı 24–144, örnekleme hızı ve kanallar, renk biçimi/uzayı/aralığı, RTMP ağ ayarları (bağlanılacak IP, IP ailesi,
düşük gecikme, dinamik bit hızı, yeniden bağlanma), GPU kullanımı (Windows "GPU Engine" 3D sayaçları; sistem ve
motor süreci; sayaç yoksa "ölçülemiyor").
| Ekran görüntüsü doğrulaması | kısıtlı | Tarayıcı bölmesi 560×301; düzen DOM ölçümüyle doğrulandı |

## OBS arayüz paritesi — 2026-09-29 turu

Madde madde durum: [OBS_UI_PARITY_CHECKLIST](OBS_UI_PARITY_CHECKLIST.md). Bu turda kapananlar: ekran görüntüsü
(çıkış, Studio Mode önizlemesi, sahne, kaynak), deinterlace, karıştırma yöntemi, ağdan düşen kare yüzdesi, Studio
Mode T-bar, yeniden muxla, Multiview, kaynak araç çubuğu.

| Konu | Durum | Not |
|---|---|---|
| Yeniden muxla | kurulu OBS'e bağlı | FFmpeg kitaplıkları dağıtılmaz; kurulu OBS 32'nin `avformat-62`/`avcodec-62`/`avutil-60` DLL'leri kullanılır. Başka FFmpeg sürümünde (OBS güncellemesi) yapı düzeni doğrulanmadığı için remux açıkça reddedilir — sürüm eklenince yeniden doğrulanmalı |
| Yeniden muxla: bozuk kayıt | kısmi | Yarım MKV'de (sınamada 200 KB'ye kesildi) FFmpeg dosya sonu bildirdi, okunabilen kısım MP4'e yazıldı; "yarım" işareti yalnız okuma hatayla biterse görünür |
| Multiview | tek düzen | Üstte önizleme/program, altta ilk 8 sahne ("Multiview'da göster" var); OBS'teki diğer düzenler ve etiket/güvenli alan seçenekleri yok |
| T-bar | sabit geçişlerde yok | Kes ve Stinger (libobs "fixed" geçişler) T-bar ile sürüklenemez; OBS'te de devre dışıdır |
| Deinterlace görsel etkisi | UNVERIFIED | Geçmeli kaynak (yakalama kartı) yok; ayar libobs'ta saklanır ve geri okunur |
| Hızlı geçiş: geçici tür değişimi | kısmi | Hızlı geçiş sürerken tuvalin geçişi o türe alınır, süre + 250 ms sonra geri kurulur; bu arada başka geçiş başlatılırsa geri kurma yine olur |
| Ek tuvaller | 8 sınırı, boyut yeniden başlatmada | En çok 8 ek tuval; boyut değişikliği motor yeniden başlayınca uygulanır; silinen tuval nesnesi motor oturumu boyunca boş kalır (bağlı kodlayıcıları serbest bırakmak güvenli değil). Kayıt ve tekrar arabelleği yalnız yatay (+ isteğe bağlı dikey) tuvalden |
| Yayın bilgisi | gerçek kanalda sınanmadı | Kick/Twitch/YouTube istekleri yalnız sahte `fetch` ve ağsız uçlarla sınandı (UNVERIFIED). Kick (`channel:write`) ve Twitch (`channel:manage:broadcast`) için eski bağlantılarda yeniden bağlanmak gerekir. YouTube kategori/etiketi yalnız yayın kimliği video olarak doğrulanırsa değişir |
| Yayın takvimi: Discord etkinliği | gerçek sunucuda UNVERIFIED | Bot token ve sunucu kimliği kimlik kasasında (yanıtlarda dönmez, uçlar yalnız loopback). Discord istekleri yalnız sahte token (401) ve doğrulama yollarıyla sınandı; botun "Etkinlikleri Yönet" izni yoksa 403 gösterilir. Konum 100, ad 100 karakterde kesilir |
| Hareket geçişi | sade | Move eklentisinin seçenekleri (eğri türleri, gecikme, metin/sayı geçişi) yok; grup içeren sahnede yumuşak geçiş; T-bar'da yumuşak geçiş gibi |
| Altyazı: konuşma tanıma | yerel model (Y13) | Ayarlar → Canlı altyazı: Whisper (transformers.js) panel sayfasında çalışır; model onayla Hugging Face'ten bir kez iner (base ~150 MB, small ~500 MB), ses dışarı gitmez. Panel (Studio penceresi) açıkken çalışır. RTX 5070'te WebGPU ile 5,8 sn ses ~1 sn; kesin satır konuşma bitince ~1,2 sn sonra. Türkçe doğruluk gerçek sesle UNVERIFIED (deneme yalnız İngilizce sentetik sesle); Tauri penceresinde mikrofon izni ve CSP UNVERIFIED (tarayıcıda sınandı). Whisper'ın bilinen uydurmaları ("Altyazı M.K." vb.) ve tekrar döngüsü süzülür |
| Betikler | DESTEKLENMİYOR | obs-scripting ön yüze bağlı; yerine Kontrol Merkezi otomasyonu |
| Altyazı: CEA-608 | sade | Kesinleşen satır isteğe bağlı OBS'e gider (yayın açık olmalı); ş/ğ/ı Latin karşılığıyla gider. Platform oynatıcısında görünüm UNVERIFIED (yalnız akış baytları doğrulandı) |
| Özel tarayıcı dock'u ve CSP | ödünleşim | Masaüstü uygulamasının CSP'sinde `frame-src` https ve yerel adreslere açıldı (önceden yalnız Kick/YouTube). Çerçeve `sandbox` ile açılır (üst pencereye gezinme yok, köken farklı olduğundan uygulamaya erişim yok), `script-src` değişmedi. Bazı siteler çerçeve içinde açılmayı reddeder (X-Frame-Options) — "Tarayıcıda aç" düğmesi sunulur |
