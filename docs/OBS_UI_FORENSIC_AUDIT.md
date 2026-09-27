# OBS arayüz ve iş akışı denetimi — başlangıç boşluk analizi

> Tarih: 2026-09-26 (uygulama öncesi, etiket `pre-obs-parity-20260926-155652`). Referans: OBS 32.2.2
> ([OBS_CURRENT_VERSION_AUDIT](OBS_CURRENT_VERSION_AUDIT.md)), [OBS_COMPLETE_FEATURE_INVENTORY](OBS_COMPLETE_FEATURE_INVENTORY.md).
> Durum sözlüğü: EXISTING / PARTIAL / MISSING. Son durum uygulama sonunda [OBS_FUNCTIONAL_PARITY_SPEC](OBS_FUNCTIONAL_PARITY_SPEC.md)'te.

## OBS'in bilgi mimarisi (bağımsız gözlem, kopya değil)

- Ana pencere: menü çubuğu; ortada önizleme (Studio Mode'da Önizleme | Geçiş düğmeleri | Program); altta docklar
  **Sahneler · Kaynaklar · Ses Mikseri · Sahne Geçişleri · Denetimler**; en altta durum çubuğu (canlı/kayıt süresi,
  CPU, FPS, düşen kare, bit hızı).
- Docklar taşınabilir, sekmelenebilir, pencereye çıkarılabilir; "Docklar" menüsünden göster/gizle ve düzeni sıfırla.
- Sahne = kaynak öğelerinin sıralı listesi; kaynak küresel (aynı kaynak birden çok sahnede). Sahne koleksiyonu =
  sahneler + kaynaklar; profil = çıkış/video/ses/yayın ayarları (ikisi karıştırılmaz).
- Kaynak bağlam menüsü: Özellikler, Filtreler, Dönüşüm, Sıra, Grupla, Kopyala/Yapıştır, Yeniden adlandır, Kaldır,
  Etkileşim, Projektör, Kare kaydet… Ayarlar: Genel, Yayın, Çıkış (Basit/Gelişmiş), Ses, Video, Kısayollar,
  Erişilebilirlik, Gelişmiş.

## Başlangıç durumu (bizim uygulama)

| İstem § | Konu | Durum | Not |
|---|---|---|---|
| 1 | Lisans kapısı | EXISTING | ADR-003 + [ADR-004](OBS_LICENSE_ARCHITECTURE_DECISION.md) |
| 2 | Güncel sürüm referansı | EXISTING | 32.2.2 = kurulu = güncel |
| 3, 58 | OBS'e tanıdık ana yerleşim | PARTIAL | Yayın sekmesi: sol tuval+kaynak, orta önizleme, sağ özellikler, alt mikser+hedefler; OBS alt dock düzeni yok |
| 4 | Menü sistemi | MISSING | Yalnız bağlam menüleri |
| 5 | Sahneler paneli | MISSING | Tuval başına tek sahne (`sahne-ana`/`sahne-dikey`); motorda çoklu sahne API'si var |
| 6 | Sahne koleksiyonları | PARTIAL | Tek sürümlü koleksiyon dosyası (v1), eksik eklenti yer tutucusu var; çoklu koleksiyon yok |
| 7, 18 | Kaynaklar paneli + bağlam menüsü | PARTIAL | Göz, sıra (üst/alt/yukarı/aşağı), kaldır, özellik; kilit/grup/kopyala/çoğalt/yeniden adlandır yok |
| 8 | Kaynak ekle | PARTIAL | renk, yazı, görsel, medya, ekran, pencere, oyun, kamera, mikrofon, masaüstü; uygulama sesi, tarayıcı, slayt, sahne kaynağı, grup, eklenti türleri yok |
| 9–11 | Kaynak + uygulama sesi, çift ses uyarısı, her ses kaynağı mikserde | MISSING | |
| 12–15 | Profesyonel mikser, karışımlar, Gelişmiş Ses Özellikleri, ses filtreleri | PARTIAL | İz 1–6 atama var; fader, ölçer, solo, denge, senkron, izleme, filtre yok |
| 16 | Dönüşüm | PARTIAL | Konum ve sınır kutusu (px); döndürme, kırpma, hizalama, çevirme, kopyala/yapıştır yok |
| 17 | Önizleme etkileşimi | MISSING | PNG anlık görüntü (salt görüntü) |
| 19–20 | Geçişler, Studio Mode | MISSING | |
| 21–24 | Kısayollar (OBS tarzı), sahne/kaynak kısayolu, çakışma | PARTIAL | OBS-websocket tarafı için güçlü (çakışma, küresel); motor sahnesi/kaynağı için kayıt defteri eylemleri var; bas-konuş yok |
| 25–29 | Çıkış Basit/Gelişmiş/Uzman, donanım algılama | PARTIAL | Motor NVENC/x264 otomatik seçer, kodlayıcı listesi çalışma anından; ayar ekranı yok |
| 30–33, 38–39 | Çoklu yayın ayarları, platform kartı, hedef başına anahtar, göster/kopyala | PARTIAL | Hedefler + anahtar Kimlik Yöneticisinde; kart/göster/kopyala yok |
| 34–37 | Güvenli anahtar saklama, SecretStore, izolasyon | PARTIAL | `secret_store.rs` (keyring windows-native); arayüz belgesi ve has/replace yok |
| 40–42 | GO LIVE ön kontrol, bağımsız hedef denetimi, durumlar | PARTIAL | Motor GO LIVE + ön kontrol bulguları; modal ve §42 durum adları yok |
| 43–44 | Kodlama paylaşımı / çoklu kodlama | PARTIAL | Tuval başına tek kodlayıcı paylaşılıyor; hedef başına farklı profil yok |
| 45–46 | Ayar paritesi, profil modeli | MISSING | |
| 47–53 | Eklenti uyumluluğu, kurulum, durumlar, güvenli kip, yer tutucu | PARTIAL | Çözümleyici/yoklama/kayıt defteri (5450259); API + arayüz + motor bağlantısı yok |
| 54–57 | Görsel hedef, OBS varlığı kopyalanmaz, genel pano değil | PARTIAL | `dt-*` sistemi var; parlama/kart temizliği başladı |
| 59–61 | Ek docklar, dock kalıcılığı, çoklu monitör | MISSING | |
| 62–69 | Sinyal yolu, izleme, uygulama eşleşmesi, yeniden bağlanma, kaynak durumu, tarayıcı/medya/kart sesi | MISSING | |
| 70–72 | Platform önerileri, Uzman kip saygısı, otomatik yapılandırma | PARTIAL | Politika tablosu + ön kontrol var |
| 73–78 | Kabul sınamaları | — | Uygulama sonunda |
| 80 | Belgeler | PARTIAL | Bu tur yazılıyor |
