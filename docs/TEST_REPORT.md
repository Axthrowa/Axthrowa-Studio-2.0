# Test Raporu — Streaming OS turu

Son çalıştırma: 2026-09-26. Tur başındaki sayılar `CURRENT_SYSTEM_AUDIT.md`'den. Hiçbir test devre dışı bırakılmadı, atlanmadı ya da gevşetilmedi. Başarısız olan her
test asıl nedeni düzeltilerek geçirildi (aşağıda "Testlerin yakaladıkları").

## Sonuçlar

| Paket | Komut | Sonuç | Tur başındaki durum |
|---|---|---|---|
| Panel ön yüz (TS) | `npx vitest run` | **342/342**, 35 dosya (2. tur sonu) | 314 / 29 dosya |
| Panel Rust kitaplık | `cargo test --lib` | **236/236** (2. tur sonu) | 192 |
| Panel API bütünleşme | `cargo test --test server_api` | **22 geçti, 1 bilerek yok sayılan** (2. tur sonu) (`serve_portable`: gerçek `cikti\portable` ile sunucuyu açık tutan geliştirme yardımcısı, test değil) | 21 (1 yok sayılan dahil) |
| Çoklu yayın uçtan uca (gerçek FFmpeg) | `cargo test --test multistream_e2e` | **2/2** (~21 sn) | yoktu |
| Resonance widget | `npx vitest run` (resonance/) | **71/71**, 4 dosya | 71 |
| StreamAxT sunucu | `npx vitest run` (server/) | **462/462**, 32 dosya (2. tur sonu) | 431 / 27 dosya |
| StreamAxT istemci | `npx vitest run` (client/) | **81/81** | 75 |
| Tip denetimi | `tsc --noEmit` (panel, StreamAxT sunucu+istemci) | temiz | — |
| Rust lint | `cargo clippy --lib --tests --examples` | uyarısız | — |
| Rust crate lisansları | `node scripts/lisans-denetimi.mjs` | 579 crate, izin listesi dışı yok | — |
| Üretim derlemesi | `vite build` (panel, StreamAxT istemci), `tsc` (StreamAxT sunucu), `cargo build --release --example headless_server` | başarılı | — |

## Bu turda eklenen testler

**Çoklu yayın (Rust)**
- `multistream/flv.rs`: parçalı akış ayrıştırma, FLV olmayan akış reddi, 8 MB üstü etiket reddi, AVC anahtar kare /
  dizi başlığı, Enhanced RTMP (HEVC/AV1), geç katılma ve yeniden bağlanmada zaman tabanı.
- `multistream/state.rs`: yaşam döngüsü, kopma → yeniden bağlanma → tükenme, kapalı hedef, sınırlı geri çekilme,
  sağlık kararı.
- `multistream/config.rs`: geçerli adresler, **sunucu alanına yapıştırılan anahtarın reddi**, şema ve Kick RTMPS
  kuralı, maskeleme, bozuk ayar listesi.
- `multistream/policy.rs`: Kick kuralları, uygun ayarda bulgu yok, Twitch eşzamanlı yayında birleşik sohbet uyarısı,
  YouTube anahtar kare, FFmpeg yoksa engel.
- `multistream/obs_profile.rs`: gelişmiş/basit kip, kesirli FPS, kodek eşlemesi, bozuk JSON güvenliği
  (`service.json` — yayın anahtarı — **hiç okunmaz**).
- `multistream/mod.rs`: anlık görüntü anahtar sızdırmaz; oturumsuz/anahtarsız hedef başlamaz; **yavaş hedef anahtar
  kareye kadar atlanır, diğeri etkilenmez** (mutasyonla doğrulandı: düşürme satırı bozulunca başarısız).
- `tests/multistream_e2e.rs` (gerçek FFmpeg, platform yok): bağımsız başlat/durdur + geç katılma + 0 çözme hatası;
  kopan hedef diğerini etkilemez ve geri bağlanır.
