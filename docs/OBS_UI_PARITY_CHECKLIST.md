# OBS arayüz paritesi — kontrol listesi (plan §4)

Kaynak: `docs/PLAN_PROMPT_OZGUN_YAYIN_MOTORU.md` §4. Karar: **YOL G** (ADR-005) — motor libobs (GPL), özgün motor
yok; arayüz kendi `dt-*` tasarım sistemimiz (OBS simgesi/QSS/görseli kopyalanmaz).

Durum sözlüğü: **VAR** (çalışır ve sınanmış) · **KISMİ** (çalışır ama OBS'teki seçeneklerin bir bölümü eksik;
eksik not sütununda) · **YOK** (henüz yapılmadı) · **DESTEKLENMİYOR** (bilinçli olarak yok; neden yazılı).

Test sütunu: `sinama` = `yayin-motoru sinama` öz-sınaması (48 denetim, sentetik) · `it:<ad>` =
`src-tauri/tests/server_api.rs` entegrasyon testi · `vt:<dosya>` = vitest · `tp` = tarayıcı bölmesinde başsız
sunucuyla elle (ekran görüntüsü/JS denetimi) · `—` = yalnız derleme/tip denetimi.

Son güncelleme: 29.09.2026 (commit `892e2fa`).

## 4.1 Ana pencere

| Madde | Durum | Test | Not |
|---|---|---|---|
| Menü çubuğu · önizleme · alt dock sırası Sahneler/Kaynaklar/Ses Mikseri/Geçişler/Denetimler · durum çubuğu | VAR | tp | `dockDuzeni.ts` varsayılan sıra |
| Önizleme altında kaynak araç çubuğu | KISMİ | tp | Medya (oynat/duraklat/baştan/durdur/konum), Özellikler, Filtreler. OBS'teki metin/aygıt seçimi kısayolları yok |
| Dock sürükle-bırak, sekmeleme, kilitleme, düzeni sıfırla, kalıcılık | VAR | vt:dockDuzeni, tp | |
| Dock'u ayrı pencereye çıkarma | KISMİ | — | Mikser, Sahneler, Hedefler, İstatistik, Sohbet, Etkinlik, Deste; Kaynaklar/Geçişler/Denetimler çıkarılamaz |
| Özel tarayıcı dock'u | YOK | | |
| Dock düzeni profil başına | YOK | | Düzen tek (yerel depolama) |
| Ek docklar: İstatistikler, Sohbet, Etkinlik, Çoklu çıkış (Hedefler), Deste | VAR | tp | Backtrack ve Günlük dock yok (Günlük pencere olarak var) |
| Tam ekran arayüz, pencere konumu kalıcılığı, karışık DPI | KISMİ | — | Tauri pencere durumu; tam ekran arayüz kipi yok; karışık DPI sınanmadı (UNVERIFIED) |

## 4.2 Menü ağacı

