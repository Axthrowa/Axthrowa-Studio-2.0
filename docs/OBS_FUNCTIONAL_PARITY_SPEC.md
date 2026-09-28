# OBS işlevsel paritesi — son durum (2026-09-28)

> Referans: kurulu ve güncel OBS 32.2.2 ([OBS_CURRENT_VERSION_AUDIT](OBS_CURRENT_VERSION_AUDIT.md)). Başlangıç boşlukları:
> [OBS_UI_FORENSIC_AUDIT](OBS_UI_FORENSIC_AUDIT.md). Hedef piksel kopyası değil **iş akışı paritesi**dir: OBS kodu,
> simgesi, logosu, QSS'i kopyalanmadı; OBS'in dosya biçimleri ve libobs davranışı yalnız referans olarak okundu
> ([ADR-004](OBS_LICENSE_ARCHITECTURE_DECISION.md)).
>
> Durum sözlüğü: **UYGULANDI** (otomatik sınamayla doğrulandı) · **UYGULANDI-UNVERIFIED** (kod var, çalışma anı
> bilinçli olarak sınanmadı: gerçek ekran/oyun/pencere/kamera/mikrofon yakalanmadı — kullanıcı kararı) ·
> **KISMİ** · **YOK**. Kanıtlar: motor `sinama` (35 denetim), `src-tauri/tests/server_api.rs` (30 entegrasyon),
> birim testleri (Rust 290, ön yüz 383) ve tarayıcı bölmesinde başsız sunucuyla arayüz sınaması.

## Mimari özeti

- **Motor** `motor/` (GPL-2.0-or-later, ayrı süreç): kurulu OBS'in `obs.dll`'sini yükler; tuval başına çoklu sahne,
  gruplar, tam dönüşüm, geçişler, Studio Mode, filtreler, ses ölçerleri, JPEG canlı akış, kayıt biçimleri, tarayıcı
  kaynağı (obs-browser/CEF), eklentiler. Panel onunla yalnız stdio JSON ile konuşur.
- **Panel** (Tauri): sahne koleksiyonları v2 (`motor_koleksiyon.rs`), profiller (`motor_profil.rs`), HTTP/WS uçları
  (`server/motor_*_api.rs`, `koleksiyon_api.rs`, `profil_api.rs`), yayın çalışma alanı
  (`src/components/broadcast/`).

## İstem maddeleri → durum

