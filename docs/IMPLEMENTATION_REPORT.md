# Uygulama Raporu — "Streaming Operating System" turu (2026-09-25/26)

Amaç: uygulamayı bir arayüz kopyası değil, OBS'i yayın motoru olarak kullanan, çoklu yayını, yayın öncesi denetimi,
ekip çapında uyarı denetimini ve operatör çalışma alanını tek yerde toplayan bir **yayın işletim sistemine**
dönüştürmek. Marka, logo, telifli görsel ya da özel kod kopyalanmadı; referans ürünler yalnız davranış ve kategori
düzeyinde incelendi.

## 1. Güvenlik ağı (adım 1–4)

| Adım | Sonuç |
|---|---|
| Salt-okunur denetim | `CURRENT_SYSTEM_AUDIT.md` |
| Tam yedek | `C:\Users\Axthrowa\Yedekler\backup-pre-streaming-os-20260925-175532` — 3644 dosya, SHA-256 ile 3644/3644 doğrulandı, 21 SQLite anlık görüntüsü (backup API, `integrity_check = ok`), 2 git paketi (geri yükleme denendi). `BACKUP_MANIFEST.md` |
| Etiket + dal | iki depoda `pre-streaming-os-20260925-175532` ve `revamp/streaming-os-20260925` |
| Geri dönüş | `ROLLBACK.md` |

## 2. Araştırma (adım 5–10) ve karar (11–13)

Belgeler: `REFERENCE_PRODUCT_RESEARCH`, `OBS_COMPLETE_FEATURE_INVENTORY`, `BOTRIX_COMPLETE_AUDIT`, `SELIVE_COMPLETE_AUDIT`,
`GROUND_CONTROL_COMPLETE_AUDIT`, `GROUND_CONTROL_QUICK_ACTION_MATRIX`, `STREAMELEMENTS_PLATFORM_INVENTORY`,
`PLATFORM_CAPABILITY_MATRIX`, `REFERENCE_FEATURE_MATRIX` (bu turda güncellendi), `STREAMING_ENGINE_DECISION` (ADR-001),
`TARGET_ARCHITECTURE`, `VIDEO_PIPELINE`, `AUDIO_ENGINE`, `MULTICANVAS_ARCHITECTURE`, `MULTISTREAM_ARCHITECTURE`,
`CONTROL_CENTER_ARCHITECTURE`.

Her iddia `OBSERVED_IN_UI` / `OBSERVED_IN_PREVIEW` / `CONFIRMED_IN_OFFICIAL_DOCS` / `INFERRED` / `UNVERIFIED` /
`BLOCKED` ile sınıflandırıldı. **Tarayıcı eklentisi bağlı olmadığı için** giriş gerektiren BotRix/StreamElements
ekranları `BLOCKED`, `support.streamelements.com` (403) özetlerden `CONFIRMED_IN_OFFICIAL_DOCS (özet)`.

**ADR-001:** OBS Studio (32.2.2, kurulu) ayrı süreç yayın motoru, obs-websocket 5 ile denetim; çoklu yayın için
kendi **Output Router**'ımız: OBS → yerel FFmpeg alıcı → Rust FLV çoğaltıcı → hedef başına FFmpeg yayıncı (`-c copy`).
Gerekçe ve reddedilen seçenekler `STREAMING_ENGINE_DECISION.md`'de.

## 3. Uygulananlar

"DONE" yalnız arayüz + arka uç + durum + kalıcılık + doğrulama + hata yönetimi + izin + günlük + test + belge
tamamsa yazıldı.

