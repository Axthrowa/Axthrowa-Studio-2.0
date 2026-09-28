# OBS ayar paritesi matrisi

> OBS 32.2.2 "Ayarlar" sekmeleri ↔ bu uygulamanın **Yayın ayarları** penceresi (Dosya › Yayın ayarları, Denetimler
> › Ayarlar; aranabilir) ve profil (`motor/profiller/<id>.json`). Durum: EŞDEĞER · FARKLI (bilinçli) · YOK.
> Son güncelleme: 2026-09-28 (ikinci tur: Video/Ses/Gelişmiş ayarları).

| OBS sekmesi / ayar | Bizde | Durum | Not |
|---|---|---|---|
| Genel: dil, tema, onaylar | Uygulama ayarları (panel) | FARKLI | Yayın motoru libobs'u `tr-TR` ile başlatır (OBS'in kendi çevirileri) |
| Yayın: servis, sunucu, anahtar | Çoklu yayın › platform kartı | EŞDEĞER+ | Hedef başına anahtar (Kimlik Yöneticisi), göster/kopyala/sil, TCP sınaması |
| Çıkış kipi Basit/Gelişmiş | Çıkış › Kip Basit/Gelişmiş/Uzman | EŞDEĞER | Uzman: kodlayıcının kendi özellik formu |
| Video kodlayıcı | Çıkış › Video kodlayıcı | EŞDEĞER | Yalnız kurulu OBS'te gerçekten kayıtlı kodlayıcılar; "Otomatik" NVENC varsa o |
| Bit hızı, anahtar kare, önayar | Çıkış › bit hızı (yatay/dikey), anahtar kare; önayar Uzman'da | EŞDEĞER | Hedefe özel bit hızı + kodlama paylaşımı |
| Ses bit hızı | Çıkış › Ses bit hızı | EŞDEĞER | |
| Kayıt yolu, biçimi | Kayıt › Klasör, Biçim | EŞDEĞER | mkv, mp4, mov, parçalı mp4/mov, hibrit MP4 (kurulu sürümde varsa) |
| Kayıt izleri (Gelişmiş) | Kayıt › Ses izleri | EŞDEĞER | Çok izli kayıt sınandı (2 iz, hibrit MP4) |
| Tekrar arabelleği süresi | Tekrar arabelleği › Süre | EŞDEĞER | 5–600 sn |
| Ses: örnekleme, kanallar | Ses › Örnekleme hızı (44,1/48 kHz), Kanallar (mono…7.1) | EŞDEĞER | Motor yeniden başlayınca; `sinama`: 44,1 kHz mono kayıt ffprobe ile doğrulandı |
| Ses: global aygıtlar (masaüstü/mikrofon) | Kaynak olarak eklenir | FARKLI | OBS'in "global ses" aygıtları yerine açık kaynaklar |
| Ses: izleme aygıtı | Ses › İzleme aygıtı | EŞDEĞER | |
| Ses: iz adları | Ses › Karışım adları | EŞDEĞER+ | Hedef ve kayıt seçiminde görünür |
| Video: taban/çıkış çözünürlüğü | Video › Temel ve Çıkış (ölçekli) çözünürlük (hazır + serbest) | EŞDEĞER | `sinama`: 1920×1080 taban → 1280×720 kayıt; dikey tuval boyutu da ayarlanır |
| Video: FPS | Video › Kare hızı (24, 25, 30, 48, 50, 60, 100, 120, 144) | EŞDEĞER | Kesirli FPS (29,97) yok; çıktı yokken motor yeniden başlar |
| Video: ölçek filtresi | Video › Ölçek filtresi (bilinear/bicubic/lanczos/area) + öğe başına | EŞDEĞER | |
| Kısayollar | Kısayollar sayfası (eylem kayıt defteri) | EŞDEĞER | [OBS_HOTKEY_PARITY_MATRIX](OBS_HOTKEY_PARITY_MATRIX.md) |
| Erişilebilirlik (renkler) | Tasarım sistemi token'ları | FARKLI | |
| Gelişmiş: renk biçimi/uzayı/aralığı | Gelişmiş › Video | EŞDEĞER | NV12/I420/I444/P010/I010/BGRA; 601/709/sRGB/2100 PQ/HLG (10 bit zorunlu); HDR çıktısı UNVERIFIED |
| Gelişmiş: yeniden bağlanma | Gelişmiş › Yeniden bağlanma (etkin, aralık, en çok deneme) | EŞDEĞER | Varsayılan OBS'inki (2 sn, 25) |
| Gelişmiş: ağ | Gelişmiş › Ağ: bağlanılacak IP, IP ailesi, dinamik bit hızı, yeni ağ kodu, düşük gecikme | EŞDEĞER | `sinama`: 127.0.0.1'e bağlı, IPv4, düşük gecikme + dinamik bit hızıyla hedef yayınladı |
| Profil yönetimi | Profil menüsü | EŞDEĞER | Yeni/çoğalt/adlandır/geç (boştaysa motoru yeniden başlatır)/sil(yedeğe)/dışa aktar |
| Otomatik yapılandırma sihirbazı | Araçlar › sihirbaz | FARKLI | Yerel kodlama sınaması; platform bant genişliği sınaması yapılmaz |
