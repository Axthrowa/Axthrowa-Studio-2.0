# PLAN PROMPTU — Özgün Yayın Motoru + OBS düzeninde Stüdyo + SE.Live işlevleri (dağıtıma hazır)

> **Kullanım:** Bu dosyanın tamamını depo kökünde çalışan kodlama ajanına (ör. Cursor) ver. Ajan, önce
> §0'daki kararları ADR olarak yazar, sonra fazları sırayla uygular. Her faz ayrı bir oturumda "FAZ N'yi uygula"
> diyerek yürütülebilir. Bu belge hukuki danışmanlık değildir; dağıtımdan önce bir avukata §2'yi okut.

---

## ROL VE GÖREV

Sen, `yayin-yonetim-araci` deposunda çalışan kıdemli bir sistem/yayın mühendisisin. Görevin: **OBS Studio'nun
arayüz düzenini ve iş akışını birebir karşılayan, SE.Live'ın (StreamElements) çoklu yayın / çoklu tuval / Backtrack /
sohbet işlevlerini içeren, bunların ikisinden de daha işlevsel, tamamen kendi kodumuzla yazılmış, lisans açısından
temiz ve dağıtıma hazır** bir çoklu platform yayın stüdyosu inşa etmek.

"Aynısı" şu anlama gelir: **yerleşim, bilgi mimarisi, menü ağacı, dock'lar, bağlam menüleri, ayar sayfalarının
yapısı, kısayollar, önizleme etkileşimleri ve davranışlar** OBS kullanıcısının hiç düşünmeden kullanabileceği kadar
birebir olacak. **Kod, simgeler, tema değerleri, metinler ve marka bizim olacak.** libobs'un mimarisinden ilham
alınır; kodu kopyalanmaz.

Kaliteden taviz yok: her özellik ya **çalışır ve test edilmiştir** ya da arayüzde **hiç görünmez**. Yarım özellik,
sahte düğme, "yakında" rozeti yok (depodaki `KNOWN_LIMITATIONS.md` ilkesi aynen geçerli).

---

## MEVCUT DURUM (önce oku, sonra değiştir)

Başlamadan şu dosyaları oku ve bu planla çelişen her şeyi not et:

- `docs/OBS_LICENSE_ARCHITECTURE_DECISION.md` (ADR-004): **"Kişisel kullanım; dağıtım yok"** varsayımına dayanıyor.
  Bu plan o varsayımı **iptal eder** → yeni ADR-005 yazılacak (§0).
- `docs/STREAMING_ENGINE_DECISION.md` (ADR-001/002/003): libobs tabanlı ayrı süreç kararı. Seçenek B (bağımsız
  motor) o gün "aylar/yıllar" diye ertelenmişti; dağıtım hedefiyle artık **ana yol B'dir**.
- `motor/` — `yayin-motoru` (Rust, GPL-2.0-or-later, `libloading` ile kurulu OBS'in `obs.dll`'ini yükler, stdio JSON
  protokolü: `baslat`, `tuval.olustur`, `sahne.*`, `kaynak.*`, `kodlayici.*`, `cikis.*`, `istatistik`, `onizleme`…).
- `src-tauri/src/` — panel çekirdeği: `motor_kopru.rs`, `motor_obs_ice.rs`, `multistream/` (FFmpeg yönlendirici,
  `policy.rs` platform kuralları), `obs_client.rs`, `secret_store.rs`, `hotkeys.rs`, `eklenti/`, `server/`
  (control plane, 127.0.0.1:8843), `bot/`, `kick/`, `db/`.
- `src/` — React 19 + Tailwind panel, `dt-*` tasarım sistemi, lucide simgeleri, `lib/dockDuzeni.ts`,
  `lib/sahneAgaci.ts`, `lib/geriAl.ts`, `lib/licenses.test.ts`, `scripts/lisans-denetimi.mjs`.
- Denetim belgeleri: `OBS_UI_FORENSIC_AUDIT.md`, `OBS_FUNCTIONAL_PARITY_SPEC.md`, `OBS_SETTINGS_PARITY_MATRIX.md`,
  `OBS_SOURCE_PARITY_MATRIX.md`, `OBS_AUDIO_PARITY_MATRIX.md`, `OBS_HOTKEY_PARITY_MATRIX.md`,
  `SELIVE_COMPLETE_AUDIT.md`, `MULTISTREAM_ARCHITECTURE.md`, `MULTICANVAS_ARCHITECTURE.md`, `VIDEO_PIPELINE.md`,
  `AUDIO_ENGINE.md`, `ENCODER_LIFECYCLE_DESIGN.md`, `WORKSPACE_LAYOUT_ARCHITECTURE.md`, `UI_UX_DESIGN_SYSTEM.md`.
  **Bu matrisler kabul listesinin temelidir**; her faz sonunda ilgili satırlar güncellenir.

Korunacaklar: panel özellikleri (bot, sohbet, uyarılar, overlay, otomasyon, Kontrol Merkezi), SecretStore, control
plane + denetim günlüğü, platform politika tablosu, süreç yalıtımı ilkesi ("arayüz çökse de yayın düşmez").

---

## §0 — İLK İŞ: KARARLAR (ADR-005) — kod yazmadan önce

`docs/ADR-005-DAGITIM-VE-OZGUN-MOTOR.md` dosyasını yaz. İçinde şunlar karara bağlanır:

1. **Dağıtım modeli: VAR.** Ürün kapalı kaynak (veya kendi seçeceğimiz lisansla) dağıtılacak.
2. **Motor stratejisi — varsayılan: YOL B (özgün motor).** libobs'a bağlanılmaz, yüklenmez, kodu kopyalanmaz.
   - *Alternatif YOL G (bilgi için, seçilmedikçe uygulanmaz):* Tüm ürünü GPL-2.0-or-later açık kaynak yapmak. Bu
     durumda libobs doğrudan kullanılabilir, gerçek OBS eklenti uyumluluğu kalır, geliştirme yıllarca kısalır —
     ama panel dahil tüm kaynak açılmak zorundadır. Ürün sahibi G'yi seçerse bu planın §2 ve Faz 1–3 kapsamı
     küçülür; ajan bu durumda durup yeniden planlar.
3. **Mevcut `motor/` (GPL) emekliye ayrılır.** Yeni motor hazır olana kadar "harici OBS modu" (obs-websocket
   istemcisi, `obs_client.rs`) isteğe bağlı bir uyumluluk yolu olarak kalır; dağıtılan paket libobs/obs.dll
   içermez ve yüklemez.