| § | Konu | Durum | Kanıt / not |
|---|---|---|---|
| 1 | Lisans kapısı | UYGULANDI | ADR-003 + ADR-004 (kişisel kullanım, dağıtım yok) |
| 2 | Güncel OBS referansı | UYGULANDI | 32.2.2 hem kurulu hem güncel kararlı |
| 3, 58 | OBS'e tanıdık ana pencere | UYGULANDI | Menü çubuğu · önizleme · alt dock sırası · durum çubuğu; DOM ölçümü ve tarayıcı sınaması ([WORKSPACE_LAYOUT_ARCHITECTURE](WORKSPACE_LAYOUT_ARCHITECTURE.md)) |
| 4 | Menüler | UYGULANDI | Dosya, Düzen, Görünüm, Docklar, Profil, Sahne Koleksiyonu, Araçlar, Yayın, Hedefler, Eklentiler, Kontrol Merkezi, Otomasyon, Yardım; klavyeyle gezilir; Ctrl+K komut paleti |
| 5 | Sahneler paneli | UYGULANDI | Ekle, kaldır, yeniden adlandır, çoğalt, sürükle-bırak/menü sırala, geçiş geçersiz kılma; tıklama programa (Studio Mode'da önizlemeye) |
| 6 | Sahne koleksiyonları | UYGULANDI | Çoklu koleksiyon; yeni/çoğalt/adlandır/geç (motor çalışırken, çıktılar sürer)/sil(yedeğe)/yedekle/içe-dışa aktar/**OBS'ten içe aktar**; v1 dosyası silinmeden göç |
| 7, 18 | Kaynaklar paneli + bağlam menüsü | UYGULANDI | Ağaç (gruplar), göz, kilit, durum, filtre işareti; Özellikler, Filtreler, Dönüşüm alt menüsü, Sıra, Grupla/Çöz, Kopyala, Yapıştır (başvuru/kopya), Çoğalt, Yeniden adlandır, Kaldır, Kaynağı sil. "Etkileşim" görünür ama devre dışı (bkz. KNOWN_LIMITATIONS) |
| 8 | Kaynak ekle | UYGULANDI (+UNVERIFIED) | Renk, yazı, görsel, medya, **tarayıcı**, sahne (iç içe), eklenti türleri, "var olanı ekle" sınandı; ekran/pencere/oyun/kamera/mikrofon/masaüstü/**uygulama sesi** yakalama UNVERIFIED |
| 9 | Kaynak/uygulama sesi yakalama | UYGULANDI-UNVERIFIED | Oyun/pencere yakalamada `capture_audio`, `wasapi_process_output_capture` (pencere + öncelik); özellik anahtarları örnek oluşturmadan doğrulandı |
| 10 | Çift ses uyarısı | UYGULANDI | Uygulama sesi + masaüstü sesi ortak izde → İkisini tut / Masaüstünü sustur / Yok say (birim testi) |
| 11 | Her ses kaynağı mikserde | UYGULANDI | Ses bayrağı olan her kaynak ayrı kanal (tarayıcı WebAudio dahil) |
| 12 | Profesyonel mikser | UYGULANDI (solo yok) | dB fader, RMS/tepe/tutma ölçer, kırpılma, sustur, izleme, izler, mono, medya denetimi, filtreler, gizle. OBS'te de solo yoktur; eklenmedi |
| 13 | Ses izleri + adlar | UYGULANDI | 6 iz, profilde adlandırılmış karışımlar (Yayın/VOD/Kayıt/Klip/Müziksiz/Temiz); hedef ve kayıt izi seçimi |
| 14 | Gelişmiş Ses Özellikleri | UYGULANDI | Düzey (+26 dB), mono, denge, senkron (−950…20000 ms), izleme, iz 1–6 |
| 15 | Ses filtreleri | UYGULANDI | Kurulu OBS'in tüm ses filtreleri (kazanç −20 dB ölçerde tam 20 dB düşüş sınandı) |
| 16 | Dönüşüm | UYGULANDI | Konum, döndürme, ölçek/boyut, hizalama, sınır türü/hizalama/boyutu, kırpma, ölçek filtresi, karıştırma; kopyala/yapıştır/sıfırla/çevir/90°/sığdır/uzat/ortala |
| 17 | Önizleme etkileşimi | UYGULANDI | Seç, Ctrl çoklu, sürükle, 8 tutamaç (köşe oran korur, Shift serbest), kenar/merkez yapışma, ok tuşu itme, bağlam menüsü, geri al/yinele. Alt+sürükle kırpma yok (Dönüşüm penceresinden) |
| 19 | Geçişler | UYGULANDI | Kurulu OBS'in geçişleri (Kes, Soldur, Swipe, Slide, Stinger, Renge Geç, Luma Wipe), süre, özellikler, sahne başına geçersiz kılma |
| 20 | Studio Mode | UYGULANDI | Önizleme | Geçiş/Kes/Takas | Program; ayrı işleme tuvali |
| 21–24 | Kısayollar | UYGULANDI (+küresel UNVERIFIED) | Eylem kayıt defteri: sahneye geç, Studio geçişi, göster/gizle, sustur/aç, **bas-konuş/bas-sustur** (bırakma olayı), medya, kayıt/tekrar/yayın; çakışma denetimi mevcut. Gerçek küresel tuş basışı masaüstü otomasyonu yasak olduğundan sınanmadı ([OBS_HOTKEY_PARITY_MATRIX](OBS_HOTKEY_PARITY_MATRIX.md)) |
| 25–29 | Çıkış Basit/Gelişmiş/Uzman, donanım algılama | UYGULANDI | Kodlayıcı listesi kurulu OBS'ten; Uzman'da kodlayıcının kendi özellik formu |
| 30–33 | Çoklu yayın ayarları, platform kartı | UYGULANDI | Nötr simge + ad; sunucu, anahtar, tuval, ses karışımı, bit hızı, TCP sınaması, etkin |
| 34–39 | Güvenli anahtar, SecretStore, göster/kopyala | UYGULANDI | [SECRET_STORAGE_ARCHITECTURE](SECRET_STORAGE_ARCHITECTURE.md) |
| 40–42 | GO LIVE ön kontrol, bağımsız hedefler | UYGULANDI | Ön kontrol penceresi; bir hedef durunca diğerleri sürer (motor `sinama`) |
| 43–44 | Kodlama paylaşımı | UYGULANDI | Aynı tuval + bit hızı tek kodlayıcı, farklısı ayrı (`v-ana`, `v-ana-2500`) |
| 45–46 | Ayar paritesi, profiller | UYGULANDI | [OBS_SETTINGS_PARITY_MATRIX](OBS_SETTINGS_PARITY_MATRIX.md) |
| 47–53 | Eklenti uyumluluğu | UYGULANDI | [OBS_PLUGIN_COMPATIBILITY_MATRIX](OBS_PLUGIN_COMPATIBILITY_MATRIX.md) |
| 54–57 | Görsel dil, OBS varlığı yok | UYGULANDI | `dt-*` tasarım sistemi, lucide simgeleri, kart/gradyan yok |
| 59–61 | Ek docklar, kalıcılık, çoklu monitör | KISMİ | Hedefler + İstatistikler ek dock; boyutlandırma/gizleme/kilit/kalıcılık; ayrı pencerede dock ve projektör (monitör seçimi). Sekme grupları ve Kontrol Merkezi bileşenlerinin (sohbet, uyarı kuyruğu) dock olarak eklenmesi yapılmadı |
| 62–69 | Sinyal yolu, izleme, eşleşme, durum, tarayıcı/medya sesi | UYGULANDI (+UNVERIFIED) | Kaynak durumu (hazır/bekliyor, programda/görünüyor), tarayıcı ve medya sesi mikserde; izleme yalnız "kapalı" sınandı (hoparlöre ses verilmez); yakalama kartı UNVERIFIED |
| 70–72 | Platform önerileri, Uzman saygısı, sihirbaz | UYGULANDI | Yalnız doğrulanmış sınırlar (Kick 8000 kbps, YouTube anahtar kare ≤4 sn; kaynak+tarih); Uzman ayarları kendiliğinden değişmez; sihirbaz yerel kodlama sınaması yapar, platforma bant genişliği sınaması yapmaz |
| 73–78 | Kabul sınamaları | UYGULANDI (sentetik) | [UX_ACCEPTANCE_TESTS](UX_ACCEPTANCE_TESTS.md) |
| 80 | Belgeler | UYGULANDI | Bu belge ve bağlantılı matrisler |

## Bilinçli olarak yapılmayanlar

Gerçek platforma yayın, gerçek yakalama (ekran/oyun/pencere/kamera/mikrofon), hoparlöre izleme, masaüstü girdi
otomasyonu, OBS'in kendi dosyalarına yazma, platform logosu indirme. Ayrıntı: [KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md).