- `tests/server_api.rs`: `foreign_sites_cannot_drive_the_local_api`,
  `multistream_api_keys_never_leak_and_actions_are_audited`.
- `secret_store.rs`: **sır ayrı okumada kalıcı** (keyring mock deposu gerilemesi — düzeltme olmadan başarısız olduğu
  doğrulandı); WS mesajında OBS şifresinin her derinlikte silinmesi; şifresiz metnin aynen geçmesi.

**Panel ön yüz (TS)**
- `controlCenter.test.ts`: düzen ayrıştırma/göç, gizle/genişlik/sıra, hazır düzenler, durum etiketleri, bayt biçimi,
  yeni panelin eski kayıtlı düzene gizli eklenmesi.
- `streamaxt.test.ts`: StreamAxT kök adresi (port korunur, zararlı şema reddedilir), ses girişi kuralı.

**StreamAxT**
- `modules/alerts/control.test.ts`: uyarı kuyruğu denetimi (duraklat/sürdür/atla/sustur/temizle/yeniden oynat),
  iyimser sürüm çakışması, benzersiz uyarı kimliği.
- `core/security/oauth-state.test.ts`: port çözümü, Kick geri dönüş adresi, `state` eşleşmesi/süresi/tek kullanım.
- `modules/moderation/shield-rules.test.ts`: kalkan kuralları (kapalı kalkan, büyük harf, emoji, link, abone,
  muafiyetler), Türkçe büyük harf, Kick emote işaretlemesi.
- `client/src/lib/lib.test.ts`: `sunucuPortu`, kaydedilmemiş değişiklik kaydı ve anlık görüntü karşılaştırması.

## Canlı / elle doğrulamalar (tarayıcı bölmesi, yalıtılmış veri)

| Senaryo | Nasıl | Sonuç |
|---|---|---|
| Kontrol Merkezi uçtan uca | başsız sunucu + Vite; arayüzden hedef ekle → GO LIVE → sentetik kaynak | kartta "Canlı · 2659 kbps · 38 fps"; hedef tek başına durduruldu (alıcı 420 kare, 0 çözme hatası); "Hepsini bitir" çift onay; denetim günlüğünde 4 olay |
| Yayın öncesi kontrol | gerçek OBS profili okundu | H.264, 8000 kbps CBR, 2 sn, 1920×1080@60; "OBS bağlı değil" uyarısı |
| Uyarı kuyruğu denetimi | yalıtılmış StreamAxT (3012) | 11/11 senaryo; widget duraklat/sürdür |
| Kick OAuth | yalıtılmış StreamAxT (PORT=3012) | adres 3012'yi izliyor; yabancı / yinelenen / eksik `state` reddedildi; Kick hata parametresi geçti |
| Kaydedilmemiş değişiklik | yalıtılmış StreamAxT | şerit, onay diyaloğu (Vazgeç korur), geri tuşu, şeritten kaydet, geri alınca şerit kaybolur; 4 sayfada yanlış alarm yok |
| Kalkan modu | yalıtılmış veritabanıyla derlenmiş modüller | 9/9 (kapalı kalkan, 3 kural, normal mesaj, mod muafiyeti, sayaç, ayarın taze okunması, WS kararı); arayüzde kural aç/kapa kaydı |
| Performans | release başsız sunucu, 1/3/5 hedef | PERFORMANCE_REPORT.md |

**Hiçbir test gerçek platforma yayın açmadı, gerçek sohbet mesajı / bildirim / ödeme / moderasyon eylemi
tetiklemedi, kullanıcının gerçek OBS'ini değiştirmedi.** StreamAxT denemeleri gerçek veritabanının değil,
`scratchpad/sx-test2/data` altındaki yalıtılmış kopyanın üzerinde yapıldı; değiştirilen test değerleri geri alındı.

## Testlerin yakaladıkları (asıl neden düzeltildi)

