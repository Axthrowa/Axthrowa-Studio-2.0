# AxthrowA Studio + AxBoT geliştirme planı (Kasım 2026)

Başlangıç: Studio 1.6.18, AxBoT 1.13.15. Her aşama kendi başına paketlenebilir; sıra, "yayında en çok can yakan" olandan "güzel olur"a doğrudur.

Her işin yanında **Bitti sayılır** ölçütü var: o ölçüt sınanmadan iş kapanmaz.

---

## Kapsamlı plan Faz 1 durumu (12 Kasım, Studio 1.7.0 / AxBoT 1.14.0)

Bu belgenin Aşama 2'si, kapsamlı plandaki (Docs: "Yayın Yönetim Aracı — Kapsamlı Geliştirme Planı") Faz 1'e taşındı.

- U13 güncelleme bildirimi: zaten vardı (`guncelleme_api::acilista_denetle` + `UpdateModal`), sürüm notlarını gösterir, kendiliğinden indirmez.
- T3 paket bölme: ana parça 358 kB (hedef 800 kB altı); sayfalar zaten tembel yükleniyor.
- U2 boş durumlar: OBS kopukken kutular zaten "OBS'e bağlan" düğmesi gösteriyordu; OBS bağlı ama sahne yokken ve olay akışı boşken açıklama eklendi.
- R1 Resonance temizliği: Pro sayfası kaldırıldı, sürüm 1.7.0, Studio teması Müzik sekmesine aynı iletiyle geçer (tarayıcıda doğrulandı).
- B1 sessiz komutlar: `!clip` kapalıyken tek satır yazar; özel komut beklemedeyken "N sn bekle" (genel beklemede komut başına, kişi başı beklemede kişi başına bir kez). Yerleşik komutta "Reddedince sessiz kal", özel komutta "Reddedince sohbete yanıt ver" (`commands.refusal_reply`, göç 12). Test: `ret-yaniti.test.ts`.
- B11 içe aktarma: Nightbot yanında StreamElements ve Fossabot dosyaları tanınır (`disa-aktarim-bicimleri.ts`); `GET /api/integrations/disa-aktar` kendi komut ve zamanlayıcıları yazar, aynı kutudan geri yüklenir. Aynı dosya iki kez yüklenince zamanlayıcı çoğalmaz. SE/Fossabot alan adları gerçek dışa aktarımla sınanmadı.
- A6 klavye: Canlı ekranında adsız denetim yok, odak halkası 3 px; tüm temalar zaten kontrast testinde.
- T1 ortak tasarım değişkenleri: `src/styles/axt-tasarim.css` (köşe, başlık yazısı, boşluk); Studio, Resonance ve gömülü bot aynı değişkenleri okur.
- T2 gömülü sayfa sözleşmesi: `docs/GOMULU_SOZLESME.md`; ayara git, Esc ile odak bırakma, Ctrl+Z geri alma.
- A1 bot bileşenleri: Uyarı Stüdyosu ortak `Alan/Girdi/Secim/Anahtar/Buton` bileşenlerinde.
- A4 tek kaydetme modeli: `useOtoKayit` (700 ms sonra kaydeder, Ctrl+Z); Ayarlar, Mini oyunlar, Moderasyon, Yapay zekâ sayfaları. `Otomasyon.tsx` hâlâ eski "kaydedilmedi" şeridini kullanır.
- A5 bildirim merkezi: `lib/bildirimler.ts`, zil simgesinde son 200 bildirim; hata kalıcı, bilgi 4 sn.
- A2 menü: yedi başlık (Hazırlık, Canlı, Sahne ve Overlay, Etkileşim, Bot, Yayın sonrası, Ayarlar), Giriş/Mola/Çıkış tek "Ekranlar" satırı + iç sekme, "Tüm ayarlar" kalktı. Ctrl+1..7 başlık, Alt+←/→ gezinme geçmişi, dar kipte 300 ms sonra yan panel, katlanan başlık hatırlanır (`studio.menu.katli`). Test: `anaMenu.test.ts`.
- A3 Ekranlar: 1366×768'de bölümler kapalıyken ayar paneli kaydırmasız (en uzun Çıkış 631/662 px). Şablonlar katlanır bölüm, sık kullanılanlar iki sütun.
- U1 kurulum sihirbazı: OBS → platform → sahne eşleme → test uyarısı; son adım birleşik overlay'i (`/overlay/master`) açık sahneye ekler, aynı adresli kaynak varsa eklemez. Bitti bilgisi panel ayarlarında `kurulumBitti`; OBS'i parolalı ayarlanmış eski kurulumlarda satır görünmez. Gerçek OBS'e ekleme sınanmadı (sandbox OBS'e bağlı değil).
- Faz 1 tamam.