4. **OBS eklenti uyumluluğu kapsam dışıdır** (libobs ABI'sine bağlanmak GPL doğurur). Yerine kendi eklenti API'miz
   (§5.9) gelir. İleride istenirse ayrı, açık kaynak, ayrı dağıtılan bir GPL "köprü" eklentisi değerlendirilebilir;
   ana ürün buna bağımlı olmaz.
5. **Hedef işletim sistemi:** Faz 1–12 Windows 10 22H2+ / Windows 11 x64. Tüm platforma bağlı kod soyutlama
   katmanlarının arkasında yazılır; macOS (ScreenCaptureKit, Metal, VideoToolbox, CoreAudio) ve Linux (PipeWire,
   Vulkan, VA-API) sonraki bir yol haritasıdır.

---

## §1 — MUTLAK KURALLAR

1. **Temiz oda (clean-room) disiplini.** OBS/libobs kaynak kodu yalnız **mimari fikir** için okunabilir (ör. "ses
   1024 örnekli tiklerle karıştırılır", "kaynak/filtre/geçiş aynı temel nesneden türer"). Fonksiyon gövdesi, yapı
   düzeni, gölgelendirici (shader) kodu, sabit tabloları, yerelleştirme metinleri, QSS tema değerleri **kopyalanmaz,
   çevrilmez, uyarlanmaz**. Her modülün başında `// Bağımsız uygulama: <hangi resmi belge/standarda dayandı>` notu.
   Referans olarak öncelik: Microsoft/NVIDIA/AMD/Intel resmi belgeleri, RFC'ler, Adobe RTMP/FLV şartnamesi,
   Enhanced RTMP şartnamesi (veovera), ITU-R BT.709/2020/2100, ISO BMFF, Matroska belgeleri.
2. **Marka.** "OBS", "StreamElements", "SE.Live" adları, logoları, simgeleri, açılış ekranları kullanılmaz. Metinde
   yalnız "OBS sahne koleksiyonunu içe aktar" gibi uyumluluğu tarif eden yerlerde geçebilir.
3. **Bağımlılık lisans politikası** (§2) `cargo-deny` ve `scripts/lisans-denetimi.mjs` ile **CI'da zorunlu**. GPL /
   AGPL / LGPL-statik bağımlılık eklenirse derleme kırılır.
4. **Gerçek platforma yayın yok.** Uçtan uca testler yalnız 127.0.0.1 alıcılarıyla (kendi yazdığımız RTMP/SRT test
   sunucusu). Canlı hesapla yayın ancak ürün sahibinin açık izniyle.
5. **Sahte arayüz yok.** Çalışmayan özellik görünmez. Donanımda olmayan kodlayıcı listede yer almaz.
6. **Her faz = kod + test + belge + parite matrisi güncellemesi + ölçüm.** Faz sonu raporu
   `docs/FAZ-N-RAPOR.md`: ne yapıldı, nasıl doğrulandı (komut + çıktı), ne yapılmadı, hangi durum etiketi
   (`VERIFIED_LOCAL`, `UNVERIFIED`, `NOT_SUPPORTED`).
7. **Geri alınamaz adımlarda dur ve sor** (depo yapısını silmek, `motor/`'u kaldırmak, sürüm etiketlemek, imzalama
   sertifikası kullanmak).
8. Arayüz dili Türkçe + İngilizce (i18n anahtarlarıyla; metinler bizim yazdığımız metinler), kod tanımlayıcıları
   İngilizce veya depo geleneğine uygun, yorumlar Türkçe olabilir.

---

## §2 — LİSANS VE BAĞIMLILIK MATRİSİ

### İzinli (dinamik/statik bağlanabilir)

| Amaç | Bileşen | Lisans | Not |
|---|---|---|---|
| Windows API | `windows` / `windows-sys` crate | MIT/Apache-2.0 | D3D11, DXGI, WGC, WASAPI, MF, DirectWrite, DComp |
| NVIDIA kodlama | NVENC Video Codec SDK başlıkları (`nvEncodeAPI.h`) | MIT (başlık) | Çalışma anında sürücüden `nvEncodeAPI64.dll` |
| AMD kodlama | AMF SDK | MIT | |
| Intel kodlama | oneVPL (libvpl) | MIT | |
| Yazılım H.264 | OpenH264 | BSD-2 | Patent kapsamı için Cisco ikilisi **çalışma anında Cisco'dan indirilir** |
| Yazılım AV1 | SVT-AV1 | BSD-3 + AOM patent | |
| Ses kodlama | Opus (libopus) | BSD-3 | AAC: Windows Media Foundation AAC kodlayıcısı |
| Çözme / demux | FFmpeg **LGPL derlemesi** (`--enable-gpl` ve `--enable-nonfree` YOK), **yalnız dinamik** DLL | LGPL-2.1+ | x264/x265/fdk-aac içermez; kaynak teklifi + yeniden bağlanabilirlik şartı THIRD_PARTY_NOTICES'te |
| Tarayıcı kaynağı | CEF (Chromium Embedded Framework) | BSD-3 | Varsayılan derleme H.264/AAC çözmez; not düş |
| Gürültü bastırma | RNNoise | BSD-3 | NVIDIA Broadcast SDK isteğe bağlı (kendi EULA'sı) |
| DSP | speexdsp (yeniden örnekleme/AEC) | BSD-3 | veya `rubato` (MIT) |
| VST3 barındırma | VST3 SDK | 2025'ten beri MIT (**sürümü doğrula**) | |
| Makine öğrenmesi | ONNX Runtime | MIT | Model lisansları ayrıca denetlenir (ör. Apache-2.0 selfie segmentasyonu) |
| SRT | libsrt | MPL-2.0 | Dosya düzeyinde copyleft; değiştirmeden dinamik kullan |
| WebRTC/WHIP | `str0m` veya `webrtc-rs` | MIT/Apache-2.0 | |
| TLS | `rustls` + Windows sertifika deposu | Apache/MIT/ISC | RTMPS için |
| Betik | Lua (`mlua`) , QuickJS (`rquickjs`) | MIT | |
| Çökme raporu | Crashpad | Apache-2.0 | veya `minidumper` (MIT) |

### Yasak

x264, x265, fdk-aac, GPL FFmpeg derlemesi, libobs ve OBS eklentileri, obs-browser, OBS graphics-hook,
obs-virtualcam, OBS yerelleştirme/tema dosyaları, AGPL herhangi bir şey. NDI SDK yalnız ayrı onay + NDI lisans
koşullarıyla (isteğe bağlı modül, varsayılan kapalı).

### Patent notu (ADR-005'e yaz)

H.264/HEVC/AAC patent lisansı: donanım kodlayıcıları (NVENC/AMF/QSV) ve işletim sisteminin kodlayıcıları
(Media Foundation) tercih edilir; OpenH264 Cisco ikilisiyle kullanılır. AV1/Opus telifsiz. Ticari dağıtım öncesi
avukat görüşü alınır.

### Çıktılar

`THIRD_PARTY_NOTICES.txt` derleme sırasında otomatik üretilir (`cargo about` + npm lisans taraması), kurulumla
gelir ve Yardım → Hakkında → Lisanslar'da görünür. SBOM (CycloneDX) her sürümle yayınlanır.

---

## §3 — HEDEF MİMARİ

```
┌──────────── Kabuk süreci (Tauri 2, Rust + WebView2/React) ────────────┐
│  OBS düzeninde arayüz: menüler, dock'lar, ayarlar, SE.Live panelleri   │
│  Önizleme/Program/Multiview: NATİF D3D11 swapchain (DirectComposition) │
│  Control Plane · SecretStore · Bot · Sohbet · Otomasyon · Store        │
└──────────────┬────────────────────────────────────────────────────────┘
               │ IPC: adlandırılmış kanal (komut/olay, sürümlü şema)
               │      + paylaşımlı D3D11 doku tutamaçları (önizleme)
┌──────────────▼──────────────── Motor süreci `yayin-cekirdek` ─────────┐
│  Grafik: Source/Filter/Transition/Scene/Group/Canvas (ref sayımlı)    │
│  Render iş parçacığı (GPU, tuval başına) · Ses iş parçacığı (48 kHz)  │
│  Kodlayıcı havuzu (paylaşımlı/ayrık) · Çıkışlar (RTMP/S, SRT, WHIP,   │
│  HLS, kayıt, tekrar, Backtrack, sanal kamera)                         │
│  Eklenti ana bilgisayarı (C ABI) · Betik (Lua/JS) · WebSocket API     │
└──────────────┬───────────────────────────────────────────────────────┘
               │ alt süreçler (Job Object, çökme yalıtımı)
      ┌────────▼────────┐  ┌──────────────┐  ┌───────────────────────┐
      │ CEF tarayıcı     │  │ Oyun yakalama│  │ Eklenti yalıtım süreci│
      │ (paylaşımlı doku)│  │ kanca ajanı  │  │ (güvensiz eklentiler) │
      └─────────────────┘  └──────────────┘  └───────────────────────┘
```

Değişmez ilkeler:
- **Kabuk çökerse yayın/kayıt sürer**; kabuk yeniden açılınca motora yeniden bağlanıp durumu geri yükler.
- **Motor çökerse** kabuk ayakta kalır, minidump alır, son sahne koleksiyonunu ve çıkışları kurtarma önerisiyle
  yeniden başlatır.
- Tarayıcı kaynağı, oyun kancası ve güvensiz eklentiler ayrı süreçte; biri çökünce yalnız o kaynak "kırmızı" olur.
- Tüm durum değişiklikleri tek bir **komut veri yolundan** geçer → geri al/yinele, WebSocket API, kısayollar,
  Stream Deck, betikler ve arayüz **aynı komutları** kullanır.

### Önizleme (erken spike — Faz 4'ün ilk işi)
Hedef: menüler/açılır listeler önizlemenin **üstünde** görünebilmeli, 60 fps, ≤1 kare gecikme.
1. Birincil: ana HWND'de DirectComposition ağacı; alt katman motorun paylaşımlı dokusundan beslenen flip-model
   swapchain, üstte saydam arka planlı WebView2. React, önizleme alanının dikdörtgenini (DPI dahil) her yerleşim
   değişiminde kabuğa bildirir.
2. Yedek: WebView2 composition hosting (wry'de yama/fork gerekebilir).
3. Son çare: paylaşımlı bellek + WebGPU yükleme (ölç; 1080p60'ta CPU yükü raporlanır).
Seçim, ölçümleriyle birlikte `docs/PREVIEW_SPIKE.md`'ye yazılır.

---

## §4 — OBS ARAYÜZ PARİTESİ (ayrıntılı kabul listesi)

Kural: her madde `docs/OBS_UI_PARITY_CHECKLIST.md`'de bir satır olur (Durum / Test / Ekran görüntüsü). Görsel dil
kendi `dt-*` sistemimiz: koyu/açık/yüksek kontrast tema, tek simge ailesi (lucide), kendi tipografimiz. **Ölçüler,
sıra, konumlar ve davranış OBS ile aynı; renk ve çizim bizim.**

### 4.1 Ana pencere
- Menü çubuğu · ortada önizleme · altta varsayılan dock sırası: **Sahneler | Kaynaklar | Ses Mikseri | Sahne
  Geçişleri | Denetimler** · en altta durum çubuğu.
- Önizleme altında **kaynak araç çubuğu** (seçili kaynağa göre: medya oynat/durdur/ara, metin, cihaz seçimi…).
- Dock'lar: sürükle-bırak yeniden konumlandırma, sekmeleme, pencereye çıkarma (ayrı native pencere), çoklu
  monitör, kilitleme ("Docklar → Kilitle"), "Düzeni sıfırla", özel tarayıcı dock'u, dock düzeni **profil başına**
  kalıcı. Yerleşik ek dock'lar: İstatistikler, Etkinlik/Sohbet (SE.Live), Yayın Bilgisi, Çoklu Çıkış, Backtrack,
  Günlük.
- Tam ekran arayüz, pencere konumu/boyutu/maximize durumu kalıcı, yüksek DPI ve karışık DPI monitör desteği.

### 4.2 Menü ağacı (her öğe çalışır, kısayolu gösterilir)
- **Dosya:** Kayıtları göster · Yeniden muxla · Ayarlar · Ayarlar klasörünü göster · Profil klasörünü göster ·
  Her zaman üstte · Çıkış.
- **Düzen:** Geri al / Yinele (açıklamalı: "Geri al: 'Kamera' taşındı") · Kopyala / Yapıştır (Başvuru) / Yapıştır
  (Çoğalt) · Filtreleri kopyala/yapıştır · Dönüşüm alt menüsü (Düzenle, Kopyala, Yapıştır, Sıfırla, 90° sağ/sol,
  180°, Yatay/Dikey çevir, Ekrana sığdır, Ekrana yay, Ortala, Dikey/Yatay ortala) · Sıra alt menüsü · Önizlemeyi
  kilitle · Önizleme ölçekleme (Pencereye göre, Tuval, Çıkış) · Gelişmiş ses özellikleri.
- **Görünüm:** Tam ekran arayüz · Dock'lar/araç çubukları/durum çubuğu göster · Kaynak simgeleri · Multiview
  (Pencere) · Önizleme yakınlaştırma.
- **Dock'lar:** her dock için onay kutusu · Dock'ları kilitle · Arayüzü sıfırla · Özel tarayıcı dock'ları.
- **Profil:** Yeni · Çoğalt · Yeniden adlandır · Kaldır · İçe/Dışa aktar · profil listesi (onay işaretli).
- **Sahne Koleksiyonu:** aynı işlemler + **OBS sahne koleksiyonu JSON'unu içe aktar** (bizim avantajımız:
  eşlenemeyen kaynaklar "eksik" yer tutucu olarak gelir) + Eksik dosyaları denetle.
- **Araçlar:** Otomatik yapılandırma sihirbazı · Çıkış zamanlayıcısı · Betikler · WebSocket sunucu ayarları ·
  Altyazı (yerel konuşma tanıma, isteğe bağlı) · Sanal kamera ayarları.
- **Yardım:** Belgeler · Günlük dosyaları (Göster/Yükle-yerine: klasörde aç, Son günlüğü görüntüle, Çökme
  raporları) · Güncellemeleri denetle · Güvenli kip yeniden başlat · Hakkında (sürüm, lisanslar, SBOM).

### 4.3 Sahneler dock'u
Liste/ızgara görünümü · çift tıklama davranışı (Studio Mode'da önizlemeye alır) · sürükle-bırak sıra · alt çubuk:
+, −, filtreler, yukarı/aşağı · bağlam menüsü: Çoğalt, Yeniden adlandır (F2), Kaldır (Del), Sıra, Projektör
(ekran seç / pencere), Ekran görüntüsü, Filtreler, Geçişi geçersiz kıl (tür + süre), Multiview'da göster, Ekran
çiz / Sahneyi göster-gizle kısayolu · sahne başına kısayol.

### 4.4 Kaynaklar dock'u
Göz (görünürlük) ve kilit simgeleri, kaynak türü simgeleri (Görünüm'den açılıp kapanır), çoklu seçim
(Ctrl/Shift), sürükle-bırak sıra ve gruba taşıma, iç içe gruplar (daralt/genişlet), filtre göstergesi, çift
tıklamada özellikler · alt çubuk: +, −, özellikler, yukarı/aşağı · **Kaynak ekle menüsü** (§5.4 listesi; "Mevcut
kaynağı ekle" / "Yeni oluştur", görünür yap onay kutusu) · bağlam menüsü: Kopyala, Yapıştır, Filtreleri
kopyala/yapıştır, Yeniden adlandır, Kaldır, Sıra, Dönüşüm, Grupla/Grubu çöz, Ölçekleme filtresi (Devre dışı, Nokta,
Bilinear, Bicubic, Lanczos, Alan), Karıştırma modu (Normal, Toplama, Çıkarma, Ekran, Çarpma, Açıklaştır, Koyulaştır)
ve karıştırma yöntemi (Varsayılan / sRGB kapalı), Deinterlace (modlar + alan sırası), Göster/Gizle geçişi (tür +
süre), Kaynak rengi (etiket), Tam ekran/pencereli projektör, Kaynak ekran görüntüsü, Etkileşim (tarayıcı), Filtreler,
Özellikler, Multiview'da göster.

### 4.5 Önizleme etkileşimi
Seçim kutusu + 8 tutamaç, döndürme tutamacı · Sürükle: taşı; tutamaç: ölçekle (en-boy korur), **Shift**:
serbest ölçek, **Alt**: kırp, **Ctrl**: yapışmayı kapat · Ok tuşları 1 px, Shift+ok 10 px · Kenarlara/ortaya/diğer
kaynaklara yapışma (Ayarlar'dan eşik) · Boşluk yardımcıları (kaynaklar arası mesafe çizgileri, px değeri) · Güvenli
alan kılavuzları (Eylem, Başlık, 4:3 ortası) · Ortalama çizgileri · Önizleme yakınlaştırma/kaydırma (tekerlek +
Space-sürükle) · Önizlemeyi kilitle · Önizlemeyi devre dışı bırak (performans) · Sağ tık bağlam menüsü (Kaynaklar
dock'uyla aynı) · Dönüşüm penceresi: konum, döndürme, boyut, hizalama (9 nokta), sınır kutusu türü (Yok, Sınırlara
sığdır, Sınırlara ölçekle iç/dış/yalnız genişlik/yükseklik, Yay) + sınır hizalaması + "kırpmayı sınıra uygula",
kırpma (4 kenar) — hepsi canlı, geri alınabilir.

### 4.6 Ses mikseri
Yatay ve dikey düzen · her kanal: ad, dB fader (−∞…0 dB, 0.1 dB adım; % gösterim seçeneği), ölçer (−60…0 dB,
yeşil/sarı/kırmızı eşikleri ve renkleri Erişilebilirlik ayarından; tepe tutma, giriş tepe), dB değeri yazısı, sessiz,
izleme simgesi, dişli menüsü · bağlam menüsü: Kilitle, Gizle, Tümünü göster, Sessiz/Açık, Filtreler, Özellikler,
Yeniden adlandır, Gelişmiş ses özellikleri, Ölçer tipi (Tepe / Tepe+ (true peak)), Ölçer düşüş hızı · **Gelişmiş
Ses Özellikleri tablosu:** Ad, Durum (etkin göstergesi), Ses (dB/%), Mono, Denge, Senkron kayması (ms, negatif
dahil), Ses izleme (Kapalı / Yalnız izle / İzle ve çıkış), İzler 1–6; "Yalnız etkin kaynakları göster" onayı ·
Masaüstü sesi / mikrofon genel cihazları · Bas-konuş ve bas-sustur (gecikme ms ile) · Solo (bizim ekimiz).

### 4.7 Sahne geçişleri dock'u
Geçiş türü açılır listesi, +, −, dişli (özellikler, yeniden adlandır), süre (ms) · Türler: Kes, Soldur, Kaydır,
İt, Rengi soldur, Luma sil (hazır desenler + kendi PNG'n; yumuşaklık, ters çevir), **Stinger** (video, geçiş noktası
ms/kare, iz maskesi/matte, ses izleme ve soldurma), Hareket/Taşı geçişi (aynı adlı kaynaklar arası animasyon —
bizim sürümümüz), Sahne başına geçiş geçersiz kılma.

### 4.8 Denetimler dock'u
Yayını başlat/durdur (çoklu çıkış durumuna göre bölünmüş düğme: tümü / seçili) · Kaydı başlat + Duraklat + Böl ·
Tekrar arabelleğini başlat + Kaydet · Backtrack kaydet · Sanal kamerayı başlat + dişli · Studio Mode · Ayarlar ·
Çıkış. Yayın durdururken onay (Ayarlar'dan).

### 4.9 Studio Mode
Önizleme | geçiş sütunu | Program · Geçiş düğmesi, hızlı geçiş düğmeleri (+ ekle, sürükle), **T-bar** (sürükle, kısayol),
Değiştir (swap) modu, "Sahneyi çoğalt" seçeneği, "Kaynak özelliklerini canlı düzenleme uyarısı", program
çift tıklama davranışı, önizleme/program etiketleri, dikey düzen seçeneği.

### 4.10 Durum çubuğu
Canlı süre + sağlık karesi (yeşil/sarı/kırmızı, ağ kaybına göre) · Kayıt süresi (duraklatıldı durumu) · Ağdan düşen
kare (sayı + %) · CPU % · Tekrar/Backtrack göstergesi · FPS (gerçek / hedef) · kb/s · **Çoklu çıkışta tıklanınca
hedef başına tablo** açılır.

### 4.11 Ayarlar penceresi (her alan çalışır; `OBS_SETTINGS_PARITY_MATRIX.md` ile satır satır)
- **Genel:** dil, tema, yayın/kayıt başlarken/durdururken onay, çıkışta sistem tepsisi, tepsi davranışı, kaydı
  yayınla otomatik başlat/durdur, tekrar arabelleğini yayınla başlat, projektörler (her zaman üstte, açılışta
  kaydet, imleci gizle), yapışma ayarları (açık, eşik px, ekran kenarı/kaynak/merkez), kaynak/sahne liste
  davranışları, Studio Mode seçenekleri, multiview düzeni (çok sayıda hazır düzen) ve etiketleri, güncelleme kanalı.
- **Yayın (çoklu çıkış):** SE.Live tarzı hedef kartları (§4.13) + klasik tek-hedef görünümü (Hizmet, Sunucu,
  Anahtar göster/kopyala, hesap bağla, "önerilen ayarları uygula", "sunucuyu otomatik seç", bant genişliği testi
  kipi).
- **Çıkış:** Kip = Basit / Gelişmiş. **Basit:** yayın bit hızı, kodlayıcı, ses bit hızı, gelişmiş kodlayıcı
  ayarları; kayıt yolu, kalite (Yayınla aynı / Yüksek / Belirsiz / Kayıpsız), biçim, kodlayıcı, özel muxer ayarları;
  tekrar arabelleği süre + bellek. **Gelişmiş sekmeleri:** Yayın (ses izi, kodlayıcı, yeniden ölçekleme, kodlayıcı
  seçenekleri: hız kontrolü CBR/VBR/CQP/Kayıpsız, bit hızı, maks. bit hızı, anahtar kare aralığı, ön ayar P1–P7,
  ayar (yüksek kalite/düşük gecikme), çoklu geçiş, profil, look-ahead, psiko-görsel ayar, GPU, B-kare, özel
  seçenekler) · Kayıt (tür: standart/özel çıkış, yol, boşluksuz dosya adı, biçim: MKV, MP4, hibrit MP4,
  parçalı MP4/MOV, MOV, FLV, TS, HLS; iz 1–6 çoklu seçim, kodlayıcı "yayın kodlayıcısını kullan", yeniden ölçekle,
  **otomatik bölme** süre/boyut/elle, özel muxer ayarları) · Ses (6 iz, her biri ad + bit hızı) · Tekrar
  arabelleği (süre, maks. bellek, dosya adı biçimi).
- **Ses:** örnekleme hızı 44.1/48 kHz, kanallar (Mono…7.1), genel masaüstü 1–2 ve mikrofon 1–4 cihazları, ölçer
  düşüş hızı, tepe tipi, izleme cihazı, Windows ses zayıflatmasını kapat, bas-konuş/sustur ayarları, düşük gecikmeli
  ses arabelleği.
- **Video:** temel (tuval) ve çıkış (ölçeklenmiş) çözünürlük (hazırlar + serbest), ölçek filtresi, FPS (ortak
  değerler / tamsayı / kesirli pay-payda). **Çoklu tuval:** her tuval için ayrı satır (§5.10).
- **Kısayollar:** arama/filtre kutusu, "yalnız atananları göster", her eylem için birden çok tuş, +/− ekle,
  temizle, çakışma uyarısı (kırmızı + tooltip), küresel (odak dışı) çalışma, oyun odaklıyken davranış, sahne ve
  kaynak başına kısayollar (göster/gizle, sessiz/aç, bas-konuş, medya denetimleri, filtre aç/kapa).
- **Erişilebilirlik:** seçim/kırpma/sınır renkleri, ölçer renkleri (normal/uyarı/hata × aktif/pasif), yüksek
  kontrast, renk körlüğü hazırları, klavyeyle tam gezinme, ekran okuyucu etiketleri.
- **Gelişmiş:** işlem önceliği, renk biçimi (NV12, I420, I444, P010, I010, P216, P416, BGRA), renk uzayı (sRGB,
  Rec.709, Rec.601, Rec.2100 PQ/HLG), renk aralığı (Sınırlı/Tam), SDR beyaz seviyesi (nit), HDR nominal tepe (nit),
  kayıt dosya adı biçimlendirme (değişken yardımıyla: tarih, saat, sahne, profil, tuval…), üzerine yazma yerine
  sayı ekle, **otomatik remux** (MP4'e), tekrar arabelleği önek/sonek, yayın gecikmesi (sn) + "yeniden bağlanırken
  kesme noktasını koru", otomatik yeniden bağlan (gecikme sn, deneme sayısı, üstel geri çekilme), ağ: bağlanılacak
  IP/arayüz, dinamik bit hızı (tıkanıklıkta düşür), yeni ağ kodu/düşük gecikme kipi, TCP gönderim arabelleği,
  tarayıcı kaynağı donanım hızlandırma, kısayol odak davranışı, sanal kamera biçimi.
- Her sayfada: değiştirilen ayarlar işaretlenir, Uygula / Tamam / İptal, "yayın sürerken değiştirilemez"
  alanlar kilitli + açıklama, "varsayılana dön".

### 4.12 Diğer pencereler
Filtreler penceresi (Ses/Video filtreleri iki liste, sürükle sıra, göz, canlı önizleme, kopyala/yapıştır) ·
Özellikler penceresi (canlı önizlemeli, Varsayılanlar düğmesi) · Projektörler (tam ekran monitör seçimi, pencereli,
kaynak/sahne/önizleme/program/multiview, en-boy koru, her zaman üstte) · Multiview (8+ düzen, tıklayınca
önizlemeye al, çift tıklayınca geçiş, etiketler, güvenli alan) · İstatistikler (CPU, bellek, disk alanı ve kalan
kayıt süresi, FPS, ortalama kare render süresi, render gecikmesi nedeniyle kaçan kareler, kodlama gecikmesi
nedeniyle atlanan kareler, çıkış başına durum/düşen kare/toplam veri/bit hızı; sıfırla) · Otomatik yapılandırma
sihirbazı (kullanım amacı → video → bant genişliği testi → donanım kodlayıcı seçimi → sonuç özeti) · Remux
penceresi (çoklu dosya kuyruğu) · Eksik dosyalar penceresi (ara, klasörde ara, gözat) · Günlük görüntüleyici ·
Çökme sonrası "güvenli kipte başlat?" iletişimi · Çıkış zamanlayıcısı · Betikler penceresi (betik listesi,
özellikler, günlük).

### 4.13 SE.Live işlev paritesi (+ fazlası)
- **Çoklu yayın paneli:** platform kartları (Twitch, YouTube, Kick, TikTok, X, Trovo, Facebook, Özel RTMP/RTMPS/
  SRT/WHIP); kart başına: hesap bağla (OAuth) veya anahtar, tuval seçimi (yatay/dikey), **kodlayıcı profili
  (paylaşımlı veya hedefe özel)**, **ses izi seçimi**, aç/kapa, tek başına başlat/durdur, durum (Hazır →
  Bağlanıyor → Canlı → Yeniden bağlanıyor n/N → Hata(neden) → Durdu), bit hızı/düşen kare mini grafiği.
- **Yayın öncesi kontrol (GO LIVE):** platform kurallarına uygunluk (`policy.rs`), anahtar/hesap geçerliliği,
  bant genişliği yeterliliği, disk alanı, ses kaynağı canlı mı, çift ses uyarısı → uyarı/engel listesi.
- **Yayın bilgisi dock'u:** platform başına başlık, kategori/oyun (arama), etiketler, dil, YouTube gizlilik/
  küçük resim/planlı yayın, "tümüne uygula".
- **Çoklu tuval:** sınırsız yatay/dikey tuval, **bağlı sahneler** (yatay sahne değişince dikey eşi değişir),
  kaynak yeniden kullanımı farklı dönüşümle.
- **Backtrack:** her tuval için sürekli dönen arabellek (süre ve bellek sınırı), tek kısayolla son N saniyeyi
  kaydet, klip listesi + hızlı kırpma/dışa aktarma (dikey tuvalden doğrudan kısa video).
- **Birleşik sohbet + etkinlik dock'u:** mevcut `chatHub` / StreamAxT altyapısı; platform rozetleri, moderasyon
  eylemleri, etkinlik filtreleri, uyarıyı yeniden oynat.
- **Uyarılar/overlay:** mevcut overlay sistemi motorun tarayıcı kaynağına yerel URL ile bağlanır (dış servis
  zorunlu değil).
- **Twitch çift format / Enhanced Broadcasting:** Enhanced RTMP multitrack ile teknik olarak desteklenir; platform
  onayı/API erişimi gerekiyorsa `UNVERIFIED` işaretlenir ve arayüzde gösterilmez.

---

## §5 — MOTOR ŞARTNAMESİ (`yayin-cekirdek`, yeni Rust çalışma alanı)

Depo düzeni önerisi (Cargo workspace `cekirdek/`):
`cekirdek-core` (nesne modeli, grafik, komut veri yolu, zaman) · `cekirdek-gpu` (D3D11 arka uç + soyutlama) ·
`cekirdek-audio` · `cekirdek-capture-win` · `cekirdek-codec` · `cekirdek-output` (rtmp, srt, whip, hls, mux) ·
`cekirdek-browser` (CEF köprüsü) · `cekirdek-plugin-api` (C ABI başlıkları + Rust sarmalayıcı) · `cekirdek-ipc` ·
`cekirdek-server` (WebSocket API) · `cekirdek-bin`.

### 5.1 Nesne modeli (libobs'tan ilham, bizim tasarımımız)
- Temel `Source` türü; alt tipler: girdi, filtre, geçiş, sahne, grup. Yetenek bayrakları: video, ses, async
  video (kendi saatiyle gelen kareler), özel çizim, etkileşim, duraklatılabilir medya.
- Kaynaklar **küreseldir**, sahne öğeleri (SceneItem) onlara başvurur (dönüşüm, kırpma, görünürlük, kilit,
  göster/gizle geçişi, ölçek filtresi, karıştırma modu öğe düzeyinde).
- Ayarlar tip güvenli **özellik şeması** (bool, int, float, metin, yol, liste, renk, yazı tipi, düğme, grup,
  düzenlenebilir liste…) → arayüz formu otomatik üretilir (mevcut `ozellikFormu.ts` genelleştirilir).
- Ref sayımı + zayıf başvuru; yok etme yalnız ilgili iş parçacığında, kuyruğa alınarak.
- Sinyaller/olaylar: tip güvenli olay yayını (kaynak oluşturuldu, yeniden adlandırıldı, görünürlük, ses seviyesi,
  medya durumu, çıkış durumu…).
- Serileştirme: sahne koleksiyonu ve profil **sürümlü JSON** (şema + göç fonksiyonları), atomik yazma + yedekler
  (son 10), bozuk dosyada en son sağlam yedeğe dönüş. **OBS koleksiyon içe aktarıcı** ayrı modül.

### 5.2 Video hattı
- Tuval başına render döngüsü, **sabit kare saati** (QPC tabanlı, kesirli FPS, sapma birikmez), GPU çizimi →
  çıkış çözünürlüğüne ölçekleme → renk dönüştürme (RGBA → NV12/P010/I444 vb., BT.601/709/2020, sınırlı/tam
  aralık) → kodlayıcı(lar)a **sıfır kopya** (NVENC/AMF/QSV'ye D3D11 dokusu doğrudan; yazılım kodlayıcıya yalnız
  gerektiğinde geri okuma, üçlü arabellekli staging).
- Doğrusal ışık/sRGB doğru karıştırma, HDR (scRGB/PQ/HLG) ve SDR↔HDR ton eşleme.
- Ölçek filtreleri kendi gölgelendiricilerimiz: nokta, bilinear, bicubic, lanczos, alan (area).
- Kare kaçırma sınıflandırması: render gecikmesi / kodlama gecikmesi / ağ — istatistiklere ayrı sayılır.
- GPU cihaz kaybı (TDR) kurtarma: cihazı yeniden oluştur, kaynakları yeniden yükle, çıkışları mümkünse koru.

### 5.3 Ses hattı
- 48 kHz (veya 44.1) float düzlemsel, sabit tik (ör. 1024 örnek); her kaynağın kendi zaman damgası → yeniden
  örnekleme + saat sapması düzeltme (uzun oturumda senkron kaymasın) + senkron kayması (ms).
- Karışım: 6 iz, kaynak başına iz maskesi, mono, denge, ses/susturma rampaları (tıklama yok).
- İzleme: seçilen çıkış cihazına düşük gecikmeli kopya; yankı döngüsü algılama uyarısı.
- Ölçüm: tepe, true-peak (4× üst örnekleme), RMS, LUFS (yayın için bizim ekimiz), kanal başına.
- Filtreler (bizim uygulamamız): Kazanç, Gürültü kapısı, Gürültü bastırma (RNNoise + isteğe bağlı NVIDIA),
  Kompresör (yan zincir/ducking dahil), Limitleyici, Genişletici, Yukarı kompresör, 3 bant EQ, **parametrik EQ**
  (ekimiz), De-esser (ekimiz), Kanal ters çevir/değiştir, **VST3 ana bilgisayarı** (eklenti penceresi ayrı
  süreçte), Ses gecikmesi.

### 5.4 Kaynak türleri (Windows)
| Kaynak | Uygulama | Not |
|---|---|---|
| Ekran yakalama | Windows.Graphics.Capture + DXGI Desktop Duplication (seçilebilir) | Çoklu GPU/laptop hibrit GPU uyarısı, imleç yakalama, HDR ekran |
| Pencere yakalama | WGC (+ eski BitBlt kipi) | Pencere eşleme önceliği: başlık / sınıf / exe; kenarlıksız (Win11) |
| Oyun yakalama | Faz 1–10: WGC tabanlı "oyun kipi" (tam ekran algılama) · Faz 11: **kendi** kanca ajanımız | Hile koruması uyumluluğu listesi, imzalı DLL |
| Video yakalama cihazı | Media Foundation (+ DirectShow geri dönüş) | Çözünürlük/FPS/biçim/renk ayarı, cihaz yeniden takılınca kurtarma, cihaz özellikleri penceresi, capture card ses |
| Ses giriş/çıkış yakalama | WASAPI (paylaşımlı; isteğe bağlı exclusive) | Cihaz değişiminde (varsayılan cihaz) canlı geçiş |
| Uygulama ses yakalama | WASAPI süreç loopback (Win10 2004+/11) | Exe'ye göre, süreç yeniden başlarsa yeniden bağlan; video kaynağıyla "uygulama sesini de yakala" |
| Görüntü / Slayt gösterisi | WIC + animasyonlu GIF/APNG/WebP | Slayt: geçiş, süre, rastgele, döngü, klasör izleme |
| Medya kaynağı | FFmpeg-LGPL demux/çözme + D3D11VA donanım çözme | Döngü, yeniden başlat, ağ akışı (RTMP/SRT/HLS), hız, bitince gizle, ses izi seçimi, oynatma listesi |
| Tarayıcı | CEF offscreen, **paylaşımlı doku**, ayrı süreç | Yerel dosya, özel CSS, sayfa sesi → mikser, etkileşim penceresi, FPS, yenileme, gizliyken kapat |
| Metin | DirectWrite | Yazı tipi, renk/gradyan, kontur, gölge, arka plan, hizalama, sarma, dosyadan oku (izle), sohbet/değişken bağlama |
| Renk | — | |
| Sahne / Grup | — | Sahne içinde sahne, gruplar iç içe |
| Zamanlayıcı/geri sayım, saat | (ekimiz) | Otomasyonla bağlanabilir |

### 5.5 Video filtreleri
Kırp/Pad, Ölçekleme/En-boy, Renk düzeltme (gamma, kontrast, parlaklık, doygunluk, ton, opaklık, renk çarpma/
ekleme), LUT uygula (.cube, .png), Chroma key, Renk key, Luma key, Görüntü maskesi/karışım, Keskinleştir, Kaydırma,
Render gecikmesi, Arka plan kaldırma (ONNX), Bulanıklık (Gaussian/kutu — ekimiz), HDR ton eşleme, Gölgelendirici
filtresi (kullanıcı HLSL'i — ekimiz, güvenli derleme).

### 5.6 Kodlayıcılar
- H.264 / HEVC / AV1: NVENC, AMF, QSV (oneVPL), Media Foundation; yazılım: OpenH264 (H.264), SVT-AV1 (AV1).
- Ses: AAC (Media Foundation), Opus.
- Donanım algılama **çalışma anında** (kodlayıcı oturumu açılarak doğrulanır); desteklenmeyen seçenekler gizli.
- **Kodlayıcı havuzu:** aynı tuval+profil isteyen çıkışlar tek kodlayıcıyı paylaşır; farklı profil isteyen hedef
  (ör. Kick 6000 kbps H.264, YouTube 12000 kbps AV1) ayrı kodlayıcı alır — SE.Live'dan ve OBS'ten üstün nokta.
- Anahtar kare zorlaması, dinamik bit hızı değişimi (yeniden başlatmadan), B-kare/look-ahead, çoklu geçiş,
  kayıt için CQP/kalite kipleri.

### 5.7 Çıkışlar
- **RTMP/RTMPS istemcisi — kendi uygulamamız** (Adobe şartnamesi + Enhanced RTMP v1/v2: HEVC, AV1, çoklu iz):
  el sıkışma, parçalama, onay penceresi, `rustls` ile TLS, bağlanılacak IP, TCP arabellek ayarı, gönderim
  kuyruğu ve tıkanıklıkta **düşürme stratejisi** (önce B-kareler, sonra P, anahtar kareye kadar), dinamik bit
  hızı, otomatik yeniden bağlanma (üstel geri çekilme), yayın gecikmesi (kesme noktası korumalı).
- SRT (libsrt, çağıran/dinleyen, gecikme, parola), WHIP (WebRTC), YouTube HLS alım.
- **Kayıt muxer'ları — kendi uygulamamız:** Matroska, MP4/MOV (normal, parçalı, **hibrit MP4**: çökse bile
  kurtarılabilir), FLV, MPEG-TS; çoklu ses izi, bölümler (chapter) ekleme kısayolu, otomatik bölme, duraklat/sürdür
  boşluksuz zaman damgası, otomatik remux.
- Tekrar arabelleği (bellek içi, paketler; süre + bellek sınırı), **Backtrack** (tuval başına).
- **Sanal kamera:** Windows 11 `MFCreateVirtualCamera` ile kendi uygulamamız (Win10 için ayrı DirectShow filtresi,
  kendi kodumuz, isteğe bağlı), çıkış seçimi: program / önizleme / sahne / kaynak / tuval.
- Hedef başına bağımsız durum makinesi; bir hedefin hatası diğerlerini etkilemez.

### 5.8 Platform hizmetleri
`services/` veri dosyası (sürümlü JSON, uygulama içinden güncellenebilir, imzalı): platform adı, sunucular,
önerilen maksimum değerler (bit hızı, çözünürlük, FPS, anahtar kare, kodek), OAuth uç noktaları. OAuth: PKCE,
sistem tarayıcısı + yerel geri dönüş, tokenlar `secret_store.rs`'de. Bant genişliği testi (platform test kipi
destekliyorsa). **Platform istemci kimlikleri (client ID) bizim uygulama kaydımızdır**; her platformun geliştirici
şartları ADR'ye not edilir.

### 5.9 Genişletilebilirlik
- **Eklenti API'si (C ABI, sürümlü, kararlı):** kaynak, filtre, geçiş, kodlayıcı, çıkış, hizmet, dock (web) türü
  kaydı; özellik şeması; olay aboneliği; GPU için sınırlı çizim API'si (ham D3D cihazı "güvensiz" kipte).
  Güvenli kip: eklentisiz başlatma. Çöken eklenti otomatik devre dışı + rapor. İmza/doğrulama isteğe bağlı.
  Örnek eklentiler + SDK belgesi.
- **Betik:** Lua ve JavaScript (QuickJS) — kısayol, zamanlayıcı, olay, komut veri yolu erişimi.
- **WebSocket API:** obs-websocket **5.x protokolüyle uyumlu** bir sunucu (kendi uygulamamız; protokol şartnamesine
  göre). Böylece Stream Deck, Touch Portal, Streamer.bot vb. araçlar değişiklik yapmadan çalışır. Ek olarak kendi
  genişletilmiş istek ad alanımız (çoklu çıkış, tuval, Backtrack). Parola + yerel bağlama varsayılan; LAN isteğe bağlı.

### 5.10 Çoklu tuval
Tuval = birinci sınıf nesne: ad, temel/çıkış çözünürlüğü, FPS, yön, renk ayarları, sahne listesi, güvenli alanlar.
Her tuvalin kendi render döngüsü ve Program/Önizleme'si; bağlı sahneler; aynı kaynağın tuvaller arasında farklı
dönüşümle kullanımı; hedefler tuvale bağlanır. GPU bütçesi raporu (tuval sayısı × çözünürlük).

### 5.11 IPC ve kabuk köprüsü
Adlandırılmış kanal üzerinde uzunluk önekli mesajlar (MessagePack veya JSON), **şema sürümü + uyumluluk
denetimi**, istek/yanıt kimliği, olay akışı, geri basınç (ses ölçer olayları kısıtlı hızda: ~30 Hz). Önizleme
için paylaşımlı D3D11 doku tutamaçları (NT handle, keyed mutex). Mevcut `motor/` JSON komut adları için geçici
uyumluluk adaptörü, böylece panel kodu kademeli taşınır.

---

## §6 — "OBS'TEN VE SE.LIVE'DAN DAHA İYİ" LİSTESİ (her biri ölçülebilir kabul ölçütüyle)

1. Hedef başına ayrı kodlama profili ve ses izi.
2. Arayüz çökse de yayın/kayıt sürer; motor çökse de kabuk kurtarır (otomatik testle kanıtlanır).
3. Hibrit MP4 varsayılan: elektrik kesilse bile kayıt kurtarılır.
4. Oturum geri yükleme: çökme sonrası sahne, çıkış ve Backtrack durumu teklif edilir.
5. Yerleşik yayın sağlığı paneli: hedef başına RTT, gönderim kuyruğu, düşen kare nedeni, öneriler.
6. LUFS ölçümü, parametrik EQ, de-esser, solo — ek eklenti gerekmeden.
7. OBS sahne koleksiyonunu tek tıkla içe aktarma (geçiş kolaylığı).
8. Tüm eylemler aynı komut veri yolunda: sınırsız, açıklamalı geri al/yinele; makro kaydı.
9. Birleşik sohbet/etkinlik, bot, uyarı, otomasyon aynı uygulamada (mevcut panel).
10. Kısayol çakışma analizi + oyun içi çalışma testi.

---

## §7 — FAZLAR (sırayla; her faz sonunda rapor + onay)

| Faz | Kapsam | Kabul ölçütü (özet) |
|---|---|---|
| **F0 Temel** | ADR-005, `cargo-deny` + lisans CI, `cekirdek/` çalışma alanı iskeleti, IPC şeması, günlük/izleme (tracing), çökme dökümü, test RTMP/SRT alıcısı | CI yasaklı lisansta kırılıyor; boş motor kabukla el sıkışıyor |
| **F1 Çekirdek hat** | Nesne modeli, render + ses iş parçacıkları, renk/ölçek gölgelendiricileri, test deseni + ton kaynağı, NVENC/AMF/QSV/MF/OpenH264 + AAC/Opus, MKV/hibrit MP4 kayıt | 1080p60 NVENC 30 dk kayıt: 0 render/kodlama kaybı, A/V kayması < 1 kare, ffprobe temiz |
| **F2 Yakalama** | Ekran, pencere, WGC oyun kipi, kamera/capture card, WASAPI giriş/çıkış, uygulama sesi, görüntü, renk, metin | Cihaz çıkar/tak, varsayılan cihaz değişimi, pencere yeniden açılınca kurtarma testleri |
| **F3 Sahne grafiği** | Sahneler, öğeler, gruplar, dönüşüm, kırpma, karıştırma modları, geçişler (stinger dahil), Studio Mode, çoklu tuval, koleksiyon/profil, geri al/yinele, OBS içe aktarma | Örnek OBS koleksiyonları içe aktarılıyor; 1000 adımlık rastgele geri al/yinele testi tutarlı |
| **F4 OBS düzeninde kabuk** | Önizleme spike'ı → natif önizleme, menüler, tüm dock'lar, önizleme etkileşimi, kaynak araç çubuğu, durum çubuğu, projektörler, multiview | §4.1–4.10 kontrol listesi `VERIFIED_LOCAL`; ekran görüntüleri belgede |
| **F5 Çıkışlar** | Kendi RTMP/RTMPS + Enhanced RTMP, SRT, WHIP, kodlayıcı havuzu, çoklu yayın paneli, yayın öncesi kontrol, tekrar arabelleği, Backtrack, sanal kamera, yeniden bağlanma, gecikme | 4 yerel hedefe 4 saat: bağlantı kes/ağ kısıtla (paket kaybı simülasyonu) senaryolarında diğer hedefler etkilenmiyor |
| **F6 Ayarlar paritesi** | §4.11'in tamamı, otomatik yapılandırma sihirbazı, remux, istatistikler, eksik dosyalar | `OBS_SETTINGS_PARITY_MATRIX.md` her satır ya çalışıyor ya gerekçeli `NOT_SUPPORTED` |
| **F7 Ses ve filtreler** | Tüm ses filtreleri, izleme, VST3, gelişmiş ses özellikleri, tüm video filtreleri, LUFS | Filtre çıktıları referans sinyallerle birim testli (ör. kompresör eğrisi, EQ frekans yanıtı) |
| **F8 Medya + tarayıcı** | FFmpeg-LGPL medya kaynağı, D3D11VA, CEF ayrı süreç + paylaşımlı doku, özel dock'lar, overlay bağlantısı | Tarayıcı süreci öldürülünce yalnız o kaynak düşer, otomatik yeniden başlar |
| **F9 Platformlar (SE.Live)** | OAuth, yayın bilgisi dock'u, platform kartları, birleşik sohbet/etkinlik taşıması, dikey tuval + bağlı sahneler, Backtrack klip düzenleyici | Her platform `UNVERIFIED` → izinli canlı testte `VERIFIED_LIVE` |
| **F10 Genişletilebilirlik** | C ABI eklenti API'si + SDK + örnekler, Lua/JS betik, obs-websocket 5.x uyumlu sunucu | Stream Deck OBS eklentisi bizim sunucumuzla sahne değiştirebiliyor; örnek eklenti çökünce motor ayakta |
| **F11 Oyun yakalama kancası** | Kendi D3D9/10/11/12/Vulkan/OpenGL kancamız (temiz oda), imzalı, hile koruması listesi | Test oyunları matrisinde FPS etkisi < %3 |
| **F12 Dağıtım** | §8'in tamamı | Temiz Windows VM'de kurulum → ilk yayın → güncelleme → kaldırma senaryosu geçiyor |

Her fazda: birim + entegrasyon testleri, `scripts/stress-test.mjs` genişletmesi, performans ölçümü
`docs/PERFORMANCE_REPORT.md`'ye eklenir.

### Performans hedefleri (referans: RTX 5070 makinesi, 1080p60)
- Motor CPU ≤ %5 (NVENC, 1 tuval, 3 hedef paylaşımlı kodlayıcı); ortalama render süresi ≤ 2 ms.
- Kabuk boşta ≤ %2 CPU; ölçer güncellemesi arayüzü kilitlemez.
- 8 saat dayanıklılık: bellek büyümesi < 50 MB, A/V kayması < 1 kare, 0 render kaybı.
- Soğuk açılış → önizleme görünür ≤ 3 sn.

---

## §8 — DAĞITIMA HAZIRLIK (F12, ama iskeleti F0'da kurulur)

- **Paketleme:** Tauri NSIS kurulum + taşınabilir sürüm (mevcut `make-portable.mjs`), motor/CEF/FFmpeg DLL'leri
  kurulumla; kullanıcı başına ve makine başına kurulum; Visual C++ çalışma zamanı ve WebView2 önyükleyicisi.
- **Kod imzalama:** tüm .exe/.dll (motor, CEF alt süreci, kanca DLL'i, eklenti ana bilgisayarı) Azure Trusted
  Signing veya EV sertifikasıyla; zaman damgalı. (`scripts/build-release-signed.ps1` genişletilir.)
- **Güncelleme:** Tauri updater (Ed25519 imzalı manifest), kanallar (kararlı/beta), yayın sürerken güncelleme
  yapılmaz, geri alma (`docs/ROLLBACK.md`).
- **Çökme raporu:** yerel minidump + kullanıcı onayıyla gönderim (kendi sunucumuz), sembol sunucusu.
- **Telemetri:** varsayılan kapalı, açık rıza, KVKK/GDPR aydınlatma metni, veri silme.
- **Ürün lisanslama (istenirse):** Ed25519 imzalı çevrimdışı lisans dosyası, cihaz bağlama (gizlilik dostu),
  deneme süresi, lisans yoksa kısıtlanan özellikler **yayını kesintiye uğratmaz**.
- **Yasal belgeler:** EULA, gizlilik politikası, `THIRD_PARTY_NOTICES.txt`, LGPL FFmpeg için kaynak teklifi ve DLL
  değiştirme talimatı, patent notu, marka kullanım notu ("OBS Studio, OBS Project'in markasıdır; bu ürün onunla
  bağlantılı değildir").
- **Kalite kapısı:** temiz Windows 10 22H2 ve 11 VM'lerinde otomatik kurulum testi, yüksek DPI, Türkçe/İngilizce,
  NVIDIA/AMD/Intel GPU'lu makinelerde kodlayıcı testi (en az raporlanan donanım matrisi), erişilebilirlik denetimi.
- **Destek:** günlük toplayıcı ("Yardım → Günlükleri klasörde aç"), sürüm notları, belgeler (`public/help`).

---

## §9 — ÇALIŞMA BİÇİMİ

1. Her oturumun başında: bu belgeyi, son `FAZ-N-RAPOR.md`'yi ve ilgili parite matrislerini oku.
2. Faz başında `docs/FAZ-N-PLAN.md`: alt görevler, dosyalar, testler, riskler. Belirsizlik varsa **kodlamadan önce
   sor**.
3. Küçük, derlenen, test geçen adımlarla ilerle; her adım ayrı commit (Türkçe açıklayıcı mesaj).
4. Donanıma/OS'e bağlı her özelliği gerçek çalışma anında doğrula; doğrulayamadığını `UNVERIFIED` yaz.
5. Faz sonunda: `FAZ-N-RAPOR.md` + parite matrisleri + `KNOWN_LIMITATIONS.md` güncellemesi + ölçümler.
6. Risk kaydı tut (`docs/RISK_REGISTER.md`): oyun kancası/hile koruması, CEF boyutu ve güncelleme yükü, platform
   API değişiklikleri, patentler, önizleme kompozisyonu, GPU sürücü hataları.

**İlk komut:** "§0'ı uygula: ADR-005'i yaz, ADR-004'ü 'yerine geçildi' olarak işaretle, F0 planını
`docs/FAZ-0-PLAN.md`'ye çıkar ve onay iste."
