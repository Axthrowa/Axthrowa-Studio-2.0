# OBS ayar paritesi matrisi

> OBS 32.2.2 "Ayarlar" sekmeleri ↔ bu uygulamanın **Yayın ayarları** penceresi (Dosya › Yayın ayarları, Denetimler
> › Ayarlar; aranabilir) ve profil (`motor/profiller/<id>.json`). Durum: EŞDEĞER · FARKLI (bilinçli) · YOK.

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
| Ses: örnekleme, kanallar | — | YOK | Motor 48 kHz stereo sabit |
| Ses: global aygıtlar (masaüstü/mikrofon) | Kaynak olarak eklenir | FARKLI | OBS'in "global ses" aygıtları yerine açık kaynaklar |
| Ses: izleme aygıtı | Ses › İzleme aygıtı | EŞDEĞER | |
| Ses: iz adları | Ses › Karışım adları | EŞDEĞER+ | Hedef ve kayıt seçiminde görünür |
| Video: taban/çıkış çözünürlüğü | Video › tuvaller | FARKLI | Yatay 1920×1080 ve dikey 1080×1920 sabit |
| Video: FPS | Video › Kare hızı 30/60 | EŞDEĞER | Motor çalışırken değişmez (video sıfırlama gerekir) |
| Video: ölçek filtresi | Öğe başına (Dönüşüm) | FARKLI | |
| Kısayollar | Kısayollar sayfası (eylem kayıt defteri) | EŞDEĞER | [OBS_HOTKEY_PARITY_MATRIX](OBS_HOTKEY_PARITY_MATRIX.md) |
| Erişilebilirlik (renkler) | Tasarım sistemi token'ları | FARKLI | |
| Gelişmiş: renk biçimi/alanı | — | YOK | NV12 / Rec.709 kısmi sabit |
| Gelişmiş: yeniden bağlanma | Motor çıktısı: 10 deneme, 2 sn | FARKLI | Ayar olarak açılmadı |
| Gelişmiş: ağ (IP bağlama) | — | YOK | |
| Profil yönetimi | Profil menüsü | EŞDEĞER | Yeni/çoğalt/adlandır/geç (boştaysa motoru yeniden başlatır)/sil(yedeğe)/dışa aktar |
| Otomatik yapılandırma sihirbazı | Araçlar › sihirbaz | FARKLI | Yerel kodlama sınaması; platform bant genişliği sınaması yapılmaz |