1. **Sırlar hiç kalıcı değildi:** `keyring 3` platform özelliği olmadan sahte depoya düşüyordu (API testinde
   `hasKey: false`) → `windows-native` özelliği + gerileme testi.
2. **Geç katılan hedef çözülemiyordu:** çalışan hedeflere dizi başlığı iletilmiyordu → düzeltildi.
3. **Durdurmada son ~2 sn kayboluyordu:** doğrudan öldürme → stdin kapat, 3 sn bekle.
4. **Uyarılar tekrarlanan kimlikle yutuluyordu** (her türün yalnız ilki oynuyordu) → benzersiz kimlik.
5. **Kontrol Merkezi okunabilirlik sözleşmesini ihlal etti** (`text-white/35–45`, AA altı) → `text-panel-muted`.
6. **Ölçüm sırasında "tek hedefte iki yayıncı"** — hata değil, geçici test verisinde kalmış ikinci etkin hedefti;
   yönlendirici doğru davranmıştı (bağlantı reddi → geri çekilmeli yeniden deneme).

## İkinci tur (2026-09-26) — eklenen testler ve canlı doğrulamalar

**Eklenen testler**
- Rust: `actions` (eylem ayrıştırma, parametre, onay; 5 test), `multistream::policy` bant genişliği bulguları,
  `multistream` yavaş hedef dağıtıcısı, `obs_client::tuval_tests` (tuval sağlayıcısı, dBFS dönüşümü, kanal özeti),
  `secret_store` OBS parolası metin ayıklama; API: `action_registry_enforces_confirmation_availability_and_audit`
  (sahte StreamAxT ile; OBS yokken tuval/ölçer uçları 409).
- Panel TS: `api/actions.test.ts`, `chat/chat.test.ts` (evrensel sohbet modeli), `deck.test.ts`,
  `controlCenter.test.ts` (yeni panelin hazır profile göre göçü), `licenses.test.ts`, ses ölçeri ölçeklemesi.
- StreamAxT: `platforms/twitch-rules.test.ts` (sohbet modu gövdesi ve sınırları), değişken motoru `$(jsonset)` /
  `$(jsonunset)` (prototip kirletme reddi dahil), `core/licenses.test.ts`.

**Canlı / elle doğrulamalar**