| Öncelik | Özellik | Commit | Durum |
|---|---|---|---|
| P0 | **Sırların kalıcılığı** (keyring mock deposu düzeltmesi) | a76f2b5 | **DONE** (gerileme testli) |
| P0/P1 | **Çoklu yayın yönlendiricisi**: tek kodlama → çok hedef; hedef başına bağımsız durum makinesi (Hazır → Bağlanıyor → Canlı → Uyarı → Yeniden bağlanıyor → Başarısız/Durduruldu), geç katılma (önbellekli dizi başlığı + anahtar kare), hedef başına zaman çizelgesi, üstel geri çekilme (≤ 60 sn, 10 deneme), yavaş hedef anahtar kareye kadar atlanır, zarif durdurma | 5ce161d | **DONE** |
| P1 | **Çoklu yayın API + Control Plane**: hedef ekle/düzenle/sil/başlat/durdur, oturum, GO LIVE, onaylı kapatma, OBS'i yönlendiriciye bağla / geri yükle (yedek Kimlik Yöneticisi'nde), izin kapsamlı uzak erişim, denetim günlüğü | f3b0a16 | **DONE** |
| P1 | **Yayın öncesi kontrol**: gerçek OBS profilinden kodlayıcı/bit hızı/anahtar kare/çözünürlük + yapılandırılabilir platform kuralları (Kick, YouTube, Twitch eşzamanlı yayın) → uyarı/engel | f3b0a16 | **PARTIAL** (cihaz/ağ denetimi yok) |
| P1 | **Kontrol Merkezi**: yayın oturumu, hedef kartları (canlı kbps/fps/hız, hata, yeniden deneme), yayın öncesi kontrol, uyarı kuyruğu, denetim günlüğü, notlar; gizle/sırala/genişlik/hazır düzenler (Yayıncı, Moderatör, Teknik, Sade) | af32308 | **DONE** (ızgara); yerleşim motoru bölme ağacı **PARTIAL** |
| P1 | **Sahne & Ses** paneli: tek dokunuş sahne geçişi, giriş susturma | 6806ac5 | **PARTIAL** (seviye ölçer yok, eylemler denetim günlüğüne yazılmıyor, canlı OBS ile arayüz denemesi yapılmadı) |
| P1 | **Ekip çapında uyarı kuyruğu denetimi** (StreamAxT): duraklat/sürdür/atla/sustur/temizle/yeniden oynat, iyimser sürüm kilidi (409), denetim günlüğü; + her türün yalnız ilk uyarısının oynaması hatası | StreamAxT b53051d | **DONE** |
| Güvenlik | LAN WS istemcilerine OBS şifresi gitmiyor | 0077750 | **DONE** (birim testli; canlı LAN denenmedi) |
| Güvenlik | Kick OAuth `state` doğrulaması, sorgu `redirectUri`'si kaldırıldı, PKCE doğrulayıcısı sunucuda | StreamAxT a9736f0 | **DONE** |
| Hata | StreamAxT portu tek kaynaktan (kenar çubuğu, Platformlar WS, Kick adresi; panelde Kontrol Merkezi, Dashboard bot kartı, yayın öncesi kontrol) | a9736f0, 6806ac5 | **DONE** |
| Hata | **Kalkan modu** ayarları gerçekten uygulanıyor (link, büyük harf, emoji seli, yalnız abone; OBS sohbetinden gizleme; isteğe bağlı platformda silme); uygulanamayanlar "desteklenmiyor" | StreamAxT f54d6f9 | **DONE** |
| Hata | Kaydedilmemiş değişiklik uyarısı bağlandı (4 sayfa + sekme/geri tuşu onayı); başarısız kayıtlar "Kaydedildi" demiyor | StreamAxT a7083dc | **DONE** (4 sayfa kapsamı) |
| Hata | Aktivite Akışı açıklaması denetimlerin gerçek yerini gösteriyor | StreamAxT 3865500 | **DONE** |
| Belgeler | Denetim, yedek, araştırma, mimari, güvenlik, performans, test, sınırlamalar, geri dönüş | c7c61fd, 06e71b9, bu commit | **DONE** |

## 4. Bilerek yapılmayanlar / sonraki fazlar

| Faz | İş | Neden şimdi değil |
|---|---|---|
| P2 | Dikey tuval / Twitch Dual Format | OBS ek tuval çıkışı eklenti/Enhanced Broadcasting gerektiriyor; mimari hazır (`MULTICANVAS_ARCHITECTURE.md`) |
| P2 | Hedef başına ses izi, hedef başına yeniden kodlama | tek kodlama ilkesini bozar; ek kodlayıcı maliyeti |
| P2 | Stüdyo modu, tekrar arabelleği olay tetikleyicileri, otomasyon düğüm editörü | P1 tamamlandıktan sonra |
| P2 | Kontrol Merkezi bölme ağacı / ayrı pencere (ses seviye ölçerleri 2. turda yapıldı) | ızgara şu an ihtiyacı karşılıyor |
| P3 | Bulut aktarımı, SRT, yerel Elgato Stream Deck eklentisi (HTTP yolu 2. turda hazır), AI yardımcısı genişletmesi, eklenti SDK'sı | yüksek maliyet; önce yerel çekirdek |
| — | Yerel Rust RTMP yayıncısı | hedef başına ~%22 çekirdek FFmpeg RTMP maliyetini düşürür (`PERFORMANCE_REPORT.md`) |