## Faz 2 durumu

- U3 uyarı kuyruğu monitörü: OBS'teki uyarı kutusu ekrandaki ve sıradaki uyarıları bota bildirir (`uyari_kuyrugu` → `alert_queue`), Canlı kipinde "Uyarı kuyruğu" paneli gösterir; duraklat, sustur, atla, temizle, yeniden oynat. Sandbox'ta beş test uyarısı sıraya girdi, duraklatınca 9 sn yenisi çıkmadı. Aynı kutu iki sahnede açıksa panel OBS kaynaklarından en son güncelleneni gösterir. Gerçek OBS'te sınanmadı.
- U4 etkinlik akışı: tek liste ve satırdan yeniden oynatma zaten vardı. Eklenen: bot son 200 olayı tutar (`GET /api/activity/history`), panel sonradan açılsa da akış dolu gelir; "teşekkür edildi" işareti botta ortak (`POST /api/activity/thanked` → `activity_thanked`), "teşekkür bekleyenler" süzgeci. Sandbox'ta takip satırından uyarı yeniden oynatıldı. Geçmiş bellekte: bot yeniden başlayınca boşalır.
- U5 sohbet: arama, elle dondurma ve oturumdaki ilk mesaj rozeti zaten vardı; kullanıcı kartı ucu da (`/api/viewers/:ad/kart`) vardı ama panel kullanmıyordu. Eklenen: ada tıklayınca kart (son 20 mesaj, geçmiş cezalar), "10 dk sustur"/"Kalıcı ban" → hazır neden (Spam, Hakaret, Reklam, Konu dışı) = uygulanır (üç tıklama, neden seçimi onaydır); satırdan Sabitle ve Katmanda vurgula (`POST /api/chat/highlight` → `chat_highlight`, 15 sn); fare listedeyken akış durur; ters sıra (yerel ayar); Twitch Shared Chat ("paylaşımlı") ve kanaldaki ilk mesaj ("ilk kez") rozetleri. Sandbox'ta sahte iletiyle üç tıklamalık istek (sebep: Spam) yakalandı, vurgu sohbet kutusunda göründü ve 15 sn sonra kalktı. Gerçek Twitch etiketleri (source-room-id, first-msg) canlıda doğrulanmadı.
- U8 yayın bilgisi şablonları: Yayın Bilgisi bölmesi (Kick/Twitch/YouTube tek tek) zaten vardı. Eklenen: şablon (ad, başlık, kategori ADI, etiketler) panel ayarlarında `yayinSablonlari`; formdan "Şablon olarak kaydet", listeden seç → "Bağlı platformlara uygula" → onay. Kategori her platformda adla aranır: Kick/Twitch'te tam eşleşme yoksa ilk sonuç, YouTube'da yalnız tam eşleşme (yoksa kategori değişmez). Platform başına sonuç bölmede listelenir. Sandbox'ta sahte Kick bağlantısıyla doğru istek (tam eşleşen kategori kimliği) yakalandı; gerçek kanala yazılmadı, Twitch/YouTube yolu sınanmadı.
- B2 moderasyon süzgeçleri: tekrar, zalgo, regex süzgeçleri, silinen mesajın denetim günlüğüne yazılması ve !permit zaten vardı. Eklenen (bot): ceza merdiveni (uyarı → 1 dk → 10 dk → kalıcı ban; temiz kalma süresi ayarlı, varsayılan 30 dk; açıkken kural eylemlerinin yerine geçer, tekrar sayacı sıfırlanmaz); Kick'te susturma/ban/silmeyi yapan hesabın seçimi (yayıncı ya da bot; bot yoksa yayıncıya düşer); !permit süresi artık ayardan (eskiden hep 60 sn); 10 dk süre basamağı. Bot Moderasyonu > Ceza sekmesi. Kabul ölçütü motor testinde: "kaçıncı tekrarda" 2 iken üçüncü aynı mesaj 60 sn susturma. Merdiven bellekte: bot yeniden başlayınca sıfırlanır. Gerçek Kick/Twitch'te sınanmadı.
- B3 uyarı efektleri: konfeti, havai fişek, yıldız, kalp, yan toplar ve konfeti yağmuru vardı; takip/büyük bağış ayrımı sabit koddaydı. Eklenen (bot, uyarı kutusu): olay başına efekt ve güç ayarı (takip, abone, bağış/Kicks, 100 ve üstü bağış/Kicks, raid/host; "genel" ve "yok" seçenekli; varsayılanlar eski davranış), emoji yağmuru, kanal emote yağmuru (7TV kanal emote'ları, yoksa emoji), ekran sarsıntısı, ışık süpürmesi. Ayar formunda "Efektler" bölümü. Sandbox'ta test takibi emote yağmuru, 150 TL test bağışı ışık süpürmesi oynattı; sarsıntı da sınandı.
- Açık: B4, B5, B12, A7, A8, T4, T5, T6.

---

## Aşama 0 — Gerçek yayın provası (kod yok, 1 oturum)

Şimdiye kadarki düzeltmelerin çoğu sandbox'ta doğrulandı, gerçek OBS ve gerçek Kick ile değil. Yeni iş eklemeden önce bunlar kapanmalı.

| # | Prova | Bitti sayılır |
|---|-------|---------------|
| 0.1 | Kayıt kipinde (yayın anahtarı olmadan) "Yayını başlat" → 5 dk sayaç → Oyun → "Yayını bitir" → çıkış ekranı → otomatik kapanış | Sayaç 5:00'dan başlar, çıkış ekranı ayarlanan süre kadar görünür |
| 0.2 | 1.6.18 kurulum dosyasını temiz klasöre kur, aç | Logo ve kütüphane dosyaları görünür, eski sürüm klasörleri silinmemiştir |
| 0.3 | Test hesabıyla Kick'te sustur (2 dk) / ban / mesaj sil | Üçü de Kick'te gerçekleşir; yayıncı kendine uygularsa anlaşılır hata çıkar |
| 0.4 | Anket aç, sohbete "1" ve şık adını yaz | Oylar katmanda artar |
| 0.5 | Resonance'ta gerçek müzik çal | Dalgalar ritimle oynar, kalan süre doğru akar |

Provada çıkan her hata Aşama 1'in başına eklenir.

**11 Kasım sonuçları (açık uygulamadan yalnız okuyarak):**
- 0.2 tamam: 1.6.18 kütüphaneyi 8 eski klasörden birleştirdi, seçili logo 200 ile sunuluyor, eski klasörler duruyor.
- 0.1 için bulunan hata: çıkış süresi boşken Rust yayını 2. dakikada kapatıyordu, 4:40'lık çıkış videosu yarıda kalıyordu. Düzeltildi (`cc0e5f7`): bitişi video sonu yapar, 15 dk yalnız güvenlik ağı. Pakete girmedi.
- 0.5: OBS ölçerleri okunuyor; "Müzik" kaynağı sessizdi, dalga denemesi müzik çalarken yapılmalı.
- 0.1 (gerçek başlat/bitir), 0.3, 0.4: gerçek yayın ve gerçek sohbet gerektirir, yayıncı yapar.

---

## Aşama 1 — Güvenilirlik (Studio 1.6.19 / AxBoT 1.13.16)

**Durum (11 Kasım):** Aşama 0 provaları yayıncı tarafından başarıyla tamamlandı.
- 1 tamam: katman sağlığı durum şeridinde ve widget ayarlarında (sandbox'ta katman açıp kapatarak doğrulandı).
- 2 tamam: soketli her widget ya yeniden okur ya da nedenini yazar; `yenidenBaglanma.test.ts` denetler.
- 3 kısmen: dış görsel zorlanmıyor, ses yüklenemezse yerleşik zil. Kayıtlı ön ayarlardaki giphy/mixkit adresleri kullanıcının verisi olduğu için değiştirilmedi; yerel varsayılan medya için dosya seçimi/indirme kararı bekliyor.
- 4 tamam: `canvas-confetti` yalnız widget dışı panel sayfalarında ve `kutlama.ts`'de kaldı.
- 5 tamam: "Sorun bildir" zaten Ayarlar → Destek paketi olarak vardı; Studio günlüğü (son 200 satır) ve bot katman özeti eklendi.

Amaç: yayın ortasında hiçbir şeyin sessizce bozulmaması.

1. **Widget sağlık panosu.** Bot, her OBS katmanının son bağlantı anını zaten biliyor (WebSocket). Canlı ekranına "Katmanlar" kutusu: her widget için yeşil / sarı (30 sn'dir sessiz) / kırmızı (bağlı değil).
   *Bitti:* OBS'te bir tarayıcı kaynağı kapatılınca 30 sn içinde kırmızıya döner.
2. **Yeniden bağlanma denetiminin tamamı.** 1.13.15'te Hype Train, Kral, Sabit Mesaj ve Anket düzeltildi. Kalanlar: Emote Kombo, Jump Scare, Kappagen, Mağaza, Shoutout, Müzik Video, Jenerik — bunlar anlık olay gösterdiği için durum yüklemez; her biri için "kopukken gelen olay kaybolur mu, kaybolmalı mı" kararı yazılır.
   *Bitti:* `KaliciSoket` kullanan her widget'ta ya `onyenidenbaglandi` vardır ya da neden gerekmediği tek satır yorumla yazılıdır; bunu denetleyen bir test vardır.
3. **Dış adres bağımlılığı.** Varsayılan uyarı görseli ve sesi giphy.com / mixkit.co adreslerinden geliyor; internet yavaşsa ya da adres kalkarsa uyarı görselsiz/sessiz çıkar. Varsayılan görsel ve sesler pakete alınır (`/media/varsayilan/...`).
   *Bitti:* İnternet kapalıyken test uyarısı görsel ve sesle oynar.
4. **Kutlama efektini diğer katmanlara yay.** Çekiliş, Shoutout, Mağaza, Çark ve Bil Bakalım hâlâ kendi sabit konfetisini (ekranın altına yakın) atıyor. Hepsi `lib/kutlama.ts`'e geçer, her birine "Kutlama efekti" seçimi gelir.
   *Bitti:* `canvas-confetti` yalnız `kutlama.ts` içinde import edilir.
5. **"Sorun bildir" düğmesi.** Ayarlar → Yardım: son 200 günlük satırı + sürüm + OBS bağlantı durumu tek zip. Anahtar, token, yayın anahtarı içermez (paket tarayıcısındaki kalıplarla süzülür).
   *Bitti:* Üretilen zip, paket tarama betiğinden temiz geçer.

---

## Aşama 2 — Arayüz: tek dil, daha az tıklama (Studio 1.6.20)

Şu an üç ayrı görsel dil var: Studio sayfaları (yeni), bot sayfaları (cam panel, `glass-panel`, `rounded-2xl`), Giriş/Çıkış/Mola ayar paneli (uzun düz liste).

1. **Bot sayfaları Studio diline.** Bot arayüzü Studio içinde iframe olarak açılıyor. Botun `index.css`'ine Studio'nun yüzey / kenar / yarıçap / yazı ölçeği değişkenleri taşınır; `glass-panel`, düğme ve girdi sınıfları bu değişkenlerden beslenir. Sayfa sayfa yeniden yazım yok: ortak sınıflar değişir, sayfalar kendiliğinden uyar.
   *Bitti:* Studio'da tema değişince bot sayfaları da aynı renge geçer; Genel Bakış, Uyarılar, Widget ayarları ekran görüntüsünde kart yarıçapı ve başlık boyutu Studio ile aynıdır.
2. **Uyarılar sayfası "Gelişmiş" sekmesi.** Hâlâ ham `<input type=checkbox>` ve `<select>` satırları. Widget ayar formundaki (`WidgetSettingsForm`) hazır denetimlere geçer; iki ayrı form tek forma iner.
   *Bitti:* `AlertsStudio.tsx` içinde elle yazılmış ayar satırı kalmaz.
3. **Giriş / Çıkış / Mola ayar paneli.** Uzun liste → katlanır bölümler (Metin, Sayaç, Arka plan, Müzik, Logo) + üstte "en çok değişen 5 ayar". Değişiklik önizlemede anında görünmeye devam eder.
   *Bitti:* 1366×768'de hiçbir bölüm açılmadan kaydırma gerekmez.
4. **Boş durumlar ve ilk kurulum.** OBS bağlı değilken Canlı ekranı boş kutular gösteriyor. Her kutuya "ne eksik + tek düğme" (OBS'e bağlan, Kick'i bağla, sahne seç). İlk açılışta 4 adımlık kurulum: OBS → platform → sahneler → test uyarısı.
   *Bitti:* Temiz veri klasörüyle açılan uygulamada test uyarısına kadar 4 ekranda ulaşılır.
5. **Arama: bot sayfalarında ayara in.** Komut paleti bot ayarını buluyor ama sayfanın başına götürüyor. Bot sayfası `#ayar=<anahtar>` ile açılınca ilgili alanı kaydırıp 2 sn vurgular.
   *Bitti:* Palette "Kutlama efekti" aranıp seçilince alan görünür ve vurgulanır.
6. **Klavye ve erişilebilirlik turu.** Sol dar menü, hızlı işlemler, kip sekmeleri: Tab sırası, görünür odak halkası, yalnız simgeli düğmelerde `aria-label`. Yeni üç renkli temada kontrast testi zaten var; kalan temalara da aynı test.
   *Bitti:* Canlı ekranındaki her işlem fare olmadan yapılabilir.

---

## Aşama 3 — Bot: içerik ve etkileşim (AxBoT 1.14.0)

1. **Uyarı kutusu: olay başına efekt.** Kutlama efekti şimdi tek genel ayar. Olay ön ayarına (takip, abone, bağış, raid) ayrı efekt + güç; büyük bağışta havai fişek, takipte küçük konfeti. Varyant sistemi zaten tutara göre seçim yapıyor, efekt de varyanta bağlanır.
   *Bitti:* Takip ve 100 TL üstü bağış test uyarıları farklı efekt oynatır.
2. **Uyarı kutusu: yeni efektler.** Emoji yağmuru (yayıncı emojiyi seçer), kanal emote'u yağmuru (Kappagen'in emote kaynağıyla), ekran sarsıntısı, kenarlardan ışık süpürmesi. Hepsi `kutlamaPlani`na yeni tür olarak eklenir.
3. **Bil Bakalım soru havuzu.** ~214 zor soru var; kategori başına en az 60 (tarih, coğrafya, bilim, spor, oyun, müzik, sinema) hedefi, zorluk etiketi, "son 200 soruda tekrar yok" kuralı.
   *Bitti:* Kalite süzgeci (`soru-kalite.ts`) tüm havuzdan geçer; aynı oturumda soru tekrarı testi vardır.
4. **Anket ve tahmin.** Anket bitince kazanan şık uyarı kutusunda 5 sn gösterilir; puanlı tahmin (izleyici puan yatırır) sadakat puanına bağlanır.
5. **Moderasyon.** Susturma/ban işlemlerinde "kim, kime, ne zaman, neden" kaydı zaten var; sohbette kullanıcıya tıklayınca son 20 mesajı + geçmiş cezaları gösteren kart.
6. **Hedef çubuğu.** Takipçi hedefi dolunca otomatik sonraki basamak (100 → 250 → 500) ve dolduğunda kutlama efekti.

---

## Aşama 4 — Performans ve ölçüm (Studio 1.6.21)

1. **Resonance ses ölçerleri.** Şu an `/api/obs/meters` yoklanıyor; WebSocket'e alınır (daha akıcı dalga, daha az istek).
   *Bitti:* Ağ sekmesinde yoklama isteği kalmaz, dalga 30 fps'in altına düşmez.
2. **OBS kaynak maliyeti ölçümü.** Tüm katmanlar açıkken OBS "Render gecikmesi" ve kare süresi kaydedilir; en pahalı üç widget (tahmin: Kappagen, Emote Kombo, sohbet kutusu) için parçacık/öğe tavanı ayarı.
   *Bitti:* Ölçüm tablosu bu belgeye eklenir; tavanlar varsayılan olarak açık gelir.
3. **Tek birleşik katman.** `UnifiedOverlayWidget` var; yeni kurulumlarda 10 ayrı tarayıcı kaynağı yerine tek kaynak önerilir, kurulum sihirbazı bunu kurar.
4. **Açılış süresi.** İlk açılıştaki kütüphane kopyalaması (≈170 MB) arka plana alınır; arayüz hemen açılır, kopyalama ilerlemesi durum çubuğunda görünür.

---

## Aşama 5 — Dağıtım

1. **Paketleme betiği depoya.** Sürüm paketi betikleri hâlâ geçici klasörde elle kopyalanıyor; `scripts/paketle.ps1` tek komutla: sürüm yükselt → test → derle → imzala → tara.
2. **Güncelleme bildirimi.** Uygulama açılışta GitHub sürümlerine bakar, yenisi varsa "Yenilikler" listesiyle haber verir (otomatik indirme yok).
3. **Kütüphane taşıma, masaüstü dışı düzen.** Eski sürüm klasörleri yalnız yan yana duruyorsa bulunuyor; Ayarlar'a "Eski kütüphaneyi içe aktar (klasör seç)" düğmesi.

---

## Sıra ve boyut

| Aşama | Boyut | Sürüm |
|-------|-------|-------|
| 0 Prova | 1 oturum, kod yok | — |
| 1 Güvenilirlik | 5 iş | Studio 1.6.19 / AxBoT 1.13.16 |
| 2 Arayüz | 6 iş | Studio 1.6.20 |
| 3 Bot içerik | 6 iş | AxBoT 1.14.0 |
| 4 Performans | 4 iş | Studio 1.6.21 |
| 5 Dağıtım | 3 iş | sürekli |

Bilerek dışarıda bırakılanlar: mobil kumanda uygulaması, kendi yayın çekirdeği (`motor/`), yeni platform bağlantıları. Bunlar ayrı plan ister.
