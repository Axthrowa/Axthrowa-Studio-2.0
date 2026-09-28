# Masaüstü etkileşim kuralları (yayın çalışma alanı)

1. **Her eylemin klavye yolu vardır.** Menü çubuğu (←/→/↑/↓/Enter/Esc), bağlam menüsü (Menü tuşu, Shift+F10),
   listelerde ↑/↓, Del, F2, Enter; Ctrl+K komut paleti her menü eylemine ve sahneye ulaşır.
2. **Sağ tık her nesnede anlamlıdır** (sahne, kaynak, önizlemedeki öğe, boş alan, mikser kanalı, filtre).
3. **Yıkıcı eylem onay ister, geri alınabilir olan istemez.** Dönüşüm, görünürlük, kilit, sıra, ad, öğe kaldırma
   Ctrl+Z ile geri alınır; kaynak/sahne/koleksiyon silme onaylıdır ve koleksiyon/profil silme yedeğe taşır.
4. **Yayını ve kaydı yalnız kullanıcı başlatır.** GO LIVE ön kontrol penceresinden geçer; "yayını bitir" onay ister.
5. **Değişiklik anında uygulanır, durum görünür** ("Uygulandı", bekleyen ayar notu, toast).
6. **Doğru sayı, doğru birim**: dB, kbps, ms, px; aralık dışı değer reddedilir ve eski değer geri gelir.
7. **Sır görünmez**: anahtar maskeli, "Göster" 20 sn, kopya 30 sn sonra panodan silinir ([SECRET_STORAGE_ARCHITECTURE](SECRET_STORAGE_ARCHITECTURE.md)).
8. **Dürüst durum**: desteklenmeyen/ölçülmeyen şey "yok/ölçülemiyor" yazılır (GPU sayacı yoksa, etkileşimsiz kaynakta Etkileşim, platform bant
   genişliği); eksik eklenti yer tutucusu ayarlarını korur.
9. **Renk yalnız anlam taşır** (CANLI kırmızı, KAYIT turuncu, uyarı sarı, hazır yeşil); kart/gradyan/parlama yok;
   tek simge ailesi (lucide). Metin kontrastı tema sözleşmesi testiyle korunur.
10. **Arka planda sessiz**: motor penceresiz, CEF/yardımcı süreçler motorla kapanır, hata penceresi açılmaz
    (kullanıcı tam ekran oyunda olabilir).
