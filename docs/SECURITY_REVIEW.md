# Güvenlik İncelemesi — Streaming OS turu

Kapsam: bu turda eklenen/değişen her şey (çoklu yayın yönlendiricisi, HTTP API, Control Plane, Kontrol Merkezi,
AxBoT uyarı denetimi, Kick OAuth, Kalkan modu, kaydedilmemiş değişiklik) + bağımlılık denetimi. Rapor hiçbir
sır, anahtar ya da token değeri içermez.

## Tehdit modeli (kısa)

| Aktör | Erişim | Korunan varlık |
|---|---|---|
| Yayıncının tarayıcısında açık yabancı site | `fetch`/WS ile `127.0.0.1:8843` ve `:3001` | ayarlar, OBS denetimi, yayın başlat/durdur, sırlar |
| LAN'daki cihaz (yalnız isteğe bağlı LAN kipinde) | panel sunucusu `0.0.0.0` | OBS şifresi, uzak yönetim |
| Uzak ekip üyesi (Bearer) | izin kapsamlı API | yalnız verilen izinler |
| Aynı bilgisayardaki yerel süreç | loopback | (güvenilir sayılır — yerel ayrıcalık zaten her şeye erişir) |
| Sohbetteki izleyici | sohbet metni | değişken motoru, komutlar, overlay |

## Bu turda bulunan ve düzeltilen açıklar

| # | Önem | Bulgu | Düzeltme |
|---|---|---|---|
| 1 | **Kritik** | `keyring 3` platform özelliği olmadan derleniyordu → sahte (mock) depo: OBS şifresi, Kick oturumu ve tüm sırlar hiçbir yere yazılmıyor, her açılışta kayboluyordu. Kullanıcılar sırrı tekrar tekrar girmek zorunda kalıyor, geçici çözümler (düz metin) doğuyordu. | `windows-native` özelliği + ayrı okumada kalıcılık gerileme testi (düzeltmesiz başarısız olduğu doğrulandı). a76f2b5 |
| 2 | **Yüksek** | LAN kipinde `/ws/overlay-sync` Bearer istemiyor ama ilk anlık görüntü ve ayar yayınları belleğe enjekte edilmiş **OBS WebSocket şifresini** taşıyordu → LAN'daki her cihaz OBS'i ele geçirebilirdi. | Loopback olmayan istemcilere giden her mesajda `obs.password` boşaltılıyor (kasaya dokunmadan). 0077750 |
| 3 | Orta | Kick OAuth geri dönüşünde `state` hiç denetlenmiyordu; auth-url sorgudan `redirectUri` kabul ediyordu; PKCE doğrulayıcısı istemciye dönüyordu. | `state` tek kullanımlık, 15 dk, sabit zamanlı karşılaştırma; sorgu adresi yok sayılır; doğrulayıcı sunucuda kalır. a9736f0 |
| 4 | Orta | Kalkan modu "katı link/caps kısıtlamaları devreye girer, sohbet temizlenir" diyordu; kuralların çoğu hiç uygulanmıyordu (yanlış güvenlik hissi). | Kurallar gerçekten uygulanıyor; uygulanamayanlar gerekçesiyle "desteklenmiyor". f54d6f9 |
| 5 | Düşük | Ayarlar / Gemini / Chat Oyunları sunucu reddetse de "Kaydedildi" gösteriyordu (kullanıcı korumanın açık olduğunu sanabilir). | Yanıt denetlenir, hata bildirilir. a7083dc |
| 6 | Düşük | AxBoT portu birkaç yerde 3001'e sabitti; başka portta çalışan kurulumda Kick geri dönüşü aynı makinedeki başka bir AxBoT kopyasına gidebiliyordu. | Port tek kaynaktan. a9736f0, 6806ac5 |

## Çoklu yayında uygulanan denetimler

- **Yayın anahtarları** yalnız Windows Kimlik Yöneticisi'nde (`multistream.key.<id>`). Anlık görüntü, WS yayını,
  API yanıtı ve günlükler yalnız `hasKey` taşır (testli). FFmpeg hata satırları anahtar ve tam adres maskelenerek
  kısaltılır. Tam yayın adresi yalnız bellekte kurulur.