| Madde | Durum | Test | Not |
|---|---|---|---|
| Dosya › Kayıtları göster | VAR | — | Gezgin'i açar; yalnız yerel (sınamada pencere açılmaması için çalıştırılmadı) |
| Dosya › Yeniden muxla | VAR | sinama, it:remux_kuyrugu_mkv_mp4, tp | Kurulu OBS'in FFmpeg 8 kitaplıkları; MP4/MOV/MKV |
| Dosya › Ekran görüntüsü (Çıkış / Önizleme) | VAR | sinama, it:motor_ekran_goruntusu_… , tp | Tuvalin tam çözünürlüğü, kayıt klasörüne |
| Dosya › Ayarlar, Ayarlar klasörünü göster, Her zaman üstte | VAR | tp | |
| Dosya › Profil klasörünü göster | VAR | — | Gezgin'de açar (yalnız yerel) |
| Dosya › Çıkış | YOK | | Uygulama penceresinden kapatılır |
| Düzen › Geri al/Yinele (açıklamalı) | VAR | vt | "Geri al: «X» taşı" |
| Düzen › Kopyala / Yapıştır (başvuru) / Yapıştır (kopya) / Filtreleri kopyala-yapıştır | VAR | it:motor_filtre_yapistir_ve_gunluk, tp | |
| Düzen › Dönüşüm alt menüsü (düzenle, kopyala, yapıştır, sıfırla, 90°/180°, çevir, sığdır, yay, ortala) | VAR | tp | Alt menü yerine düz liste |
| Düzen › Sıra | VAR | — | Yukarı/aşağı/en üst/en alt (Düzen ve bağlam menüsünde) |
| Düzen › Önizlemeyi kilitle | VAR | tp | |
| Düzen › Önizleme ölçekleme (Pencereye sığdır / Tuval %100) | VAR | vt:onizlemeOlcek, tp | Görünüm menüsünde; "Çıkış (ölçeklenmiş)" seçeneği yok |
| Düzen › Gelişmiş ses özellikleri | VAR | tp | |
| Görünüm › Studio Mode, tuval seçimi, projektörler, durum çubuğu, güvenli alan kılavuzları | VAR | tp | |
| Görünüm › Multiview (pencere) | VAR | sinama, it, tp | Tek düzen (üstte önizleme/program, altta 8 sahne) |
| Görünüm › Önizleme yakınlaştırma (Ctrl+tekerlek, Ctrl+0) | VAR | vt, tp | |
| Görünüm › Tam ekran arayüz (F11) | VAR | — | Yalnız masaüstü uygulamasında (Tauri penceresi); tarayıcı bölmesinde sınanamaz |
| Görünüm › Kaynak simgeleri | YOK | | |
| Docklar › onay kutuları, kilitle, sekme birleştir/ayır, düzeni sıfırla, ayrı pencere | VAR | tp | Özel tarayıcı dock'u yok |
| Profil › liste, Yeni, Çoğalt, Yeniden adlandır, Kaldır (yedeğe), Dışa aktar, İçe aktar | VAR | it:motor_profil_… | Dışa aktarımda sır yok; içe aktarım yeni kimlikle eklenir |
| Sahne Koleksiyonu › liste, Yeni, yönetici (çoğalt, adlandır, içe/dışa aktar, OBS JSON'dan al) | VAR | it:motor_v2_…, vt | Eşlenemeyen kaynak "eksik" yer tutucu olur |
| Sahne Koleksiyonu › Eksik dosyaları denetle | VAR | it:motor_eksik_dosyalar_ara_ve_duzelt, tp | Medya, görsel, slayt, yerel tarayıcı sayfası; satır başına yeni yol, "Klasörde ara" |
| Araçlar › Otomatik yapılandırma sihirbazı, Çıkış zamanlayıcısı | VAR | it:motor_sihirbaz_…, vt:cikisZamanlayicisi | Bant genişliği testi izinsiz yapılmaz (yok) |
| Araçlar › WebSocket sunucu ayarları | VAR | it:obs_websocket_uyumlu_sunucu | Yayın Ayarları › Uzaktan denetim; 127.0.0.1 |
| Araçlar › Betikler | DESTEKLENMİYOR | | OBS betik altyapısı (obs-scripting, Lua/Python) ön yüze bağlı; yerine Kontrol Merkezi otomasyonu |
| Araçlar › Altyazı | YOK | | |
| Araçlar › Sanal kamera ayarları | KISMİ | sinama, it:motor_kayit_…_sanal_kamera | Hedef: Program / Önizleme (Studio Mode) / Sahne (Denetimler dock'u dişlisi); tek kaynak hedefi yok (kaynak kendi boyutunda olduğundan kamera çözünürlüğü tutarsız olurdu); arayüz tarayıcıda görülmedi |
| Yardım › Son günlüğü görüntüle, Günlük klasörü, Hakkında (sürüm, lisanslar) | VAR | it, tp | Günlük sırları ayıklanmış |
| Yardım › Çökme raporları | VAR | it:motor_filtre_yapistir_ve_gunluk | Panelin çökme günlüğü, sırlar ayıklanmış; dışarı gönderilmez |
| Yardım › Güncellemeleri denetle | YOK | | Ağ isteği kullanıcı izni gerektirir |
| Güvenli kipte başlat | VAR | it:eklenti_yoneticisi_… | Motor başlangıç ekranında |

## 4.3 Sahneler dock'u

| Madde | Durum | Test | Not |
|---|---|---|---|
| Liste, sürükle-bırak sıra, +/−, filtreler, yukarı/aşağı | VAR | it:motor_v2_…, tp | Izgara görünümü yok |
| Studio Mode'da tıklama önizlemeye alır | VAR | tp | |
| Bağlam: Çoğalt, Yeniden adlandır (F2), Kaldır (Del), Sıra, Filtreler, Geçişi geçersiz kıl | VAR | it, tp | |
| Bağlam: Ekran görüntüsü | VAR | sinama, it, tp | |
| Bağlam: Projektör (pencere) | VAR | sinama, it | Sahne tuval boyutunda; tam ekran sahne projektörü yok |
| Bağlam: Multiview'da göster | YOK | | |
| Sahne başına kısayol | VAR | it:motor_kisayol_eylemleri_… | Kısayollar sayfası |

## 4.4 Kaynaklar dock'u

| Madde | Durum | Test | Not |
|---|---|---|---|
| Göz, kilit, çoklu seçim, sürükle sıra, iç içe gruplar, filtre göstergesi, çift tıkla özellikler | VAR | vt:sahneAgaci, tp | |
| Alt çubuk +, −, özellikler, filtreler, yukarı/aşağı | VAR | tp | |
| Kaynak ekle (türler motordan, eklenti türleri) | VAR | it:motor_api_sentetik_…, it:eklenti_… | |
| Bağlam: Kopyala/Yapıştır, Filtreleri kopyala/yapıştır, Yeniden adlandır, Kaldır, Sıra, Dönüşüm, Grupla/Çöz | VAR | it, tp | |
| Bağlam: Ölçek filtresi, Karıştırma modu | VAR | sinama | Dönüşüm diyaloğunda |
| Bağlam: Karıştırma yöntemi (Varsayılan / sRGB kapalı) | VAR | sinama, it | Dönüşüm diyaloğunda |
| Bağlam: Deinterlace (kip + alan sırası) | VAR | sinama, it, tp | Görsel etkisi yalnız geçmeli kaynakta (UNVERIFIED: gerçek yakalama kartı yok) |
| Bağlam: Gösterme/Gizleme geçişi | VAR | sinama, it | |
| Bağlam: Kaynak ekran görüntüsü | VAR | sinama, it | |
| Bağlam: Etkileşim | VAR | sinama, tp | Tarayıcı kaynağı |
| Bağlam: Kaynak rengi (etiket) | VAR | it, tp | 8 hazır renk + özel + yok; listede satırın solunda şerit |
| Bağlam: Kaynak projektörü | VAR | sinama, it, tp | Kaynak kendi boyutunda, pencere kapanınca motor tuvali bırakılır |
| Bağlam: Multiview'da göster | YOK | | |

## 4.5 Önizleme etkileşimi

| Madde | Durum | Test | Not |
|---|---|---|---|
| Seçim + 8 tutamaç, taşı, ölçekle (Shift serbest), Alt kırp, Ctrl yapışma kapalı | VAR | vt:sahneAgaci, tp | |
| Ok 1 px / Shift+ok 10 px, kenar/merkez yapışması, güvenli alan kılavuzları | VAR | vt, tp | Yapışma eşiği sabit (ayar yok) |
| Döndürme tutamacı | VAR | vt:sahneAgaci, tp | Merkez etrafında (konum telafisiyle), Shift ile 15° adımlar, geri alınabilir; sınamada 90° → merkez aynı piksel |
| Boşluk yardımcıları (mesafe çizgileri) | VAR | vt:sahneAgaci, tp | Tek öğe taşınırken tuval kenarlarına (px); kaynaklar arası mesafe yok |
| Önizleme yakınlaştırma/kaydırma | VAR | vt:onizlemeOlcek, tp | Ctrl+tekerlek 1,25 kat (×0,25–×8), orta tuşla sürükleyerek kaydır, kaydırma çubukları; %100'de seçim isabeti doğrulandı |
| Önizlemeyi devre dışı bırak | VAR | tp | Kare aboneliği kesilir (motor önizleme dönüştürmez); ses ölçerleri sürer |
| Dönüşüm penceresi (konum, açı, boyut, 9 nokta hizalama, sınır türü + hizalama, kırpma) | VAR | tp | "Kırpmayı sınıra uygula" yok |

## 4.6 Ses mikseri

| Madde | Durum | Test | Not |
|---|---|---|---|
| Kanal: ad, dB fader, tepe+RMS ölçer, tepe tutma, sessiz, izleme, dişli menüsü | VAR | sinama (ölçer), tp | |
| Bağlam: Gizle, Filtreler, Özellikler, Gelişmiş ses, izleme türü, izler | VAR | tp | |
| Yüzde olarak göster | VAR | vt:sesMatematik | Kanal bağlam menüsünden; tercih yerel |
| Dikey düzen | VAR | tp | Başlıktaki düğmeyle; tercih yerel |
| Ölçer tipi (true peak), düşüş hızı, kilitle | YOK | | |
| Gelişmiş Ses Özellikleri tablosu (ses, mono, denge, senkron, izleme, İz 1–6, yalnız etkin kaynaklar) | VAR | sinama, it | |
| Bas-konuş / bas-sustur | VAR | it:motor_kisayol_eylemleri_bas_konus_ve_sahne | Gecikme ms ayarı yok |
| Solo | YOK | | |

## 4.7 Sahne geçişleri dock'u

| Madde | Durum | Test | Not |
|---|---|---|---|
| Tür listesi, süre, özellikler (dişli) | VAR | sinama, it | Türler çalışma anında libobs'tan |
| Kes, Soldur, Kaydır, İt, Rengi soldur, Luma, Stinger | VAR | sinama (tür listesi) | Stinger/Luma ayarları genel özellik formuyla |
| Birden çok adlandırılmış geçiş (+/−, yeniden adlandır, özellikler) | VAR | it:motor_ekran_…_tbar, tp | Yerleşik Kes/Soldur silinemez; ayarlar geçişle saklanır; OBS'ten `transitions` listesi aktarılır |
| Hareket (Move) geçişi | DESTEKLENMİYOR | | Üçüncü taraf eklenti; kuruluysa tür listesinde görünür |
| Sahne başına geçiş geçersiz kılma | VAR | it:motor_v2_… | |

## 4.8 Denetimler dock'u

| Madde | Durum | Test | Not |
|---|---|---|---|
| Yayını başlat/durdur (ön kontrol modalı, tümü/tek hedef) | VAR | it:motor_api_sentetik_kaynak_ve_hedef | Yalnız 127.0.0.1 alıcılarıyla sınandı |
| Kaydı başlat + Duraklat + Böl | VAR | sinama, it:motor_kayit_duraklat_bol_… | Duraklat, kodlayıcı paylaşılıyorsa reddedilir (ayrı kodlayıcı seçeneği) |
| Tekrar arabelleği + Kaydet | VAR | sinama, it | |
| Sanal kamera başlat | VAR | sinama, it | OBS sanal kamera sürücüsü gerekir |
| Studio Mode, Ayarlar | VAR | tp | |
| Backtrack | KISMİ | sinama, it:motor_kayit_…_dikey_tekrar | Tekrar arabelleği yatay ve (profilde açılırsa) dikey tuvalde; klip listesi ve kırpma yok |

## 4.9 Studio Mode

| Madde | Durum | Test | Not |
|---|---|---|---|
| Önizleme · geçiş sütunu · Program, Geçiş / Kes | VAR | sinama, it, tp | Önizleme ayrı özel tuvalde (programı etkilemez) |
| Takas (swap) | VAR | sinama, it | Düğme olarak |
| T-bar (sürükle; uçta tamamla/geri al, ortada kalır) | VAR | sinama, it, vt:tbar, tp | Sabit geçişlerde (Kes/Stinger) reddedilir |
| Hızlı geçiş düğmeleri | VAR | it, vt:HizliGecisler, tp | Geçiş süresince tuvalin geçişi geçici değişir, bitince geri kurulur (OBS'te ayrı geçiş kaynağı kullanılır; görünür sonuç aynı) |
| Sahneyi çoğalt seçeneği, canlı düzenleme uyarısı, dikey düzen | YOK | | |

## 4.10 Durum çubuğu

| Madde | Durum | Test | Not |
|---|---|---|---|
| Canlı süre, kayıt süresi (duraklatıldı), CPU %, GPU %, FPS, kb/s | VAR | tp | GPU Windows performans sayaçlarından |
| Ağdan düşen kare (sayı + %) | VAR | — | Etkin yayın hedeflerinin toplamı |
| Geciken/atlanan kare | VAR | tp | |
| Sağlık karesi rengi, hedef başına tablo | KISMİ | — | Hedefler dock'unda hedef başına durum |

## 4.11 Ayarlar penceresi

Satır satır: `docs/OBS_SETTINGS_PARITY_MATRIX.md`. Özet: Video (taban/çıkış/ölçek filtresi/FPS/renk biçimi-uzayı-aralığı),
Ses (örnekleme, kanallar), Çıkış (kodlayıcı, ayrı kayıt kodlayıcısı, bölme süre/boyut, kayıt biçimi), Gelişmiş ağ
(IP'ye bağla, yeni ağ kodu, dinamik bit hızı, yeniden bağlanma), Uzaktan denetim (obs-websocket uyumlu), Kısayollar
VAR; Erişilebilirlik (seçim kutusu + ölçer renkleri, renk körlüğü ve yüksek kontrast hazırları; vt:erisilebilirlik, tp) VAR; Genel sayfasındaki onay/tepsi seçenekleri YOK.

## 4.12 Diğer pencereler

| Madde | Durum | Test | Not |
|---|---|---|---|
| Filtreler penceresi (sırala, göz, kopyala/yapıştır) | VAR | sinama, it | Ses/video iki ayrı liste yerine tek liste + tür etiketi |
| Özellikler penceresi (genel özellik formu, Varsayılanlar) | VAR | it | Varsayılanlar onayla; parolalar Kimlik Yöneticisinde korunur ve yeniden uygulanır |
| Projektörler (pencere, tam ekran monitör, sahne, kaynak) | VAR | sinama, it, tp | Sahne/kaynak projektörü yalnız pencere |
| Multiview | VAR | sinama, it, tp | Tek düzen |
| İstatistikler | KISMİ | vt:kayitSuresi, tp | Disk boş alanı ve kalan kayıt süresi VAR (sınamada 40,8 GB / 5256 kbps → 18 sa 32 dk); "sıfırla" yok |
| Otomatik yapılandırma sihirbazı | VAR | it:motor_sihirbaz_yerel_kodlama_sinamasi | Bant genişliği testi yok (izin gerektirir) |
| Remux penceresi | VAR | it, tp | |
| Eksik dosyalar penceresi | VAR | it, tp | Yeni yol mutlak ve diskte olmalı; eksik eklentili kaynakta yalnız kayıt güncellenir |
| Günlük görüntüleyici, çökme sonrası güvenli kip, çıkış zamanlayıcısı | VAR | it, vt | |
| Betikler penceresi | DESTEKLENMİYOR | | Bkz. Araçlar › Betikler |

## 4.13 SE.Live işlev paritesi

| Madde | Durum | Test | Not |
|---|---|---|---|
| Çoklu yayın kartları, hedef başına tuval/kodlayıcı/ses izi, tek başına başlat/durdur, durum | VAR | sinama, it:multistream_… | Yalnız 127.0.0.1 alıcılarıyla sınandı; gerçek platform UNVERIFIED |
| Yayın öncesi kontrol (GO LIVE) | VAR | it | |
| Yayın bilgisi dock'u (başlık/kategori, platform API'si) | YOK | | Platform OAuth'u gerektirir |
| Çoklu tuval (yatay + dikey) | KISMİ | sinama | İki sabit tuval; sınırsız tuval ve bağlı sahneler yok |
| Backtrack | KISMİ | it | Tuval başına tekrar arabelleği (yatay + dikey); klip listesi/hızlı kırpma yok |
| Birleşik sohbet + etkinlik dock'u | VAR | — | Mevcut StreamAxT/chatHub altyapısı |
| Twitch Enhanced Broadcasting | DESTEKLENMİYOR | | Platform onayı/API gerektirir; arayüzde gösterilmez |
