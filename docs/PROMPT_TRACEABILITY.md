# Ana Prompt İzlenebilirlik Tablosu — "Creator Streaming OS"

Kaynak: 2026-09-25'te verilen "MASTER IMPLEMENTATION PROMPT" (123 bölüm). Bu tablo
her bölümü bugünkü durumla ve kanıtla eşler. Durum sözcükleri promptun §112 listesinden:
`IMPLEMENTED` · `EXISTING` · `PARTIAL` · `MISSING` · `IN_PROGRESS` · `BLOCKED` · `NOT_APPLICABLE` · `UNVERIFIED`.
"DONE" yalnız §111'deki tüm katmanlar tamamsa kullanılır; bu tabloda kullanılmadı, katman eksikse `PARTIAL` yazıldı.

Son güncelleme: 2026-09-26. **Kullanıcı kararı (2026-09-26):** yerel yayın çekirdeği (§25–§58) **libobs tabanlı ayrı
bir süreç** olarak yapılacak; sınamalar yalnız sentetik kaynaklarla (ekran/pencere/oyun yakalanmaz). Ayrıntı:
`STREAMING_ENGINE_DECISION.md` ADR-003.

## Özet

- **Kapılar ve araştırma (§3–§14, §113–§118):** tamam. Referans ürün arayüzlerinin bir kısmı `NOT_ACCESSIBLE`
  (BotRix paneli oturumsuz, SE.Live ve Ground Control masaüstü arayüzleri gözlenmedi).
- **Denetim düzlemi (§15–§24, §41–§47, §59–§69):** çekirdeği var; birçok alt madde `PARTIAL`.
- **Yerel yayın çekirdeği (§25–§40, §46, §52–§58):** bugüne kadar OBS motor olarak kullanıldı (ADR-001); **kendi
  çekirdeğimiz yoktu** → `IN_PROGRESS` (ADR-003).
- **Bulut, otomasyon stüdyosu, anket/tahmin, klip motoru, uzun süreli testler:** `MISSING`; neden ve sıra aşağıda.

## Tablo