- **Sunucu alanına yapıştırılan anahtar reddedilir** (anahtar biçimli yol parçası, >3 parça, sorgu, parça,
  kullanıcı bilgisi); şema yalnız `rtmp`/`rtmps`; Kick yalnız `rtmps`.
- **Komut enjeksiyonu yok:** FFmpeg kabuksuz, argüman dizisiyle başlatılır; tam adres tek konumsal argümandır
  (`rtmp…` ile başladığı için seçenek olarak yorumlanamaz). Pencere açılmaz (`CREATE_NO_WINDOW`).
- **Alıcı** yalnız 127.0.0.1'e bağlanır, her oturumda rastgele port ve anahtar. (Sınır: FFmpeg `-listen` anahtarı
  doğrulamaz — KNOWN_LIMITATIONS.md.)
- **OBS'in kendi yayın anahtarı okunmaz:** `service.json` hiç açılmaz; yalnız profilin kodlayıcı ayarları okunur.
  "OBS'i yönlendiriciye bağla" önceki servis ayarını Kimlik Yöneticisi'nde yedekler, geri yükleme onu geri yazar.
- **Control Plane:** loopback = sahip; uzak istek Bearer + izin (`broadcast.outputs`, `broadcast.read`,
  `audit.read`; admin hepsi). Her yazma eylemi `audit_log`'a kim/ne/ne zaman olarak düşer (testli).
- **Kazara yayın yok:** oturum kapatma sunucuda açık `{"confirm": true}` ister; arayüzde çift tıklama onayı. Hiçbir
  kod yolu kullanıcı eylemi olmadan yayın başlatmaz.
- **Yabancı site koruması** (mevcut `local_guard`): Host izin listesi (DNS yeniden bağlama), yazma istekleri ve WS el
  sıkışmasında köken denetimi, CORS beyaz listesi — yeni çoklu yayın uçları için ayrıca testli.

## AxBoT tarafı denetimler

- Uyarı kuyruğu denetimi yazma uçları mevcut köken/host korumasının arkasında; iyimser sürüm çakışmasında 409; her
  eylem denetim günlüğünde.
- Kalkanın platformda silmesi varsayılan kapalı ve açarken onay ister (gerçek moderasyon eylemi).
- Kick geri dönüş sayfası kullanıcı girdisini `htmlKacisla` ile kaçışlar (mevcut, dokunulmadı).

## Bağımlılık denetimi (2026-09-26)