## 5. Doğrulama özeti

- Testler: `TEST_REPORT.md` — panel 323 TS + 228 Rust + 21 API + 2 uçtan uca; Resonance 71; StreamAxT 451 + 81.
  Hiçbiri devre dışı bırakılmadı.
- Performans: `PERFORMANCE_REPORT.md` — yönlendirici ~%1–3 tek çekirdek / ~19 MB; hedef başına ~%22–30 / ~23 MB;
  5 hedefte 0 düşen kare, hız 1,02×.
- Güvenlik: `SECURITY_REVIEW.md` — 1 kritik, 1 yüksek, 2 orta, 2 düşük bulgu düzeltildi; npm 0 açık; Cargo
  danışmanları Windows derlemesinde istismar edilemez.
- Sınırlamalar: `KNOWN_LIMITATIONS.md` — gerçek platforma yayın **UNVERIFIED** (bilerek denenmedi).

## 6. Kullanıcının yapması gerekenler

1. **OBS WebSocket şifresini ve Kick girişini bir kez yeniden girin** (önceki sürüm sırları hiç kaydetmiyordu).
2. İlk gerçek çoklu yayında önce bir hedefle deneyin; Kontrol Merkezi → Yayın öncesi kontrol'deki uyarıları okuyun.
3. Twitch'e eşzamanlı yayın yapacaksanız StreamAxT'te çapraz sohbet aktarımının açık olduğunu bilin (kontrol listesi
   uyarır; kapatmak sizin kararınız).
4. Commit'ler uzak depoya gönderilmedi.

## 7. İkinci tur — "Creator Streaming OS" (2026-09-26)

Sıra: salt-okunur denetim → doğrulanmış tam yedek (`C:\Users\Axthrowa\Yedekler\backup-pre-streaming-os-revision-20260926-010500`,
SHA-256 manifestolu) → git etiketi `pre-streaming-os-revision-20260926-010500` + dal `revamp/streaming-os-20260926`
(iki depoda) → lisans incelemesi → araştırma (StreamElements çekirdek kaynak denetimi, resmi SE.Live / Ground Control
makaleleri, BotRix belgeleri) → uygulama.