| Senaryo | Nasıl | Sonuç |
|---|---|---|
| Kontrol destesi | başsız sunucu + Vite + yalıtılmış StreamAxT (3012) | duraklat/sürdür 3012'de durum değiştirdi (`updatedBy: yerel`); onaylı düğmede ilk dokunuş istek göndermedi, ikincisi `ACTION:alert.clear ok:true`; OBS yokken sahne düğmesi "OBS bağlı değil" ile devre dışı; ekle/sil/taşı/sayfa işlemleri yeniden yüklemede korundu |
| Donanım deste HTTP yolu | curl | kökensiz 200, yabancı köken/host 403, onaysız 428 |
| OBS istemcisi | `cargo run --example obs_probe` (gerçek OBS 32.2.2, yalnız okuma) | 5 sahne, 11 giriş, 2 tuval (SE.Live dikey tuvali tanındı), 8 girişte ölçüm (~50 ms taze), 12 sn boşta abonelik kapandı |
| Evrensel sohbet | tarayıcı | yazı boyutu 12/14/16 döngüsü ve kalıcılık; hızlı art arda tıklamada eski kapanım hatası bulundu ve düzeltildi |
| Bant genişliği bulgusu | gerçek OBS profili (8000 kbps, 3 hedef) | gereksinim 25,7 Mbps; 20 Mbps girilince "aşıldı" uyarısı |
| StreamAxT moderasyon uçları | yalıtılmış örnek | 8 hata/yetenek yolu beklenen kodlarla |
| Kararsızlık avı | `server_api` 25 döngü + 12 sıralı + 4 eşzamanlı | 0 başarısız (tek seferlik başarısızlık KNOWN_LIMITATIONS'ta) |

Hiçbir doğrulama gerçek sohbet mesajı, moderasyon, bildirim, ödeme ya da yayın tetiklemedi; kullanıcının OBS'inde
hiçbir ayar/sahne değişmedi.

## Yerel yayın çekirdeği (ADR-003) — 2026-09-26

| Paket | Komut | Sonuç |
|---|---|---|
| Çekirdek birim | `cargo test --release` (motor/) | **12/12** (yapı boyutları başlıklarla, günlükte anahtar maskesi, sinyal → durum, ters sıralı sinyal, önizleme boyutu, protokol ayrıştırma) |
| Çekirdek protokol uçtan uca | `tests/hizmet.rs` | **1/1** — gerçek libobs, sentetik sahne, yerel alıcıya yayın, önizleme PNG, istatistik, durdur, temiz çıkış; anahtar protokol çıktısında ve libobs günlüğünde yok, günlükte hata yok |
| Çekirdek sentetik senaryo | `yayin-motoru sinama` | **14/14** (aşağıda) |
| Panel API | `cargo test --test server_api` | **23/23** (+1 yok sayılan) — yeni `motor_api_sentetik_kaynak_ve_hedef` |
| Panel kitaplık | `cargo test --lib` | **238/238** |
| Panel ön yüz | `npx vitest run` | **344/344**, 36 dosya |
| Lint | clippy (panel + çekirdek, `--all-targets`) | uyarısız |

`yayin-motoru sinama` denetimleri: NVENC seçildi · üç hedef canlı · kapalı porttaki hedef tek başına başarısız (kod
-2) · B tek başına durdu · **B durunca çekirdeğin B soketi kapandı** (bulunan hatanın gerileme denetimi) · A ve C canlı
kaldı · B yeniden başladı · A 1920×1080 ve C 1080×1920 kesintisiz, 0 çözme hatası · B iki parça tam · kayıt paylaşılan
kodlayıcıyla · kayıt durumu ters sinyale dayanıklı · önizleme iki tuvalde (480×270, 270×480) · düşen kare 0.

Tarayıcı (başsız sunucu + gerçek çekirdek, yalnız renk + yazı): arayüzden başlat → önizlemeler → hedef dikey tuvalle
canlı (alıcıda 1080×1920, 1131 kare, 0 hata) → yönlendiriciden aynı hedef 409 → durdur → motoru çift tıklamayla kapat
(çıkış 0) → denetimde 6 `MOTOR_*` kaydı.

**Sınanmayanlar (kullanıcı kuralı):** ekran, pencere, oyun yakalama, kamera, mikrofon, masaüstü sesi — kod yolu var,
çalışma anında `UNVERIFIED`.

## OBS iş akışı paritesi (2026-09-28)

Komitler: 070326b, cb8b503, 6cd90a2, 1c6f0be, a140c38, f23418e, b9aba4b.

| Katman | Sonuç |
|---|---|
| Motor `sinama` | **35/35** (yeni: tarayıcı kaynağı — kare değişimi + WebAudio −26 dBFS + durum; yakalama türü özellikleri örneksiz; çok izli kayıt iz 1 −91 / iz 2 −21 dB; hibrit MP4 iki iz; koleksiyon değişiminde grafik temizlenir, çıktılar sürer) |
| Motor birim | 19 (olay satırı alan sırası, yol dönüşümü, çökme kaydı modülü, JPEG) |
| Panel birim (Rust) | **290** (koleksiyon v2 göçü, OBS içe aktarımı, profil, dönüşüm doğrulama, çift ses, abonelik, bant genişliği önerisi, güvenli başvuru, basılı eylemler) |
| Panel entegrasyon | **30** geçti, 1 elle çalıştırılan göz ardı (yeni: `motor_v2_sahneler_gruplar_filtreler_koleksiyonlar`, `motor_profil_kodlama_paylasimi_ve_kayit`, `multistream_anahtar_goster_sil_ve_baglanti_sinamasi`, `motor_kisayol_eylemleri_bas_konus_ve_sahne`, `motor_sihirbaz_yerel_kodlama_sinamasi`) |
| Ön yüz (vitest) | **383** (sahne ağacı/geometri, geri al, dock düzeni, ses hesapları, canlı akış satırları, projektör, komut paleti) |
| clippy (panel + motor) | 0 uyarı |

Testlerin yakaladıkları (asıl neden düzeltildi): libobs modül adını yalnız `/` ile ayırdığı için CEF önbellek yolu
bozuluyor ve motor 0x80000003 ile duruyordu; motor olay satırları `to_value` ile alfabetik sıralanıyordu (kareler
WebSocket'e yönlenmiyordu); "İ" küçük harfe çevrilince birleşik nokta üretiyordu (koleksiyon kimliği); paralel
testlerde süreç geneli ortam değişkeni yarışı; panel yeni kaynakları eski v1 türüyle oluşturuyordu.

Arayüz sınaması: [UX_ACCEPTANCE_TESTS](UX_ACCEPTANCE_TESTS.md).

## OBS arayüz paritesi — plan §4 (2026-09-29)

Komitler: b855b0f, cba0f8c, c5a5d07, ddce4f8, a281802, 892e2fa.

| Katman | Sonuç |
|---|---|
| Motor `sinama` | **48/48** (yeni: tam çözünürlük ekran görüntüsü 1920×1080 + göreli yol reddi; sahne/kaynak ekran görüntüsü boyutları; deinterlace gidiş-dönüş + ret; karıştırma yöntemi; T-bar — sabit geçiş reddi, ortada bırakınca sürer, sona/başa bırakınca program; yeniden muxla MP4→MKV 1200→1200 kare, 20,00 s, çözme hatası 0, üzerine yazma reddi; Multiview hücre pikselleri, boş hücre siyah, yabancı tuval sahnesi reddi) |
| Motor birim | 26 (remux çıktı biçimi, AVRational düzeni, Multiview düzeni) |
| Panel birim (Rust) | **300** (OBS içe aktarımında deinterlace + blend_method, remux çıktı kuralları) |
| Panel entegrasyon | **36** geçti, 1 elle çalıştırılan göz ardı (yeni: `motor_ekran_goruntusu_deinterlace_karistirma_yontemi_tbar` — ekran görüntüsü, kaynak görüntüsü, deinterlace kalıcılığı, karıştırma yöntemi, T-bar, Multiview; `remux_kuyrugu_mkv_mp4`) |
| Ön yüz (vitest) | **399** (T-bar bırakma kuralı) |
| clippy (panel + motor) | 0 uyarı |

Tarayıcı bölmesinde (başsız sunucu, geçici veri kökü) elle: Dosya › Ekran görüntüsü → 1920×1080 PNG; sahne bağlam
menüsünden ekran görüntüsü; kaynak menüsünde Deinterlace diyaloğu (Yadif + alt alan → menü "Deinterlace: Yadif");
T-bar ortada bırakıldı (program değişmedi, kaydırıcı %50'de kaldı) → sona çekildi (program "Oyun", kaydırıcı sıfırlandı);
Remux penceresi kayıt klasöründeki MKV'yi MP4'e çevirdi (ffprobe 5,0 s); Multiview canlı karesi, program kırmızı
çerçeve; kaynak araç çubuğunda medya denetimleri ve konum.

Testlerin yakaladıkları (asıl neden düzeltildi): Multiview'da iç içe sahnenin tuval dışına taşan öğeleri hücreden
taşıyordu → ölçek filtresiyle öğe kaynak boyutunda dokuya çizdirildi (OBS multiview'unun kırpmasına eşdeğer);
başsız sınama sunucusu ekran görüntülerini kullanıcının Videolar klasörüne yazacaktı → geçici köke yönlendirildi.

### Ek (2026-09-29 → 10-01): kalan OBS arayüz maddeleri

Komitler: 34cf983 … 4656405 (Sıra menüsü, mikser yüzde/dikey düzen, yalnız etkin kaynaklar, çökme raporları,
profil klasörü, adlandırılmış/hızlı geçişler, önizleme ölçekleme ve yakınlaştırma, Erişilebilirlik renkleri,
önizlemeyi devre dışı bırak, tam ekran arayüz, kalan kayıt süresi, kaynak rengi, döndürme tutamacı, Özellikler ›
Varsayılanlar).

| Katman | Sonuç |
|---|---|
| Motor `sinama` | **48/48** |
| Panel birim (Rust) | **300** (OBS `transitions` listesinin içe aktarımı) |
| Panel entegrasyon | **36** geçti, 1 elle çalıştırılan göz ardı (genişletilen: adlandırılmış geçiş ekle/seç/sil, hızlı geçiş + geri kurma, kaynak rengi, Varsayılanlar, çökme günlüğü uç noktası) |
| Ön yüz (vitest) | **412** (önizleme ölçek hesapları, döndürme geometrisi, kalan kayıt süresi, erişilebilirlik renk doğrulaması, hızlı geçiş etiketi, yüzde gösterimi) |
| clippy | 0 uyarı (`Okuma::Tamam` kutulandı) |

Tarayıcı bölmesinde elle: Slide geçişi eklenip seçildi, Studio Mode'da "Slide 400 ms" hızlı geçişi programı değiştirdi
ve tuvalin geçişi geri kuruldu; Ctrl+tekerlek ×1,25, %100'de seçim isabeti, orta tuşla kaydırma, Ctrl+0; renk körlüğü
hazırı CSS değişkenlerine uygulandı; mikser dikey düzende ölçer aşağıdan yukarı; önizleme kapatılınca kare yok;
3 dakikalık sınama kaydında kalan süre 40,8 GB / 5256 kbps → 18 sa 32 dk (kayıt sonra silindi); kaynak rengi şeridi;
döndürme tutamacıyla 90° → merkez aynı piksel, Ctrl+Z geri aldı.

Testlerin yakaladıkları: Geçişler dock'unda üç düğme 171 px genişlikte taşıyordu (ayrı satıra alındı); yakınlaştırılmış
önizlemede flex ortalaması taşan sol/üst kısmı erişilemez yapıyordu (kaydırılabilirken başa hizalama); sentetik
işaretçide `setPointerCapture` hata atınca orta tuşla kaydırma başlamıyordu (korundu).

### Ek (2026-10-02 → 10-05): son OBS paritesi maddeleri

Komitler: 2504f5c … 4d43a41 (bağlı sahneler, tüm docklar ayrı pencerede, sanal kamera kaynak hedefi, Araçlar ›
Altyazı (CEA-608), Yayın Bilgisi dock'u (Kick), ek tuvaller, OBS'ten ek tuval aktarımı).

| Katman | Sonuç |
|---|---|
| Motor `sinama` | **54/54** (yeni: sanal kamera kaynak hedefi — 200×400 yeşil kaynak 16:9 tuvalde ortada, kenar siyah, kaynak silinince tuval kapanır; altyazı — alıcı dosyasındaki GA94 SEI baytları çözülerek "SINAMA ALTYAZI 42" yalnız seçilen hedefte bulundu, diğer hedef altyazısız, boş metin / etkin olmayan hedef reddedildi; ek tuval — 640×640 tuval kendi en-boyunda kare verir, sahnesi programda, boşaltılınca sahnesi kalkar, ana tuval boşaltılamaz) |
| Panel birim (Rust) | **306** (CEA-608 metin dönüşümü, Kick kapsam eşleşmesi, kanal güncelleme gövdesi doğrulaması, OBS `canvas_uuid` aktarımı) |
| Panel entegrasyon | **42** (1 elle çalıştırılan göz ardı); yeni: `motor_bagli_sahneler`, `yayin_bilgisi_kick_bagli_degilken` (ağsız: 409/428/400), `motor_ek_tuvaller` (ekle → önizleme 320×320, adlandır, boyut → yeniden başlatma gerekir, sil, kimlik yeniden kullanılmaz, motor yeniden başlayınca koleksiyondan kurulur); genişletilen: sanal kamera `kaynak:` hedefi, altyazı ucu + `engine.caption.send` |
| Ön yüz (vitest) | **430** (her dock ayrı pencereye çıkarılabilir, etiket ayrıştırma, tuval adları/kimlik kuralı) |
| clippy | 0 uyarı |

Dış ağ dalgalanması: `youtube_endscreen_probe_reports_real_cards` tam koşuda bir kez başarısız oldu (YouTube o anda bitiş
ekranı içermeyen sayfa sürümü döndürdü); kod değişmeden iki yeniden koşuda geçti. Test kapatılmadı.

Sınanmayanlar (UNVERIFIED): altyazının platform oynatıcısında görünümü (FFmpeg libobs'un kare sonuna yazdığı SEI'yi
okumaz — "late SEI"); Kick kanal güncellemesi (gerçek kanal değiştirilmedi); yeni arayüz parçaları tarayıcı bölmesinde
görülmedi (Altyazı, Yayın Bilgisi, Tuvaller, ayrı pencere docklar).

### Ek (2026-10-05): kalan maddeler — Yayın Bilgisi (Twitch/YouTube), Sahneyi çoğalt, Hareket geçişi

Komitler: 1fad182 … 5e1922b.

| Katman | Sonuç |
|---|---|
| Motor `sinama` | **56/56**, art arda iki koşu (yeni: "Sahneyi çoğalt" — asıl sahneden öğe kaldırılınca program kırmızı kalır, önizleme siyah, programdaki sahne silinemez, Studio Mode kapanınca program asıl sahne; Hareket — 3 sn'lik geçişin yarısında öğenin sol üstü (≈491, 245) iki uç arasında, sonda hedef sahne ve kare, araya giren kesme hareketi iptal eder) |
| Motor birim | **29** (eğri uçları/simetri, ara değer ve en kısa açı) |
| Panel birim (Rust) | **308** (studyo_cogalt varsayılanı ve sınırı, `move_transition` → hareket aktarımı) |
| Panel entegrasyon | **41** (1 elle çalıştırılan göz ardı); genişletilen: Hareket tür listesi + adlandırılmış geçiş + Studio Mode geçişi |
| Ön yüz (vitest) | **435** (sahte `fetch`: Twitch PATCH gövdesi ve belge sınırları, kapsam yoksa yazma reddi; YouTube snippet birleştirme, video doğrulanınca `videos.update`, doğrulanmazsa yalnız başlık `liveBroadcasts.update`) |
| clippy | 0 uyarı (motor + panel) |

Testlerin yakaladıkları: (1) Tam koşuda bir kez, profil video değişikliğinin motoru yeniden başlattığı adım test istemcisinin
10 sn zaman aşımını aştı — o adımlar diğer uzun testlerdeki gibi 90 sn'lik istemciye alındı (beklentiler değişmedi).
(2) Bir sınama koşusunda önizleme karesi yük altında gecikti ve iki piksel denetimi eski kareyi okudu — hareketin ara
konumu artık öğe durumundan okunuyor, son durumlar 3 sn'ye kadar yoklanıyor.

Sınanmayanlar (UNVERIFIED): Twitch ve YouTube yayın bilgisi gerçek kanalda (yalnız sahte `fetch`); Hareket ve
Sahneyi çoğalt arayüzü tarayıcıda görülmedi.