| Proje | Araç | Sonuç |
|---|---|---|
| Panel (npm) | `npm audit` (üretim + geliştirme) | 0 açık |
| Resonance (npm) | `npm audit` | 0 açık |
| AxBoT (npm workspace) | `npm audit` | 0 açık |
| Panel (Cargo.lock, 580 crate) | OSV.dev sorgusu (cargo-audit kurulu değil; OSV RustSec'i içerir) | 8 danışman, **hiçbiri Windows derlemesinde istismar edilebilir değil**: `rsa` (Marvin) hiçbir hedefte derlenmiyor (yalnız kilit dosyasında); `glib` (unsound) ve `proc-macro-error` (bakımsız) yalnız Linux tepsi zinciri; `unic-*` (bakımsız) yalnız Tauri derleme zamanı `urlpattern`. Bu turda yeni crate eklenmedi. |

## Kalan riskler (kabul edilen)

KNOWN_LIMITATIONS.md "Güvenlik ödünleşimleri": alıcının anahtar doğrulamaması, loopback WS'in OBS şifresini alması
(aynı bilgisayardaki overlay otomasyonu için), uzak `broadcast.outputs` izninin iç ağ adresine hedef ekleyebilmesi.

## İkinci tur (2026-09-26)

| Konu | Uygulanan denetim | Doğrulama |
|---|---|---|
| Eylem kayıt defteri (`/api/actions/run`) | her denetleyici (Hızlı eylemler, Kontrol destesi, Sahne & Ses, donanım HTTP) aynı yoldan: parametre doğrulama (400) → izin (403) → onay (428) → kullanılabilirlik (409) → yürütme → `ACTION:<id>` denetim kaydı; yayın/kayıt kesen eylemler onaysız reddedilir | API testi `action_registry_enforces_confirmation_availability_and_audit`; tarayıcıda deste düğmesi → yalıtılmış AxBoT |
| Donanım Stream Deck HTTP yolu | köken başlığı olmayan yerel istek kabul (loopback güveni — mevcut model); yabancı `Origin` ve yabancı `Host` reddedilir | curl: kökensiz 200, `Origin: https://evil.example` 403, `Host: attacker.example` 403, onaysız `alert.clear` 428 |
| Kontrol destesi yapılandırması | `parseDeck`: kimlik ve eylem kimliği biçimi, parametre adı beyaz listesi (`__proto__` vb. düşer), renk beyaz listesi, kontrol karakterleri temizlenir, sayfa/düğme sayısı sınırlı; renkler sınıf eşlemesiyle (kullanıcı CSS'i enjekte edilemez) | `src/lib/deck.test.ts` |
| OBS tuval ve ölçer uçları | yalnız okuma, `broadcast.read` izni; OBS yoksa 409 (uydurma boş liste yok); ölçer aboneliği talebe bağlı ve kendiliğinden kapanır | API testi 409; `obs_probe` ile gerçek OBS |
| `examples/obs_probe` | OBS WebSocket parolasını obs-websocket'in yerel yapılandırmasından okur, **yazdırmaz**; yalnız okuma istekleri | çıktı incelendi |
| AxBoT moderasyon uçları (mesaj silme, sohbet modları) | platform yeteneği + bağlantı + parametre sınırları (Twitch belgesi) + denetim kaydı; desteklenmeyen platformda açık hata | `twitch-rules.test.ts`, yalıtılmış örnekte 8 hata/yetenek yolu |
| Lisans | panel + Resonance + AxBoT npm kilitleri test ile, Rust crate'leri `scripts/lisans-denetimi.mjs` ile denetlenir; GPL/AGPL/SSPL gelirse test kırılır. Dağıtım klasörlerindeki AGPL `tiktok-live-connector` 2.5.0 → MIT 2.4.0 | `licenses.test.ts` (iki depo), 579 crate temiz |
| Yeni crate'ler (obws 0.15 zinciri: `sha1_smol`, `simdutf8`, `tokio-websockets`, `unicode-xid`) | OSV.dev sorgusu | danışman yok (2026-09-26) |

Rapor hiçbir parola, anahtar, token ya da çerez değeri içermez.

## Yerel yayın çekirdeği (ADR-003) — 2026-09-26

| Konu | Denetim |
|---|---|
| Ağ yüzeyi | Çekirdek port açmaz; yalnız ebeveyn sürecin stdin/stdout'u. `obs-websocket` yüklenmez. |
| Beklenmeyen ağ isteği | `rtmp-services` yüklenmez (obsproject.com'dan servis listesi indirirdi); RTMP servisi kendi türümüz. |
| Yayın anahtarı | Kimlik Yöneticisi → panel köprüsü → çekirdek stdin. Hiçbir yanıtta/olayda yok; libobs günlüğünde RTMP adresinin son yol parçası maskelenir; testler anahtarın protokol çıktısına, denetim kaydına ve günlüğe düşmediğini denetler. |
| Kaynak girdileri | Yalnız mutlak yerel dosya + izinli uzantı; ağ adresi (`http://…`) reddedilir (çekirdek sunucu tarafında URL açmaz). Renk/yazı doğrulanır, kimlikler `[A-Za-z0-9._-]{1,64}`. |
| Yetki | `/api/motor…` uçları izinli: durum/önizleme `broadcast.read`, başlat/durdur `broadcast.stream`, kaynaklar `scene.edit`, hedefler `broadcast.outputs`; motoru durdurmak onay ister (428); tüm eylemler `MOTOR_*` denetim kaydı. |
| İki yayıncı | Aynı hedef hem yönlendiricide hem çekirdekte canlı olamaz (iki yönlü 409). |
| Soket devralma | Kayıt alt süreci açık RTMP soketlerini devralıyordu (durdurulan bağlantı açık kalıyordu) → soketler devralınamaz yapılır; gerileme denetimi var. |
| Kullanıcının OBS'i | Yapılandırmasına yazılmaz (ayrı modül ayar klasörü); Program Files'a yazılmaz. |
| Lisans | Çekirdek GPL-2.0-or-later, kaynak depoda; panel ayrı süreç. |

## OBS iş akışı paritesi (2026-09-28)

- Anahtar gösterme yalnız yerel, önbelleksiz, denetimde değersiz; kopya panodan 30 sn sonra silinir; anahtar silme
  yayındayken reddedilir ([SECRET_STORAGE_ARCHITECTURE](SECRET_STORAGE_ARCHITECTURE.md)).
- `/ws/motor` (ekran kareleri, ses seviyeleri) yalnız loopback; uzak istemciye 403.
- Tarayıcı kaynağı adresinde kullanıcı adı/parola reddedilir; yerel dosya yalnız `.html/.htm` ve mutlak yol.
- OBS koleksiyonu içe aktarımı: yalnız dosya adı (klasör dışına çıkış yok), en çok 20 MB, yalnız yerel; OBS
  dosyalarına yazılmaz. Profil/koleksiyon dışa aktarımında sır yok (testli).
- Ayrı pencereler (projektör, dock) yalnız kendini kapatma ve konum okuma yetkisine sahip.
- Otomatik yapılandırma platform sunucusuna bağlanmaz; kodlama sınaması geçici dosyayı siler.
- Oyun yakalama örneği sınamada hiç oluşturulmadı (çalışan oyuna kanca atma riski); tür özellikleri örneksiz okundu.
- Motor kendi CEF alt süreçlerini kapatır; kullanıcının OBS süreçlerine dokunulmaz.

## Tarama turu (2026-10-20)

Kapsam: yerel sunucu (axum) uçları, Tauri yetenekleri/CSP, alt süreç çağrıları, ön yüz XSS
kapıları, npm bağımlılıkları. `cargo clippy --all-targets` uyarısız; TS `noUnusedLocals` açık.

| Bulgu | Önem | Durum |
|---|---|---|
| `/media/file` UNC yolu (`\sunucu\pay\x.png`, `\?\UNC\…`) kabul ediyordu. Uç GET olduğundan köken denetimine girmez: yayıncının açtığı herhangi bir site `<img>` ile Windows'u saldırgan sunucuya SMB bağlantısı açmaya ve **NTLM özetini göndermeye** zorlayabiliyordu. | Yüksek | Düzeltildi: yalnız yerel disk (`media::yerel_disk_yolu`), test + başsız sunucuda HTTP 400 doğrulandı |
| `curl.exe`, `powershell`, `reg`, `tasklist`, `taskkill`, `netstat`, `tar` çıplak adla çağrılıyordu; Windows önce uygulama klasörüne bakar (taşınabilir klasöre bırakılan sahte exe çalışırdı). | Orta | Düzeltildi: `sistem_araci::yol` (System32 tam yolu) |
| Harici AxBoT "zorla durdur": artık gözcülü; yalnız portu dinleyen süreç öldürülünce gözcü yeniden başlatıyordu. | İşlev | Düzeltildi: `/health` `gozcuPid` → ağaç gözcüden kapatılır (yalnız `node.exe` ise) |
| npm: `source-map-js` (yüksek), `braces`, `postcss-selector-parser` — yalnız derleme zamanı, pakete girmez. | Düşük | `source-map-js` düzeltildi; diğer ikisi `--force` (kırıcı tailwind zinciri) ister, bırakıldı |

İncelenip sorun bulunmayanlar: Host/köken koruması (`local_guard`), LAN Bearer, CORS beyaz listesi,
`open-external` izin listesi + http(s) zorunluluğu, yt-dlp'ye yalnız video kimliği, yükleme adları
(`dosya_adi`) ve uzantı zorlaması, ön yüzde `innerHTML`/`dangerouslySetInnerHTML`/`eval` yok,
Tauri uzak yetenek yalnız `127.0.0.1:8843`, projektör pencereleri IPC'siz.

Ek (aynı gün): ffmpeg/yt-dlp indirmeleri artık aynı sürümün SHA-256 listesiyle doğrulanıyor
(tutmazsa dosya silinir, kurulmaz; gerçek yt-dlp.exe ile özet eşleşmesi denendi). `cargo audit` (0.22.2):
rustls 0.23.46, rustls-webpki 0.103.16, webpki-roots 1.0.10'a güncellendi (RUSTSEC-2026-0346..0349, -0381, -0382).
Kalan uyarılar: webpki-roots 0.26.11 yalnız 1.0.10'a köprü (sürüm adına göre uyarı); rsa (RUSTSEC-2023-0071)
yalnız kilit dosyasında — sqlx-mysql derlenmiyor; unic-*/proc-macro-error/glib "bakımsız" uyarıları Tauri ağacından,
açık değil. Gömülü AxBoT'ta follow-redirects 1.16.1'e çıkarıldı; vosk-browser içindeki uuid'in düzeltmesi yok.
Ölü kod: Tauri öncesi bağımsız HTML aracı `legacy/` kaldırıldı (git geçmişinde duruyor).

### Kalanların kapatılması (2026-10-21)

- `cargo audit` artık açık bildirmiyor. İki uyarı gerekçesiyle `src-tauri/.cargo/audit.toml`'da: webpki-roots 0.26.11
  (tokio-tungstenite 0.29/0.30 ister, yalnız düzeltilmiş 1.0.10'a köprü) ve rsa (yalnız kilitte, sqlx-mysql derlenmez).
  Kalan 7 "bakımsız/unsound" bildirimi Tauri'nin bağımlılıkları (unic-*, proc-macro-error, Linux'a özgü glib) — düzeltilmiş sürüm yok.
- npm: `postcss-selector-parser` 7.1.7'ye zorlandı (`overrides`); üretilen CSS bayt bayt aynı. vite 6.4.4 (panel) ve
  Resonance vite güncellendi (GHSA-698v-4r3x-3vcv, yalnız geliştirme sunucusu). Yalnız `braces` kaldı: tüm sürümleri
  etkilenmiş, düzeltmesi Tailwind 4 göçü; yalnız derlemede kendi glob desenlerimizi işler, pakete girmez.

## T8 — Mobil kumanda eşleştirmesi (2026-11-13)

| Konu | Uygulanan denetim | Doğrulama |
|---|---|---|
| Eşleştirme kodu | Yalnız loopback'ten üretilir; 64 bit rastgele, **60 sn**, **tek kullanımlık** (geçersiz kullanım da kodu düşürür); bellekte en çok 10 bekleyen kod. Tamamlama ucu herkese açık ama giriş ile aynı adres başına deneme sınırına bağlı (10 dk'da 8 hata). | `eslestirme::tests`, `server_api::cihaz_eslestirme_tek_kullanim_ve_iptal` |
| Cihaz anahtarı | Her cihaz ayrı `remote_users` satırı (rol `cihaz`, yönetici olamaz, parolası rastgele: elle girişe kapalı) ve 90 günlük tek oturum; anahtar yalnız eşleşme yanıtında bir kez döner, listede yok. | aynı test (liste anahtar içermez) |
| İzinler | Yalnız `CIHAZ_IZINLERI`: sahne, ses, uyarı, müzik, tekrar, kayıt, yayın başlat/durdur, durum okuma. `*`, `settings.write`, `broadcast.outputs` (yayın anahtarı), `users`, `audit.read` verilemez. Cihaz yönetici olmadığı için `perm_checked_path` dışındaki uçlar (ayarlar, OBS şifresi) 403. | `cihaza_tehlikeli_izin_verilmez` |
| İptal | Cihaz silinince satır ve oturum birlikte silinir; sonraki istek 401. | test + sanal Studio'da panelden iptal |
| Yerel ağa açılma | Panelde onay sorusundan sonra `remote.bindLan`; yeniden başlatınca geçerli. Eşleşmemiş cihaz Bearer olmadan her korumalı uçtan 401 alır (mevcut ara katman). | elle; sanal ortamda LAN açılmadı (0.0.0.0 dinlenmedi) |
| Denetim | `REMOTE:pair_start`, `REMOTE:pair_done` (cihaz adı, izinler, adres), `REMOTE:device_revoke`; cihazın eylemleri mevcut eylem kayıt defterinden ve denetim günlüğünden geçer. | `audit` çağrıları |

Bilinen sınır: QR görüntüsü yok (yeni bağımlılık gerektiriyor); panel kodu ve bağlantıyı yazı olarak gösterir. Oturum anahtarları veritabanında düz saklanıyor (mevcut uzak oturumlarla aynı); karma ile saklamak ayrı iş.
