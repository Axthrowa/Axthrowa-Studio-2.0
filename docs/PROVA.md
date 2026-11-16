# Gerçek ortam provası

Plan 3, F0-5. Bu satırları yalnız yayıncı kapatabilir: gerçek hesap, telefon ya da müzik çalma gerekir.
Her satır "geçti" ya da hata kaydıyla kapanır; çıkan hata Faz 0'ın başına eklenir.
Sürüm notu (TEK-7) bu tablonun **Durum** sütununu okur: `geçti` dışındaki her satır "gerçek ortamda sınanmadı" sayılır.

Son güncelleme: 2026-11-16

| # | İş | Gerekenler | Geçti sayılır | Durum | Not |
| --- | --- | --- | --- | --- | --- |
| D3 | Shared Chat ve "ilk kez" rozetleri | Gerçek Twitch sohbeti | `source-room-id` ve `first-msg` etiketleri rozet üretir | bekliyor | |
| D4 | Şablonu tüm platformlara uygula | Gerçek Kick, Twitch, YouTube kanalı | Başlık ve kategori üçünde de değişir; eşleşmeyen kategori nedeni yazılır | bekliyor | |
| D5 | Ceza merdiveni, eylemi yapan hesap | Kick ve Twitch, test hesabı | Üçüncü tekrar 60 sn susturur; bot hesabı seçiliyken eylemi bot yapar | bekliyor | |
| D6 | Kick kanal ödülleri | Kick'e yeniden bağlan (yeni kapsam), bir ödül aç ve kullan | Ödül Kick'te görünür; kullanım otomasyon tetiğine düşer; `reward_title`, `username`, `user_input` doğrulanır | bekliyor | |
| D7 | Kalkan Twitch modlarını açar | Gerçek Twitch kanalı | Açılınca takipçi modu açılır, kapanınca yalnız kalkanın açtığı kapanır | bekliyor | |
| D8 | Kick resmi uçları | Gerçek Kick hesabı | Yayın durumu ve ban hedef kimliği resmi uçtan gelir | bekliyor | |
| D12 | Müzik eylemleri, Beğen, listeye ekle | Spotify yeniden bağlanır (yeni izin), YouTube Music | Deste tuşu parçayı seçili listeye ekler | bekliyor | |
| D13 | SMTC | Apple Music, Tidal ya da VLC | Parça 2 sn içinde katmanda görünür | bekliyor | |
| D14 | QR ile eşleştirme | Aynı ağdaki telefon | QR okutulur, cihaz listede görünür, iptal edilince 401 alır | bekliyor | |
| D15 | İmzalı paket | `build-release-signed.ps1 -Surum` temiz makinede | Paket imzalanır, Defender taraması geçer, kurulum açılır | bekliyor | |
| D16 | SE ve Fossabot içe aktarma | Gerçek dışa aktarım dosyaları | Komut ve zamanlayıcılar eksiksiz gelir | bekliyor | Dosya hesaba giriş ister |
| F0-1 | Bölüm hata sınırı | Başsız Studio, sunucu `/api/*` için 503 döndürür | Menü ve diğer kutular çalışır; yalnız ilgili kutu "yüklenemedi" gösterir | bekliyor | Birim testi var (`HataSiniri.test.tsx`) |
| F0-3 | Yazı tipleri pakette | İnternet kapalı, OBS tarayıcı kaynakları açık | Katmanlar seçili yazı tipiyle çizilir; ağ sekmesinde `fonts.googleapis.com` yok | bekliyor | |
| F0-4 | Emote önbelleği, çekiliş yoklaması | OBS'te sohbet ve çekiliş katmanı | Katman BTTV/FFZ'ye istek atmaz; çekiliş katmanında zamanlanmış istek yok | bekliyor | |
