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
- A4 tek kaydetme modeli: `useOtoKayit` (700 ms sonra kaydeder, Ctrl+Z); Ayarlar, Mini oyunlar, Moderasyon, Yapay zekâ sayfaları. `Otomasyon.tsx` de geçti (8b8c8ab).
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
- B4 oturum kilometre taşları: ilk mesaj karşılaması (sohbet uyarılarında `welcome`) zaten vardı. Eklenen (bot): yayın içi 10., 25., 50., 100. takipçi ve abone (hediye abone adediyle), Kicks toplamı 100/500/1000/5000 eşiklerinde ayrı "Kilometre Taşı" uyarısı (Uyarı Stüdyosu'nda kendi sekmesi, şablonu `{metin}`); yayın başlayınca sıfırlanır, test olayları ayrı sayılır. Sandbox'ta onuncu test takibi ve 150 Kicks test olayı kilometre uyarısı çıkardı, uyarı kutusunda göründü. Sayaç bellekte: yayın ortasında bot yeniden başlarsa baştan sayar.
- B5 içerik: puanlı tahmin (Topluluk Bahisleri, puan bahiste tahsil) ve hedef çubuğunda dolunca otomatik sonraki basamak zaten vardı. Eklenen (bot): Bil Bakalım'a zorluk etiketli 253 yeni soru; Tarih, Coğrafya, Bilim, Spor, Oyun, Müzik, Film ve Dizi yerleşik bankada 61-72 soru (eski bankayla aynı bilgiyi soran adaylar elendi). Soru seçimi "son 200 soruda tekrar yok" (kategori daha küçükse havuz kadar; tükenince yalnız son soru dışlanır, turnuvalar arası liste silinmez). Anket bitince (elle ya da süre dolunca) kazanan uyarı kutusunda "Anket Sonucu" şablonuyla 5 sn; hiç oy yoksa uyarı çıkmaz. Kalite süzgeci tüm yerleşik havuzdan atılan/onarılan soru olmadan geçiyor (test). Sandbox'ta 3 oylu anket bitince "Mirage kazandı! (2 oy, %67)" uyarı kutusunda göründü. Soruların doğruluğu elle denetlendi, dış kaynakla karşılaştırılmadı; "Sinema TV" ve "Oyunlar" gibi eş kategoriler birleştirilmedi.
- B12 kalkan açıkları: Twitch sohbet modu gövdeleri ve elle mod ucu vardı, kalkan kullanmıyordu. Eklenen (bot): kalkan açılınca Twitch'te takipçi modu (en az takip süresi ayarlı, varsayılan 10 dk), "Yalnız aboneler" seçiliyse abone modu, istenirse yavaş mod (3-120 sn) açılır; kapanınca yalnız kalkanın açtıkları kapanır (açmadan önce Twitch'ten okunan durum; yayıncının zaten açık tuttuğu moda dokunulmaz; açılanlar ayarda saklanır, bot yeniden başlasa da kapatılır). Sonuç denetim günlüğünde. Kalkan ekranında "Twitch sohbet modlarını da aç" bölümü. Kick ve YouTube'un resmi API'sinde sohbet modu yok; hesap yaşı modu hiçbir platformun API'sinde yok (ekranda gerekçesiyle yazıyor). Sandbox'ta Twitch bağlı değilken uyarı günlüğe düştü; gerçek Twitch kanalında sınanmadı.
- A7 tamam (StreamAxT `2de9a0f`, Studio `982a9e9`): sekiz nesnenin sağ tık menüsü; Menü tuşu ve Shift+F10 odaktaki satırda açar; Sil/Sustur/Banla gibi öğeler ikinci basışta çalışır. Spotify Beğen ve Çalma listesine ekle yeni izin ister: Spotify yeniden bağlanmalı. OBS ve Spotify gerektiren menüler sandbox'ta yalnız derleme ve birim testiyle doğrulandı.
- A8 tamam (StreamAxT `37a0d34`, Studio `b93d0e7`): canlıyken Yayını bitir (Canlı ekranı, üst şerit, Dashboard çıkış düğmesi) 600 ms basılı tutmayla çalışır, çubuk düğmenin içinde dolar, Boşluk/Enter da basılı tutulabilir; yayın kapalıyken Yayını başlat tek tık. Yayın açıkken sahne ayarları (Studio, OBS yayın durumu) ile uyarı ve katman düzenleyicisinin (bot, platform yayın durumu, 10 sn yoklama) başında "değişiklik yayında anında görünür" şeridi. "Önce önizlemede dene" anahtarı yapılmadı. Canlı yol sandbox'ta OBS olmadan yalnız birim testiyle doğrulandı; bot şeridi sahte durum yanıtıyla görüldü.
- T4 tamam (Studio `e24a01c`): `src-tauri/tests/yayin_provasi.rs` test içinde sahte obs-websocket 5 sunucusu ve sahte AxBoT uyarı denetimi açar; Studio sunucusu eylem kayıt defterinden onaysız başlat/bitir reddi, sonra başlat → uyarı atla → Mola sahnesi → bitir yürütür; OBS'e giden istek sırası, sahne adı ve denetim günlüğü denetlenir. CI'da (`ci.yml`, `release.yml`) ve `build-release-signed.ps1`'de ayrı adım. Sahte OBS yalnız protokolü taklit eder: gerçek OBS'in yanıt süreleri, hata kodları ve görüntü sınanmaz; StreamStateChanged olayı gönderilmez.
- T5 tamam (StreamAxT `2228811`, Studio `574c6ed`): envanter `PLATFORM_CAPABILITY_MATRIX.md` §4. Taşınan (bot): yayın durumu `GET /public/v1/users/livestreams`, ban/zaman aşımı hedef kimliği `GET /public/v1/channels?slug=` (yalnız kullanıcı kimliği okunur); ikisi de hata olursa kanal sayfasına düşer. Yayın kimliği başlangıç saatinden türetilir, iki yol aynı yayına aynı kimliği verir (Discord duyurusu tekrarlanmaz; güncelleme yayın sırasında yapılırsa bir kez tekrar duyurabilir). Studio: yedek yolda kanal kimliği kullanıcı kimliği sanılıyordu, düzeltildi. Resmi karşılığı olmayanlar (sohbet okuma, oda kimliği, takipçi sayısı, klip) kaldı. Resmi uçlar belgedeki şemaya göre yazıldı, gerçek Kick hesabıyla sınanmadı.
- T6 tamam (Studio `6eeb951`): Dashboard OBS kartının sahne, kaynak göster/gizle ve susturması eylem kayıt defterinden (`/api/actions/run`). Küresel kısayolların eski türleri aynı OBS yürütücüsüyle çalışır (kopuk bağlantıyı yeniden kurma davranışı korunsun diye) ama her basış `ACTION:<kimlik>`, `via: hotkey` olarak günlüğe düşer; kısayolla sahne geçişi `ACTION:scene.switch`. Deste: ayar yamasında `controlDeck.rev` karşılaştırılır, eski sürümle kayıt 409; deste penceresi kayıtları sıraya koyar, çakışmada uyarıp yeniden yükler, "Desteye ekle" bir kez yeniden dener. Sandbox'ta 409, art arda iki kayıt ve çakışma uyarısı denendi. Küresel kısayol denetim kaydı yalnız birim testiyle doğrulandı (başsız sunucuda küresel kısayol yok). Katman işlemleri kayıt defterinde değil.
- Plan tablosundaki işler bitti.