| Öncelik | Özellik | Commit | Durum |
|---|---|---|---|
| Lisans | `tiktok-live-connector` AGPL sürümünden MIT 2.4.0'a sabitleme; dağıtım klasörleri de indirildi; lisans bekçisi testleri (iki depo) + cargo denetimi | StreamAxT 71d0c37, f8a247d; panel 7512b0f | **DONE** |
| P1 | **Eylem kayıt defteri** (18 eylem: sahne, ses, kayıt, tekrar, yayın, hedefler, uyarı kuyruğu) — izin, onay, kullanılabilirlik, denetim; Hızlı eylemler paneli | e58c677 | **DONE** |
| P1 | **Evrensel sohbet + etkinlik akışı** (Kontrol Merkezi): platformlar arası kimlik `platform:userId`, tekilleştirme, görünümler, arama, moderasyon; mesaj silme ve Twitch sohbet modları (StreamAxT uçları); yazı boyutu | 03d1fce, 8d5e65b, 891d6d8; StreamAxT 64023eb | **DONE** (canlı platformda UNVERIFIED) |
| P1 | **Bant genişliği** yayın öncesi kontrolde (hedef başına video + ses, ek yük, pay; ölçülmüş yükleme hızıyla karşılaştırma) | c7eb37b | **DONE** |
| P1 | **OBS tuval keşfi** (obws 0.15 / obs-websocket 5.7), SE.Live tuvalinin tanınması | 6bee4f1 | **DONE** (salt-okunur; ikincil tuval denetimi obs-websocket'te yok) |
| P1 | **Kontrol destesi** (sayfalı, renkli, çift dokunuşlu onay, sunucuda kalıcı) + donanım Stream Deck HTTP yolu | f1ca2ee | **DONE** (yazılım deste); donanım **UNVERIFIED** |
| P2 | **Ses seviye ölçerleri** (talebe bağlı OBS aboneliği) | 4b8b20d | **DONE** (arka uç gerçek OBS'e karşı doğrulandı; arayüz canlı görünümü UNVERIFIED) |
| P2 | StreamAxT `$(jsonset)` / `$(jsonunset)` değişkenleri (BotRix belgesindeki davranış; kod kopyalanmadı) | StreamAxT 3837b88 | **DONE** |
| Belgeler | StreamElements çekirdek denetimi, host API matrisi (208 yöntem), ses mimarisi, kodlayıcı yaşam döngüsü, ADR-002, lisans incelemesi, çoklu sohbet mimarisi, deste belgesi, resmi kaynak güncellemeleri | b0f51f1, be1d35e, c35efaf, f1ca2ee | **DONE** |
| P2 | Kendi GPL-2.0 OBS eklentisi (tuval oluşturma, hedef başına kodlayıcı ve ses izi) | — | **PLANNED** (ayrı depo ve OBS SDK zinciri gerekir) |
| P3 | Yerel Elgato Stream Deck eklentisi | — | **PLANNED** (Stream Deck yazılımı yok, doğrulanamaz) |

Testler (2. tur sonu): panel 342 TS + 236 Rust + 22 API (+1 yok sayılan) + 2 uçtan uca; Resonance 71; StreamAxT
462 + 81; tsc ve clippy temiz. Ayrıntı `TEST_REPORT.md`, sınırlamalar `KNOWN_LIMITATIONS.md` "İkinci tur",
güvenlik `SECURITY_REVIEW.md` "İkinci tur".

Kullanıcı için: yeni bir şey yeniden girmek gerekmez. Kontrol Merkezi'nde "Kontrol destesi" paneli hazır profil
kullananlarda kendiliğinden görünür; özel düzen kullananlar panel listesinden açabilir. Twitch sohbet modları için
StreamAxT'teki Twitch bağlantısının `moderator:manage:chat_settings` kapsamını içermesi gerekir (yoksa uç açık hata
döner).

## 8. Kendi yayın çekirdeği — "kendi OBS'imiz" (2026-09-26)

Kullanıcı isteği: "promptaki tüm işleri yaptığından emin ol, sonra kendi OBS'imizi de yapalım, çoklu yayın özellikli".
Önce 123 bölümün kanıtlı izlenebilirlik tablosu çıkarıldı (`PROMPT_TRACEABILITY.md`, 46afc06); eksiklerin başında
promptun yerel yayın çekirdeği (Faz 12–19) vardı. Kullanıcı motor yolunu seçti (libobs tabanlı, ayrı süreç) ve sınamayı
yalnız sentetik kaynaklarla sınırladı.

| Commit | İş | Durum |
|---|---|---|
| 1a2417a | `motor/` — libobs 32.2.2'yi çalışma anında yükleyen GPL çekirdek: seçili modüller, kendi RTMP servisi, çoklu tuval, paylaşılan kaynak, tuval başına NVENC, kodlayıcı paylaşan hedefler + kayıt, sinyallerden durum makinesi, önizleme çıktısı, stdio protokolü, sentetik uçtan uca sınama. Sınamada bulunan iki gerçek hata düzeltildi (kapanışta "double destroy"; kayıt alt sürecinin RTMP soketlerini devralıp durdurulan bağlantıyı açık tutması). | IMPLEMENTED (sentetik doğrulandı) |
| 6ffe902 | Panel köprüsü (`motor_kopru.rs`) ve `/api/motor…` uçları: izin + denetim, girdi doğrulama, iki yönlü "aynı hedefe iki yayıncı" koruması | IMPLEMENTED |
| 406bf38 | Kontrol Merkezi "Yayın motoru" paneli + paketleme (portable pakete motor + GPL lisans metni, imza) | IMPLEMENTED (portable); kurulum dosyasına eklenmedi |

Doğrulama: çekirdek 12 birim + protokol uçtan uca + `sinama` 14/14; panel API testi gerçek çekirdekle; tarayıcıda
arayüzden başlat → önizleme → dikey tuvalle hedef → alıcıda 1080×1920 → durdur. Performans: `PERFORMANCE_REPORT`
"Yerel yayın çekirdeği". Sınırlar: `KNOWN_LIMITATIONS` "Yerel yayın çekirdeği" (yakalama kaynakları `UNVERIFIED`,
kamera/pencere/sahne düzenleyici/kayıt düğmesi eksik).