| § | Konu | Durum | Kanıt / not |
|---|---|---|---|
| 1–2 | Amaç, son ürün | PARTIAL | Denetim düzlemi var; yayın çekirdeği OBS'e dayalı → ADR-003 ile kendi çekirdek |
| 3 | Güvenlik kuralları (yedek, veri, sır, sahte işlev, körlemesine yeniden yazım) | IMPLEMENTED | Yedek `Yedekler\backup-pre-streaming-os-revision-20260926-010500` (SHA-256), raporlar sır içermez, `KNOWN_LIMITATIONS` |
| 4 | Yürütme kipi | IMPLEMENTED | denetim → yedek → araştırma → uygulama → test → belge (commit geçmişi) |
| 5 | Faz 0 salt-okunur denetim | IMPLEMENTED | `CURRENT_SYSTEM_AUDIT.md` (§6 ikinci tur) |
| 6 | Faz 1 doğrulanmış yedek | IMPLEMENTED | `Projeler\BACKUP_MANIFEST.md` (bölüm A), `manifest.json` + `dogrulama.json`, 37 DB anlık görüntüsü, git paketleri |
| 7 | Faz 2 git güvenliği | IMPLEMENTED | etiket `pre-streaming-os-revision-20260926-010500`, dal `revamp/streaming-os-20260926` (iki depo) |
| 8 | Faz 3 referans araştırması | PARTIAL | OBS, SE Core (kaynak), SE.Live ve Ground Control (resmî makaleler), BotRix (belgeler), Restream (`REFERENCE_PRODUCT_RESEARCH`); arayüz gözlemi kısmen `NOT_ACCESSIBLE` |
| 9 | Kanıt sınıflandırması | IMPLEMENTED | tüm envanterlerde sınıf sütunu |
| 10 | SE Core tam kaynak denetimi | IMPLEMENTED | `STREAMELEMENTS_CORE_AUDIT`, `_HOST_API_MATRIX` (208 yöntem), `_AUDIO_ARCHITECTURE`, `ENCODER_LIFECYCLE_DESIGN` |
| 11 | Lisans kapısı | IMPLEMENTED | `LICENSE_AND_DEPENDENCY_REVIEW`; AGPL bağımlılık düzeltildi; lisans bekçisi testleri |
| 12 | OBS tam özellik envanteri | IMPLEMENTED | `OBS_COMPLETE_FEATURE_INVENTORY` |
| 13 | SE.Live çalışma anı denetimi | PARTIAL | resmî makaleler + kaynak; çalışma anında yalnız tuval keşfi (`OBSERVED_IN_RUNTIME`); arayüz `NOT_ACCESSIBLE` |
| 14 | Ground Control adli denetim | PARTIAL | resmî makale + ürün sayfası; uygulama arayüzü `NOT_ACCESSIBLE`; hızlı eylem matrisi var |
| 15 | Kontrol Merkezi | PARTIAL | Var: sohbet, etkinlik, hedefler, sağlık (kısmi), uyarı kuyruğu, hızlı eylemler, deste, sahne&ses (susturma + ölçer), yayın öncesi kontrol, denetim, notlar. Yok: yayın önizlemesi, anket/tahmin, üst veri paneli, otomasyon paneli; yerleşim ızgara (yuvalama/bölme/ayrı pencere yok) |
| 16 | Evrensel sohbet motoru | IMPLEMENTED | StreamAxT bağdaştırıcıları → `src/lib/chat/normalize.ts` → depo; `MULTICHAT_ARCHITECTURE` |
| 17 | Normalleştirilmiş sohbet modeli | PARTIAL | model var; `messageParts`, `replyTo`, emote parçaları bağdaştırıcılardan gelmiyor |
| 18 | Sohbet kimliği (platform + kullanıcı kimliği) | IMPLEMENTED | `platform:userId`, ada düşme işaretli; birim testli |
| 19 | Görünüm kipleri | PARTIAL | Birleşik, bahsetme, soru, ilk kez, üye, ücretli, moderasyon, platform seçimi, arama; platform sütunları ve gerçek sanallaştırma yok |
| 20 | Sohbet moderasyonu | PARTIAL | sil, zaman aşımı, ban, Twitch yavaş/takipçi/abone/emote modu; unban, yanıt, VIP, sohbeti temizle yok; canlı `UNVERIFIED` |
| 21 | Platform başına hız sınırı | PARTIAL | StreamAxT bağdaştırıcılarında platform başına gönderim ve yeniden deneme; kuyruk taşması/yinelenen bastırma belgesi eksik |
| 22 | Çok platformlu etkinlik akışı | IMPLEMENTED | normalize + idempotent; tarayıcıda doğrulandı |
| 23 | Platform bağdaştırıcı mimarisi | PARTIAL | StreamAxT `platforms/*` + `capabilities.ts`; anket/tahmin/hedef oluşturma arayüzde yok |
| 24 | Platform yetenek matrisi | IMPLEMENTED | `PLATFORM_CAPABILITY_MATRIX`, `capabilities.ts`, arayüz yetenek güdümlü |
| 25 | Yerel yayın çekirdeği kararı | IMPLEMENTED | ADR-003: libobs tabanlı ayrı süreç (`motor/`, GPL-2.0-or-later); ADR-001 yolları yanında kalır |
| 26 | Süreç mimarisi | IMPLEMENTED | arayüz / Rust denetim düzlemi / StreamAxT / yayın çekirdeği ayrı süreçler; çekirdekle stdio JSON (tipli komutlar); çekirdek çökerse panel sürer |
| 27 | Yakalama motoru | PARTIAL | çekirdekte ortak kaynak soyutlaması (libobs): renk, yazı, görsel, medya **doğrulandı**; ekran, oyun, mikrofon, masaüstü sesi kod yolu var, `UNVERIFIED` (yalnız sentetik kuralı); kamera/pencere MISSING |
| 28 | Sahne motoru | PARTIAL | çekirdekte sahne, öğe, konum/ölçek/sınır/açı/görünürlük; düzenleyici arayüzü (grup, kilit, sürükle, geri al) yok |
| 29 | GPU birleştirici | IMPLEMENTED (libobs) | D3D11 birleştirme, NV12 GPU dönüşümü, NVENC doku kodlayıcı (GPU→CPU kopyası yalnız önizlemede) |
| 30 | Çoklu tuval | IMPLEMENTED (çekirdek) | 1920×1080 + 1080×1920 aynı anda, tuval başına sahne/kodlayıcı/önizleme; sınamada doğrulandı. Renk uzayı/HDR seçimi arayüzde yok |
| 31 | Kaynağın tuvaller arasında paylaşımı | IMPLEMENTED | aynı medya kaynağı iki tuvalde farklı konum/boyutla (tek çözme) — sınama karelerinde görüldü |
| 32 | Bağlı sahneler | MISSING | ADR-003 sonraki adım |
| 33 | Ses motoru | PARTIAL | susturma + tepe/ortalama ölçer; ses seviyesi/pan/izleme/senkron kaydırma yok |
| 34 | Ses filtreleri | PARTIAL | OBS filtresi aç/kapa (kısayol); ayar arayüzü yok |
| 35 | Ses izleri / karışımlar | MISSING | kendi çekirdekte 6 iz |
| 36 | Hedef başına ses | MISSING | kendi çekirdekte çıkış başına ses kodlayıcısı / iz |
| 37 | Renk hattı | PARTIAL | yalnız tasarım (`VIDEO_PIPELINE.md`) |
| 38 | Kare zamanlama / A-V senkronu | PARTIAL | FLV çoğaltıcıda zaman tabanı ve geç katılma testli; yakalama/işleme gecikmesi ayrımı yok |
| 39 | Kodlayıcı yöneticisi (donanım algılama) | IMPLEMENTED | çekirdek yalnız kayıtlı (var olan) kodlayıcıları listeler: bu makinede NVENC H.264/HEVC/AV1 + x264 + SVT/AOM AV1; AMF/QSV yok → gösterilmez; `otomatik`: NVENC → x264 |
| 40 | Kodlayıcı ayarları (basit/gelişmiş/uzman) | MISSING | bugün OBS profili salt okunur |
| 41 | Çoklu yayın durum makinesi | IMPLEMENTED | `multistream/state.rs` (Hazır → Bağlanıyor → Canlı → Uyarı → Yeniden bağlanıyor → Başarısız/Durduruldu), testli |
| 42 | Hedef modeli | PARTIAL | tuval, video/ses profili, ses izi alanları yok |
| 43 | Bağımsız hedef denetimi + hepsini durdur | IMPLEMENTED | e2e testli |
| 44 | Kodlama paylaşımı | IMPLEMENTED | yönlendiricide tek kodlama → paket çoğaltma; çekirdekte bir kodlayıcı birden çok hedef + kayıt |
| 45 | Kodlama uyumluluğu | MISSING | tek profil; yayın öncesi kontrol çakışmayı uyarır |
| 46 | Çoklu kodlama | PARTIAL | çekirdekte tuval başına ayrı kodlayıcı (farklı bit hızı); hedef başına ayrı profil arayüzü ve oturum/VRAM izleme yok |
| 47 | Bant genişliği hesaplayıcı | IMPLEMENTED | `policy.rs` (video + ses + ek yük + pay; kullanıcının ölçtüğü yükleme hızıyla) |
| 48–49 | Bulut aktarımı | MISSING | P3; §108 gereği P0/P1 kararlı olmadan başlanmadı |
| 50 | Yük devri | PARTIAL | hedef hatası diğerlerini durdurmaz, üstel geri çekilme; alıcı/bulut yük devri yok |
| 51 | Uyarlanır ağ | MISSING | — |
| 52 | Kayıt | PARTIAL | çekirdekte MKV/MP4 kayıt, yayın kodlayıcısını paylaşır, çoklu ses izi (sınamada doğrulandı); panelde kayıt düğmesi yok |
| 53 | Tekrar / Backtrack | PARTIAL | `replay.save`; tuval başına tekrar kendi çekirdekte |
| 54 | Klip motoru | MISSING | — |
| 55 | Stüdyo modu | MISSING | — |
| 56 | Geçişler | MISSING | kendi çekirdekte libobs geçişleri |
| 57 | Çoklu görünüm / projektör | MISSING | — |
| 58 | Sanal kamera | MISSING | — |
| 59 | Hızlı eylem sistemi | PARTIAL | 18 eylem; `source.show/hide`, `audio.volume`, `destination.reconnect`, `alert.replay`, `chat.send`, `moderation.timeout`, `automation.run` yok |
| 60 | Tek kayıt defteri, çok denetleyici | PARTIAL | Kontrol Merkezi, deste, HTTP/Stream Deck; küresel kısayollar ve uzak arayüz henüz kayıt defterinden geçmiyor |
| 61 | Rol tabanlı erişim | PARTIAL | uzak kullanıcıda rol + izin listesi; hazır rol şablonları yok |
| 62 | Paylaşılan ekip durumu | IMPLEMENTED | uyarı denetimi: sürüm kilidi (409), WS yayını, denetim |
| 63 | Uyarı kuyruğu denetimi | PARTIAL | duraklat/sürdür/sustur/aç/atla/temizle/yeniden oynat; öncelik, inceleme, tek uyarı kaldırma yok |
| 64–65 | Yayın üst verisi / toplu üst veri | PARTIAL | StreamAxT başlık/kategori (çok platformlu); Kontrol Merkezi paneli ve platforma özel geçersiz kılma yok |
| 66 | Anket / tahmin | MISSING | Twitch API yeteneği var, uygulanmadı |
| 67 | Stream Deck | PARTIAL | HTTP yolu doğrulandı; yerel eklenti yok; cihazla `UNVERIFIED` |
| 68 | Yerleşik dokunmatik deste | PARTIAL | sayfa, düğme, renk, canlı kullanılabilirlik, çift dokunuş; klasör, aç/kapa, basılı tutma, çoklu eylem yok |
| 69 | Uzaktan denetim | PARTIAL | `/remote` + Bearer + izinler; QR eşleme, cihaz kaydı/iptali yok |
| 70 | BotRix denetimi | IMPLEMENTED | `BOTRIX_COMPLETE_AUDIT` (2026-09-21 arayüz gözlemi; bu tur panel `NOT_ACCESSIBLE`) |
| 71–74 | Sohbet botu, zamanlayıcı, moderasyon botu, TTS | EXISTING | StreamAxT BotRix eşdeğerlik turları (`BOTRIX_GAP_ANALYSIS`) |
| 75 | Uyarı motoru durum makinesi | PARTIAL | kuyruk + denetim; açık QUEUED→COMPLETED durum makinesi yok |
| 76–78 | Widget motoru, overlay tasarımcısı, animasyon | PARTIAL | panel OverlayStudio + StreamAxT widget'ları; ortak yapılandırma modeli ve geri al/yinele eksik |
| 79 | Medya kitaplığı | PARTIAL | panel medya kitaplığı; kullanım takibi ve silme uyarısı yok |
| 80–81 | Sadakat, hedefler/etiketler | EXISTING | StreamAxT |
| 82–83 | Otomasyon stüdyosu ve tetikleyiciler | PARTIAL | bitiş kuralları, zamanlayıcılar, OBS dizisi; düğüm editörü yok |
| 84 | Olay veriyolu | EXISTING | StreamAxT `core/event-bus.ts` |
| 85 | Olay güvenilirliği | PARTIAL | benzersiz kimlik + arayüzde tekilleştirme; yeniden bağlanmada yeniden oynatma yok |
| 86 | Performans izleyici | PARTIAL | OBS istatistikleri, hedef başına kbps/fps/hız; GPU/VRAM/kodlayıcı oturum sayısı yok |
| 87 | Yayın öncesi kontrol | PARTIAL | kodlayıcı, platform kuralları, bant genişliği, OBS bağlantısı; mikrofon/kamera/disk/kırpılma/boş çıktı yok |
| 88 | GO LIVE durum makinesi | PARTIAL | çoklu yayın oturumu; kısmi başarı var; açık hazırlık aşamaları yok |
| 89 | Güvenli durdurma | PARTIAL | hedef başına zarif durdurma; kaydın bitirilmesi OBS'te |
| 90 | Çökme kurtarma | PARTIAL | atomik ayar yazımı, yedekler; güvenli kip ve son sağlam yapılandırma yok |
| 91 | Cihaz takıp-çıkarma | NOT_APPLICABLE (bugün) | OBS yönetiyor; kendi çekirdekte yeniden değerlendirilecek |
| 92 | Tanılama merkezi | PARTIAL | sağlık kartları + yayın öncesi kontrol |
| 93 | Destek paketi | MISSING | — |
| 94 | Güvenlik | IMPLEMENTED (yeni yüzeyler) | `SECURITY_REVIEW` (iki tur) |
| 95 | Tarayıcı kaynağı güvenliği | EXISTING | widget adreslerinde hesap jetonu yok |
| 96 | Yapılandırma sürümleme | PARTIAL | Kontrol Merkezi düzeni ve deste sürümlü; tüm ayar dosyaları değil |
| 97 | Veritabanı evrimi | EXISTING | yalnız ekleyici göçler |
| 98 | Arayüz çalışma alanları | PARTIAL | Dashboard, Kontrol Merkezi, Bot, overlay ekranları; "Yayın" (sahne düzenleyici) alanı yok |
| 99 | Tasarım sistemi | PARTIAL | `yya-*` sınıfları, az ortak bileşen |
| 100 | Erişilebilirlik | PARTIAL | okunabilirlik sözleşme testi, ARIA etiketleri kısmi |
| 101 | Yerelleştirme | PARTIAL | `i18n/messages.ts` gezinme için; bileşenlerde sabit metin çok |
| 102 | OBS içe aktarma | MISSING | kendi çekirdek için sahne koleksiyonu içe aktarma sonraki adım |
| 103 | Test stratejisi | IMPLEMENTED | birim, API bütünleşme, gerçek FFmpeg uçtan uca, tarayıcı doğrulamaları |
| 104 | Kaos testleri | PARTIAL | hedef kopması e2e, yinelenen olay birim testi; ağ bozulması/disk dolu yok |
| 105 | Uzun süreli (soak) testler | MISSING | 4–24 saatlik koşu yapılmadı |
| 106 | Performans matrisi | PARTIAL | 1/3/5 hedef ölçüldü (`PERFORMANCE_REPORT`); tuval/kayıt/tekrar birleşimleri yok |
| 107 | Gerileme | IMPLEMENTED | tüm paketler her turda; mevcut özellikler bozulmadı |
| 108–112 | Öncelik, fazlar, MVP kapısı, DONE tanımı, durum sözcükleri | IMPLEMENTED (süreç) | MVP kapısı (§110) kendi çekirdekle yeniden işletilecek |
| 113 | Zorunlu belgeler | IMPLEMENTED | 29 belgenin hepsi var (boş belge yok) |
| 114 | Referans özellik matrisi | IMPLEMENTED | `REFERENCE_FEATURE_MATRIX` (bu güncellemede eskimiş satırlar düzeltildi) |
| 115 | Commit politikası | IMPLEMENTED | mantıksal commit'ler |
| 116 | Yapı kapısı | PARTIAL | lint (clippy), tip denetimi, derleme, birim/bütünleşme testleri, paket, duman testi var; **biçimlendirici yok**: depo hiçbir rustfmt ayarıyla tutarlı değil (500+ fark), topluca biçimlendirmek ilgisiz dev bir fark yaratır |
| 117 | "Kayıpsız" iddiası yok | IMPLEMENTED | belgeler kayıplı kodek gerçeğini söylüyor |
| 118 | Platform politikası | IMPLEMENTED | `policy.rs` yapılandırılabilir, resmî belgelerle doğrulanmış |
| 119 | Son mimari hedefi | PARTIAL | denetim düzlemi hedefe uygun; yerel çekirdek ADR-003 |
| 120 | Son doğrulama senaryoları | PARTIAL | çoklu yayın (yerel alıcılarla) ve operatör akışı doğrulandı; tek platform ve çoklu tuval senaryoları gerçek yakalama gerektiriyor (kullanıcı kuralı: yalnız sentetik) |
| 121 | Son uygulama raporu | IMPLEMENTED | `IMPLEMENTATION_REPORT` §1–§7 |
| 122–123 | Yürütme kuralı, öncelik sırası | IMPLEMENTED | uygulama sürdü; P3'e (bulut, AI) geçilmedi |