## Faz 3 durumu

- B6 tamam (StreamAxT `10ace97`): sıradaki istek sınırı seviyeye göre (izleyici, abone, VIP; boşsa izleyici sınırı, hem abone hem VIP olana yüksek olan), kullanıcı engel listesi, istek ücreti (`sr_ucret`): yetmeyen bakiyede neden yazılır, ücret yalnız istek sıraya girince düşülür; istek sonradan çalınamazsa (engel, bulunamadı, YouTube'da kapalı) ya da izleyici `!wrongsong` ile geri alırsa iade edilir. `!songlike` / `!sarkibegen` çalan şarkıyı kişi başı bir kez beğenir. En uzun süre, şarkı/sanatçı engeli ve `!voteskip` zaten vardı. Ödenen istekler ve beğeniler bellekte: bot yeniden başlarsa o anki sıradaki isteklerin iadesi yapılamaz. Sandbox'ta ayar sayfası denendi; ücret akışı testte, gerçek sohbetle denenmedi.
- R4 tamam: yayın boyunca çalan şarkılar zamanla deftere yazılır, yayın sonu raporunda listelenir; `!oncekisarki` / `!lastsong`; rapordan "Discord'a gönder" düğmesi (kendiliğinden gitmez). Video kipindeki klip istekleri listeye girmez.
- R6 tamam: Resonance katmanında çalan şarkıyı isteyen, sıradaki istek ve 6 sn "Yeni istek" satırı (Pulse › Şarkı istekleri ile kapatılır); salt okunur kuyruk paneli `/dock/sarki-sirasi`. Studio host'unda kuyruk ucu olmadığından şerit orada çıkmaz.
- R7 tamam: `/ws/obs-meters` her yeni OBS ölçümünü (50 ms) iter; Ses Karıştırıcı, Kontrol Merkezi ve Resonance dalgası yoklamadan akışa geçti (akış açılamazsa HTTP'ye düşer). Yayın sağlık satırı 5 sn'lik tek okumada kaldı. Sahte OBS provasında akış sınandı; gerçek OBS'te kare hızı ölçülmedi.
- R5 tamam: "değişimde N sn göster" ve "duraklayınca gizle" zaten vardı; eklenen Pulse › OBS sahne kuralları (`Oyun = pill`, `Mola = poster`, `Sohbet = gizle`). Sahne adı OBS tarayıcı kaynağının kendi API'sinden okunur (sunucuya istek yok); OBS dışında `?sahne=` ile denenir. Gerçek OBS içinde denenmedi.
- R9 tamam: Pulse › sözler: şarkıya özel kayma (±100/±500 ms, parça başına hatırlanır, en çok 300 parça), kaynak sırası seçimi (NetEase kapatılabilir), küfür maskesi (TR/EN temel liste + ek kelimeler; ilk harf kalır). Söz bulunamayan parçada katman altta boş yer ayırmaz.
- R8 tamam: Pulse › görünüm galerisi: arama (ad + etiket), etiketler (dikey, küçük, büyük, kapak, retro, sade, renkli), sık kullanılanlar başta, ayarları JSON olarak dışa/içe aktarma (yalnız bilinen ve aynı türdeki alanlar; müzik kaynağı taşınmaz). "dikey" ölçüden türer: 27 tema korumalı alanda ölçüldü, genişliği ≤ 320 px ya da kendisi dikey olan 11 tema. Ölçü varsayılan kart genişliğine göredir.
- R10 tamam: deste/kısayol müzik eylemleri (oynat/duraklat, sonraki, önceki, ses %, karıştır, tekrar döngüsü, beğen, adı seçilen listeye ekle; liste yoksa gizli olarak oluşturulur). Kaynak bağlı değilse 409. Gerçek Spotify/YTMD ile denenmedi.
- R2 tamam: Windows medya oturumu (SMTC) saniyede bir okunur (Apple Music, Tidal, tarayıcı, VLC); Spotify/YTMD bağlıysa öncelik onlarda, onların SMTC oturumu atlanır. Oynat/duraklat/sonraki/önceki ekrandaki oynatıcıya gider. Sanal ortamda gerçek Brave oturumu 2 sn içinde panelde görüldü; kapak resmi yok, Apple Music ile denenmedi.
- R3 tamam: Müzik › Müzik kaynağı: otomatik (en son çalan) ya da sıra (Spotify, YouTube Music, Windows medya); Windows medyada yok sayılan uygulamalar (adında geçen parça, en çok 20). Sanal ortamda Brave yok sayılınca tarayıcıdaki YouTube 2,5 sn içinde overlay'den indi.
- T7 tamam (Studio `7061c08`, StreamAxT `5ce7c90`): ilk açılış kütüphane kopyası arka planda (gizli adla kopyalanıp adlandırılır, yarım dosya sunulmaz). Ölçüm başsız Chrome 1920x1080'de (gerçek OBS yok): 18 bot widget'ı, Studio master/uyarı/widget ve Resonance overlay'i varsayılan ayarla p95 5,7 ms. Sayfa içi sahte yükte en pahalı üç widget sohbet kutusu, ekranda emote ve etkinlik akışı; ayarda sınırsız sayı yazılabildiği için 500/400/300'de DOM 6500/1150/1230'a çıkıyor, kare 16,7 ms'yi aşıyordu. Tavan: sohbet 100, emote 60, akış 50 (DOM 1600/200/230; saniyede 16 mesajda p95 9,5 ms). Not: master overlay her widget için ayrı overlay-sync soketi açıyor (sunucu yokken toplam ~3 deneme/sn); tek ortak soket ayrı iş.
- Faz 3 tamam.

## Faz 4 durumu

- B10 tamam (StreamAxT `f91aa60`): !quote / !addquote ve panel listesi zaten vardı. Eklenen: yayın defteri sohbetteki `!ad` iletilerini sayar, yayın sonu raporunda en çok kullanılan 10 komut; `GET /api/yayin-ozetleri/:id/csv` (özet, en çok yazanlar, komutlar, bağış, baskın, şarkılar; formül enjeksiyonu kaçışlı). Sanal ortamda sahte raporla panel ve CSV doğrulandı, rapor sonra silindi.
- B9 tamam (StreamAxT `73feade`): kişilik yönergesi zaten vardı. Eklenen: bilgi bankası (`ai_bilgi_bankasi`, 4000 karakter, yönergeye eklenir) ve günlük istek sınırı (`ai_gunluk_sinir`, sayaç ayarlarda, gün değişince sıfırlanır; dolunca sohbette sessiz, panelde uyarı). Yapay zekâ moderasyonu ceza vermiyor (`ai_toxic` kuralı hiç üretilmiyor), öneri katmanı gerekmedi. Sanal ortamda sahte yerel OpenAI uyumlu sunucuyla SSS cevabı ve 2/2 sınırı doğrulandı, ayarlar sonra silindi.
- B8 kodda tamam (StreamAxT `a98e78c`): önceki durum: `RewardRedeemedEvent` yalnız KICKs dalına düşüyor, miktarı olmadığı için atılıyordu; ödül yönetimi yoktu. Eklenen: `/api/kick/oduller` (docs.kick.com/apis/channel-rewards; listele, oluştur, aç/kapat, sil; yalnız kanal girişi), ödül kullanımı `loyalty_redeemed` (kaynak kick) olarak otomasyonun Ödül tetiğine gider, Otomasyon sayfasında kart ve ödül adı önerisi. OAuth kapsamına `channel:rewards:read/write` eklendi. Gerçek Kick'te doğrulanmadı: kullanıcının bir kez yeniden bağlanması, bir ödül açıp kullanması gerekir; gerçek zamanlı yük alanları (reward_title, username, user_input) varsayımdır.
- B7 tamam (StreamAxT `381664b`): tetik/koşul/eylem düzenleyicisi, bekleme, değişkenler ve kuru Dene zaten vardı. Eklenen: sahne adında `{onceki_sahne}` (kuralın ilk sahne değişiminden önceki sahne Studio `/api/obs/kumanda`dan okunur), sıralı/rastgele kip, kural başına sıra (en çok 10, bekleme süresine uyar), onaylı gerçek Çalıştır (`POST /api/otomasyon/calistir`). "Raid gelince sahneyi değiştir, 10 sn sonra geri dön" kuralı sanal panelde kodsuz kuruldu, Dene adımları doğru gösterdi; Çalıştır sanal Studio'ya (18843, OBS yok) ulaştı ve "OBS bağlı değil" döndü. Sahne değişimi ve geri dönüş birim testinde (sahte Studio) doğrulandı; gerçek OBS'te denenmedi. Sanal bot artık `AXBOT_MUZIK_HOST=http://127.0.0.1:18843` ile başlıyor (önceden varsayılan 8843 gerçek Studio'ydu).
- Faz 4 bitti.

## Faz 5 durumu

- T8 güvenlik çekirdeği tamam (Studio, bu commit): panel tek kullanımlık 60 sn kod üretir (yalnız loopback), telefon `/remote?eslestir=` ile bir kez kullanır ve yalnız seçilen izinleri taşıyan, yönetici olamayan, 90 günlük kendi anahtarını alır; cihaz listesi anahtarsız, iptal anında 401. Yerel ağa açılma panelde onayla. Sanal Studio'da kod üret → eşleş → ikinci kullanım 401 → iptal → 401 zinciri tarayıcıda doğrulandı; LAN açılmadı. Eksik: mobil kumanda arayüzünün kendisi (ayrı plan).
- T8 QR (kullanıcı onayıyla `qrcode` 1.5.4 eklendi): eşleştirme kartı yerel ağa açıkken bağlantıyı QR olarak gösterir; kapalıyken "önce yerel ağ erişimini açın" uyarısı. Sanal Studio'da LAN kapalı hâl doğrulandı; QR'ın kendisi gerçek ağda okutulmadı.
- T8 ek (Studio): uzak oturum anahtarları artık `h:` + SHA-256 olarak saklanıyor; eski düz oturumlar ilk kullanımda çevriliyor. Özetin kendisini anahtar diye gönderme açığı testte yakalanıp kapatıldı.
- T9 tamam (Studio `c0a5474`): Ayarlar › Yedekler'de "Eski kütüphaneyi içe aktar" (klasör seçici; sürüm klasörü ya da `assets`; üzerine yazmaz, silmez, rastgele klasörü reddeder; yeniden başlatma gerekmez). `scripts/surum-yukselt.ps1` ve `build-release-signed.ps1 -Surum x.y.z` üç dosyayı birlikte yükseltir; paketlemeden sonra Defender taraması (tehdit bulursa durur, `-SkipScan`). Sanal Studio'da uç doğrulandı (1 dosya, ikinci kez 0, `C:\Windows` ve göreli yol 400). İmzalı paket bu oturumda çalıştırılmadı.
- A4 tamam (StreamAxT `8b8c8ab`): Otomasyon sayfası da `useOtoKayit` kullanıyor; yarım kural hata değil "tamamlanınca kaydedilecek" diye gösterilir. Sanal panelde yeni kural → doldur → kendiliğinden kaydedildi → sil doğrulandı.

## Plan 2 — gerçek ortam provası (`Desktop\PLAN_GELISTIRME_2_2026-11.md`, 16 Kasım)

- D1 geçti: gerçek OBS (WebSocket parolalı, parolayı yayıncı girdi), boş veri klasörlü başsız Studio. Sihirbazın son adımı "AxthrowA Overlay" tarayıcı kaynağını açık sahneye ("Oyun ekranı") bir kez ekledi; ikinci basış "OBS'te zaten var" dedi, kaynak sayısı 1 kaldı. Yayın kapalıydı; deneme kaynağı sonra silindi. Birim testi: `src/lib/obsBirlesikOverlay.test.ts` (yeniden adlandırılmış kaynak adresinden tanınır).
- D16 yapılamadı: gerçek StreamElements ve Fossabot dışa aktarım dosyası yok (indirmek hesaba giriş ister). İnceleme sırasında bulunan açık kapandı (StreamAxT `3de05bb`): SE zamanlayıcısındaki ek mesajlar artık sessizce düşmüyor, içe aktarma uyarısı veriyor. Alan adları hâlâ gerçek dosyayla doğrulanmadı.
- Y11 Discord etkinliği (Studio `1fc1aa0`): bot token ve sunucu kimliği kimlik kasasında; planlı yayın dış konumlu (yayın adresi) Discord etkinliği olarak açılır, silinince etkinlik de silinir. Sanal Studio'da geçersiz kimlik, sahte token (Discord 401), geçmiş tarih ve silme yolları sınandı; gerçek sunucuda etkinlik açılmadı.
- Y15 sunucu metinleri (Studio `cbaa5b4`): Rust'ın arayüze dönen 456 hata/durum metni ve Türkçe harfsiz 36 şablon ("Eklenemedi: {0}") sözlükte; şablona gömülen sunucu hatası da çevrilir. `ceviri-cikar.mjs` artık `src-tauri/src` tarar (günlük satırları, testler, tepsi menüsü gibi yerel pencere metinleri hariç); eksik 0. Sanal Studio'da İngilizce kipte Discord kartının sunucu hatası İngilizce göründü. Yerel pencereler (tepsi menüsü, kapatma sorusu) hâlâ yalnız Türkçe.
- D2 geçti: gerçek OBS'te iki uyarı kutusu kaynağı; "Duraklat" bekleyen uyarıyı göstermedi (kaynak görüntüsü boş), "Sürdür" ile "YENİ TAKİPÇİ" göründü. Açık kutu sayısı 2 → 3 (tarayıcı önizlemesi) → kaynaklar silinince 1. Yalnız test uyarısı (WebSocket), gerçek olay yok.
- D9 geçti: yalıtılmış AxBoT'ta "baskında Mola'ya geç, 10 sn bekle, `{onceki_sahne}`" kuralı "Çalıştır" yoluyla çalıştı; gerçek OBS'te Oyun ekranı → Mola → Oyun ekranı. Yayın ve kayıt kapalıydı. Başsız Studio OBS'e bağlanmadığı için `STUDIO_HEADLESS_OBS=1` eklendi (panel ayarındaki bilgiyle bağlanır, olay akışı yok).
- D10 geçti: `sceneRules` "Sahne 2 = göster / Mola = gizle" olan Resonance kaynağı her iki sahnede; OBS kaynak görüntüsünde kart Sahne 2'de görünür (%10,5 dolu), Mola'da gizli (%0), geri dönünce yine görünür. Kaynak sonra silindi. Not: OBS'te `RemoveInput` program dışı sahnelerdeki girişi bazen bırakıyor; sahne öğesini silmek (`RemoveSceneItem`) güvenilir.
- D3–D8, D11–D15 bekliyor: gerçek Twitch/Kick/YouTube hesapları, telefon ya da müzik çalma ister; yayıncıyla ayrı oturum.

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
