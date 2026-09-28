# Çoklu yayın hedef modeli

## Nesneler

| Nesne | Nerede | Alanlar |
|---|---|---|
| Hedef yapılandırması | panel ayarı `multistream.destinations` | kimlik, ad, platform (Twitch/YouTube/Kick/Özel RTMP), sunucu (anahtarsız), etkin |
| Anahtar | Kimlik Yöneticisi | `secure://<platform>/<hedef>/stream-key` ([SECRET_STORAGE_ARCHITECTURE](SECRET_STORAGE_ARCHITECTURE.md)) |
| Hedef ataması | etkin **profil** `hedefler.<kimlik>` | tuval (yatay/dikey), ses izi (adlandırılmış karışım), isteğe bağlı bit hızı |

Aynı hedef iki yoldan yayınlanabilir: **motor** (kendi libobs çekirdeğimiz, varsayılan) ya da eski **FFmpeg
yönlendiricisi** (OBS'ten alınan akışı çoğaltır). İki yol aynı anda aynı hedefe bağlanamaz (409).

## Kodlama

- Video kodlayıcı kimliği `v-<tuval>` (tuvalin profildeki bit hızı) ya da hedefe özel bit hızında `v-<tuval>-<kbps>`.
  Aynı kimliği isteyen hedefler kodlayıcıyı **paylaşır**; bu yüzden N hedef ≠ N kodlama.
- Ses: iz başına bir AAC kodlayıcı (`ses-<iz>`), profildeki ses bit hızıyla.
- Profil çıkış ayarı değişince boştaki çıktı ve kodlayıcılar bırakılır; yayındaki hedef yeni ayarı durup yeniden
  başlayınca alır.

## Durumlar (motor çıktısı)

`hazir → baglaniyor → canli → (yeniden_baglaniyor ↔ canli) → durduruluyor → durduruldu`, hata `basarisiz`
(kod ile). Yeniden bağlanma: 10 deneme, 2 sn. Her hedef bağımsızdır: biri durur/başarısız olursa diğerleri sürer
(motor `sinama`: B durdu, A ve C canlı kaldı; kapalı porttaki D başarısız, diğerleri etkilenmedi).

## Denetimler

- **GO LIVE**: ön kontrol penceresi (hedefler, tuval, iz, platform kuralları bulguları; "engel" varsa başlatılamaz) →
  etkin + anahtarlı her hedef; kısmi başarı raporlanır. Yayın yalnız bu açık eylemle başlar.
- Hedef başına başlat/durdur (Hedefler dock'u, menü, eylem kayıt defteri, kısayol).
- **Sına**: yalnız sunucuya TCP bağlantısı (yayın gönderilmez, anahtar doğrulanmaz).
- Platform sınırları: yalnız doğrulanmış olanlar (Kick ≤ 8000 kbps; YouTube anahtar kare ≤ 4 sn; kaynak + tarih);
  Uzman kipte ayar kendiliğinden değiştirilmez, uyarı gösterilir.

## Doğrulama

Motor `sinama` (dört yerel alıcı, bağımsız durdurma/yeniden başlatma, iz ayrımı, dikey tuval), entegrasyon
`motor_api_sentetik_kaynak_ve_hedef`, `motor_profil_kodlama_paylasimi_ve_kayit`. Gerçek platforma yayın **yapılmadı**
(UNVERIFIED).