## Yerel çekirdek sonrası (2026-09-26)

Çekirdek (`motor/`) ve panel bütünleşmesi tamam: 1a2417a, 6ffe902, 406bf38. Ayrıntı: ADR-003, TEST_REPORT, KNOWN_LIMITATIONS
"Yerel yayın çekirdeği" bölümleri.

## Sonraki kilometre taşı

1. ~~ADR-003 yerel çekirdek MVP~~ → **yapıldı** (sentetik kaynaklarla doğrulandı).
2. Çekirdek üstünde: sahne düzenleyici (§28), kamera/pencere seçimi, hedef başına ses izi (§36), kayıt ve tekrar
   arabelleği arayüzü (§52–§53), GO LIVE'ın çekirdek hedeflerini de başlatması, stüdyo modu ve geçişler (§55–§56).
3. Denetim düzlemi boşlukları: eylem kayıt defterine kalan eylemler (§59), küresel kısayolların kayıt defterine
   bağlanması (§60), yayın öncesi kontrole disk/mikrofon (§87), destek paketi (§93).

## OBS iş akışı paritesi istemi (2026-09-28)

İstemin 80 maddesinin izlenebilirliği: [OBS_FUNCTIONAL_PARITY_SPEC](OBS_FUNCTIONAL_PARITY_SPEC.md) (madde → durum →
kanıt), ayar/kaynak/ses/kısayol/eklenti matrisleri, [UX_ACCEPTANCE_TESTS](UX_ACCEPTANCE_TESTS.md) (§73–78). Yukarıdaki
"Sonraki kilometre taşı" maddeleri 2 ve 3 bu turda tamamlandı (sahne düzenleyici, hedef başına ses izi, kayıt/tekrar
arayüzü, GO LIVE motor bütünleşmesi, Studio Mode ve geçişler, kayıt defteri kısayolları, disk/mikrofon ön kontrolü,
destek paketi).

## Plan istemi (Özgün Yayın Motoru, YOL G) — §4 OBS arayüz paritesi (2026-09-29)

Kullanıcı kararı YOL G (ADR-005): özgün motor fazları (F1–F3 `cekirdek/`) yapılmaz; §4 arayüz paritesi libobs motoru
üzerinde uygulanır. Madde → durum → test: [OBS_UI_PARITY_CHECKLIST](OBS_UI_PARITY_CHECKLIST.md). Bu turda eklenenler:
ekran görüntüsü (çıkış/önizleme/sahne/kaynak), deinterlace, karıştırma yöntemi, düşen kare %, T-bar, yeniden muxla,
Multiview, kaynak araç çubuğu. Kalan YOK maddeleri kontrol listesinde ve
[KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md) sonunda.
