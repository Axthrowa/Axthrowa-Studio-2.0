/**
 * Sürüm adları ve yenilikler. Her yeni düzeltme sürümünde EN ÜSTE bir satır eklenir;
 * panel başlığı ve "Yenilikler" listesi buradan okunur (package.json sürümüyle aynı tutulmalı).
 */
export interface Surum {
  surum: string;
  ad: string;
  tarih: string;
  notlar: string[];
}

export const SURUMLER: Surum[] = [
  {
    surum: '1.13.9',
    ad: 'Net Görünüm',
    tarih: '2026-11-05',
    notlar: [
      'Soluk yazılar ve çok küçük metinler okunur hâle geldi; küçük düğmelerin tıklama alanı büyüdü',
      'Klavyeyle gezerken seçili öğe her yerde görünür; form alanları ve simge düğmeleri ekran okuyucuya adını söyler',
      'TTS sayfasındaki okunmayan "Yayına ekleme linkini kopyala" düğmesi düzeltildi',
      'Sistemde hareket azaltma açıksa panel animasyonları kapanır',
    ]
  },
  {
    surum: '1.13.8',
    ad: 'Sağlam Kapı',
    tarih: '2026-11-04',
    notlar: [
      'Bağış bildirimi tünelle dışarıdan alınabilir: adres gizli anahtar taşır, tünelden yalnız iki bağış ucuna ulaşılır',
      'Ko-fi bildirimi okunur; bağışçı gizli dediyse mesajı gösterilmez ve okunmaz',
      '3001 portundaki başka bir uygulama artık AxBoT sanılıp kapatılmaz, bot da bu yüzden açılmamazlık etmez',
      'Çekiliş iptali ve market iadesi tek işlemde yapılır, iki kez iade olmaz; puan kaydı çok daha az takılır',
      'Yedek geri yükleme yarıda kalırsa veriler önceki hâline döner',
    ]
  },
  {
    surum: '1.13.7',
    ad: 'Sağlam Sıra',
    tarih: '2026-11-04',
    notlar: [
      'Oynatıcısı takılan klip sırayı ve duraklatılmış müziği kilitlemez; uzun klipler süresince çalar',
      'Klipten sonra istek başlamazsa müzik duraklatılmış kalmaz, istek kuyrukta bekler',
      'Sıra klipteyken !skip çalan parçayı geçer, izleyiciye yanlışlıkla "şimdi çalıyor" denmez, Otomatik DJ yarıda kesilmez',
      'Çekiliş şartları grubu değer değişince kapanmaz, widget aramasında kapalı bölümler açılır, anket şıklarındaki boşluklar temizlenir',
    ]
  },
  {
    surum: '1.13.6',
    ad: 'Sade',
    tarih: '2026-11-04',
    notlar: [
      'Tek URL sayfası çok daha az işlemci harcıyor: hedef çubuğu çizgileri yeniden boyamıyor, widgetlar tek bağlantıyı paylaşıyor, klip yokken YouTube oynatıcısı kapanıyor',
      'Klip isteği çalan müziğin bitmesini bekler, müzik klip boyunca duraklar, klip bitince sürer; istek şarkılar sırayı bozmaz',
      'Karaoke kelime kelime akar: kelime zamanı varsa o kullanılır, yoksa heceye göre yayılır; dolum geri sıçramaz',
      'Anket, çekiliş, tahmin, uyarı ve widget ayarları açılır gruplara ayrıldı; widget ayarlarında arama var',
    ]
  },
  {
    surum: '1.13.5',
    ad: 'Karşılama',
    tarih: '2026-11-04',
    notlar: [
      'Yeni takipçi sohbette temalı karşılanır: Harry Potter, Yüzüklerin Efendisi, Star Wars, Game of Thrones, Breaking Bad ve fazlası; temalar seçilebilir',
      'Komutlar sekmesinde her komutun sohbet görünümü ve yanıt düzenleme',
      'Emote kombo: gelen emote hızı ayarlanır, emote varmadan patlamaz',
      'Tek URL Yayın ekranı testte kendiliğinden yenilenmez; süresi dolmuş boş çekiliş gizlenir; bağış kupası boşken gizlenebilir',
    ]
  },
  {
    surum: '1.13.4',
    ad: 'Klip',
    tarih: '2026-11-04',
    notlar: [
      '!klip düzeldi: YouTube müzik videolarını 127.0.0.1 adresinde reddediyordu; gömmeye kapalı yüklemede başka sürüme geçer',
      'Temalar görünümü de değiştirir; Tek URL\'de her widget\'a Test; hedef simgesi bara ortalı',
      'Çekiliş: okunur hızda isimler, tüm katılımcılardan şerit, 8 yeni tema, çekiliş anı için hizalama',
      'Hizalama dokuz nokta ve kenar payı; daha yumuşak çark; emote hızı kaydırıcısı; bot girişi gizli pencerede; ipucu anahtarı hemen kaydedilir',
    ]
  },
  {
    surum: '1.13.3',
    ad: 'Temalar',
    tarih: '2026-11-04',
    notlar: [
      'Çekiliş: kasa açar gibi kayan isimler, çekiliş anına ayrı konum',
      'Anket ve diğer widgetlar içerikleri kadar uzar; ekrana gelmeyen widget arkasındakini gizlemez',
      'Kelime bulutu az sözcükte eşit dolar; emote kombo ve ekranda emote için hız ayarı, daha akıcı emote ve kupa',
      'Şarkı Klipleri için Test düğmesi; 28 film, oyun ve dizi teması, 41 yeni yazı tipi, okunmayan yazılar düzeltildi',
    ]
  },
  {
    surum: '1.13.2',
    ad: 'Temalar',
    tarih: '2026-11-04',
    notlar: [
      'Tek URL: emote kombo taşınır ve boyutlanır, etkisi isteğe bağlı tüm ekranı kaplar; boyutlandırma widget yerini değiştirmez, test sayfayı yenilemez',
      'İzleyici sayacı canlı sayıyı gösterir ve ortalanır; varsayılan yeri düzeltildi',
      'Çekiliş: katılan tüm isimler sağdan sola kayar; Tahtın Kralı boşken yer kaplamaz',
      'Yeni !klip komutu; oyun mesajlarında yayıncının kendi adı; !kelime ipucu ve etkinlik akışı çerçevesi kapatılabilir',
    ]
  },
  {
    surum: '1.13.1',
    ad: 'Temalar',
    tarih: '2026-11-04',
    notlar: [
      'Kick: geçersiz bot girişi artık görünür; süresi dolan giriş kendini yeniler, yanıt yazamama sessizce kalmaz',
      'Çarkıfelek: dönmeme hatası giderildi, kayıtlı dilim yokken de çalışır, ortaya görsel veya GIF adresi eklenir',
      'Tek URL: yalnız ayar paneli kayar, köşe widgetı büyütür, kenarlar kutuyu değiştirir',
      'Tahtın Kralı: taçtaki nokta kaldırıldı, hatalı temalar düzeltildi, yeni temalar',
      'Hedef çubuğu ve Subathon sayacı: yeni görünümler ve 11\'er yeni tema',
    ]
  },
  {
    surum: '1.13.0',
    ad: 'Temalar',
    tarih: '2026-11-03',
    notlar: [
      'Canlı Chat: ileti arka planını tamamen şeffaf yapan ayar, 9 yeni görünüm, 12 yeni tema, 20 yeni yazı tipi, kurulu yazı tipi, ad ayrı satırda, emote boyutu',
      'Tüm kutulu widgetlar: 27 ortak kutu tasarımı ve 10 yeni hazır tema',
      'Çarkıfelek: 5 yeni renk paleti',
      'Resonance: 8 yeni görünüm, renk paletleri, hareketli arka plan, kayan başlık, albüm adı, kalan süre',
      'Şarkı sözleri: kartın altında ve kart genişliğinde, 9 görünüm; bulunamayınca NetEase ve Lyrics.ovh da aranır',
    ]
  },
  {
    surum: '1.12.0',
    ad: 'AxBoT',
    tarih: '2026-11-03',
    notlar: [
      'Botun adı AxBoT, uygulamanın adı AxthrowA Studio oldu',
      '!sr: başlayan istek kesilmez, sıradaki istek kaybolmaz; !sarki gerçekten çalan şarkıyı yazar',
      'Tek URL: uyarı dahil her widget için “arkasındakileri gizle” ve “öne bir şey gelince gizlen” ayarı',
      'Tek URL: test düğmesi görünür çalışır, yalnız seçili widget taşınır, widget ayarlarının tamamı aynı panelde',
      'Subathon: abone, hediye, bağış, KICKs ve takip ayrı ayrı açılıp kapanır; durum noktası kapatılabilir',
      'Çarkıfelek: daha büyük orta alan, GIF, dönüş sesi ve dilim düzenleyici',
      'Ekranda emote: emote’lar rastgele kenardan girip başka kenardan çıkar',
      'Bağış treni boştayken de görünür; gizlemek ayarla açılır',
      'Şarkı sözleri Giriş, Çıkış ve Mola ekranlarında; ayarları Resonance’ta'
    ]
  },
  {
    surum: '1.11.1',
    ad: 'Sahne Sırası',
    tarih: '2026-11-03',
    notlar: [
      'Tek URL overlay: çekiliş, Bil Bakalım ve anket ekrandayken bölgelerindeki widget gizlenir, bitince geri gelir',
      'Bildirimler ve tam ekran efektler bu gizlemeden etkilenmez'
    ]
  },
  {
    surum: '1.11.0',
    ad: 'Sahne Şovu',
    tarih: '2026-11-03',
    notlar: [
      'Otomasyon: kod yazmadan tetikleyici, koşul ve eylem kuralları; Dene düğmesi hiçbir eylemi çalıştırmadan adımları gösterir',
      'Sohbet patlamasında otomatik klip ya da OBS tekrar arabelleği kaydı kurulabilir',
      '!so kartı Kick kanallarında profil fotoğrafını ve oyunu gösterir',
      'Yayın Sonu Özeti: yayın bitince sayısal rapor; isteğe bağlı 3 maddelik yapay zekâ özeti',
      'Şarkı isteği kuyruğu: sürükle-bırak sıra, öne alma, engel listesi, süre ve puan sınırı',
      'Genel Bakış yenilendi, Ctrl+K komut paleti Bot sekmesinden de açılır'
    ]
  },
  {
    surum: '1.10.1',
    ad: 'Tam Hesap',
    tarih: '2026-11-03',
    notlar: [
      'Aynı yanıttaki ikinci değişken de çalışır: iki sayaç, iki seçim, iki koşul, iki hesap',
      '{puan} herkese kendi cüzdanını ve güncel bakiyeyi gösterir; !izleme de kendi platformundaki kaydı okur',
      'Puanlar en geç 30 saniyede kaydedilir: uygulama kapanınca son dakikalar kaybolmaz',
      'Panelden yazılan komut yayıncı yetkisiyle çalışır; botla aynı metni yazan izleyici yok sayılmaz',
      'Yayın kapalıyken izleme puanı verilmez',
      '!duello uydurma ada cüzdan açmaz; tahmin ödemesi yarıda kalırsa iki kez ödenmez'
    ]
  },
  {
    surum: '1.10.0',
    ad: 'Yeni Düzen',
    tarih: '2026-11-02',
    notlar: [
      'AxthrowA Studio 1.3.0 ile yeni menüde gömülü çalışır: Komutlar, Oyunlar, Puanlar, Moderasyon sekmeleri',
      'Sohbete yanıt verme anahtarı (!bot mute ile aynı ayar)',
      'Bağlantılar için OBS tarafında açık kaynak bilgisi'
    ]
  },
  {
    surum: '1.9.4',
    ad: 'Kelime Avı',
    tarih: '2026-11-02',
    notlar: [
      'Emote kombo: gelen emote’lar ekranın rastgele yerinden ortadakine uçar; bitince her yöne süzülüp ekrandan çıkar',
      '!kelime: 150’ye yakın kelime, ipucu ve her turda gerçekten karışık harfler; süre dolunca cevap söylenir',
      'Oyunlar sayfasındaki ayarlar artık oyunlara uygulanır; lobiler görünür, iptal ve Chate Gönder düğmeleri çalışır',
      '!kes kırmızı Türkçe yazımla tanınır; yanlış yazım bombayı patlatmaz, süresi dolan bomba sohbete yazılır',
      '!yazitura 50 tura ve !slot hepsi geçerli; panelden açılan soygun bedava puan vermez',
      'Tek URL widget listesinde simgeler; yeni logo',
      'Botun Platformlar sayfasındaki Kick giriş düğmeleri uygulama içinde de açılır; ad okunamasa da kanal girişi kaydedilir, süresi dolan kanal girişinde bot hesabına dönülür',
      'Tek tek silmede yalnız silinen mesajlar ekrandan kalkar, kaç mesajın kaldığı yazılır; Kick’te silinen mesaj panelden de kalkar'
    ]
  },
  {
    surum: '1.9.3',
    ad: 'Soru Sayısı',
    tarih: '2026-11-02',
    notlar: [
      '!soru tarih 5: kategoriden sonra yazılan soru sayısı çalışır (yayıncı ve moderatör; izleyici tek soru açar)',
      'Şarkı sözü bulunamayınca yazı birkaç saniye görünür, sonra widget gizlenir; sözü bulunan şarkıda yeniden açılır (süre ayarlardan değişir)'
    ]
  },
  {
    surum: '1.9.2',
    ad: 'Sohbet',
    tarih: '2026-11-02',
    notlar: [
      'Canlı Sohbet: sekme değişince mesajlar kaybolmaz, yukarı kaydırınca liste kaçmaz',
      'Sohbeti temizle hangi platformda temizleneceğini sorar; Kick’te /clear çalıştırır, işlemezse mesajları tek tek siler',
      'Mesaj sabitleme çalışır: sabit mesaj panelde ve OBS’te görünür (Kick’in API’si platformda sabitlemeye izin vermiyor)',
      'Kick’in orijinal rozetleri',
      'Bot hesabı ve yayın kanalı girişi ayrıldı; bot hesabı kanal değişse de kayıtlı kalır',
      'Çekiliş: yeni overlay ve Tek URL katmanı, başlayınca sohbete duyuru, özel katılım kelimesi, açık çekilişi düzenleme, yeniden çekme, kriptografik rastgele seçim',
      'Tahmin komutu artık !tahmin',
      'Tek URL’ye widget testleri ve Yenile; Anket ve Çekiliş sekmelerine önizleme',
      'Resonance kartı sabit genişlikte: şarkı adı değişince yeri oynamaz'
    ]
  },
  {
    surum: '1.9.1',
    ad: 'Sade',
    tarih: '2026-11-02',
    notlar: [
      'Takipçi hedefi kanalın gerçek takipçi sayısını gösterir; yeni takipçi gelince ilerler ve uyarı çalar (Kick takipçinin adını vermediği için uyarıda "Yeni takipçi" yazar)',
      'Hedef barı: simge barın ucunda, dolguyla birlikte ilerler',
      'Emote kombo: yalnız emote görünür, geldikçe büyür, gelmeyi kesince patlayıp saçılır',
      'Şarkı sözleri şarkı durduğu an ekrandan kalkar',
      'Tek URL’deki Resonance, AxthrowA Studio’ndaki Resonance ile aynı görünümü kullanır; orada yapılan değişiklik hemen yansır',
      'Widget testleri bitince her şey testten önceki hâline döner (kupa, sayaç, anket, akış, sohbet)',
      'Kick hediye abonelikleri ve KICKs olayları artık yakalanır; kaldırılan varsayılan uyarı görselleri ve sesi değiştirildi',
      'Panel sadeleşti: düz yüzeyler, tek başlık, daha az yazı'
    ]
  },
  {
    surum: '1.9.0',
    ad: 'Komut Merkezi',
    tarih: '2026-10-29',
    notlar: [
      'Komutlar › Yerleşik Komutlar: botun 101 komutunun tümü (takma adlar, kullanım örnekleri), aç/kapat, yetki ve bekleme; !komutlar listesi buradan, !komutlar oyunlar gibi kategoriyle ayrıntı',
      'Subathon: duraklatılmış sayaca da elle süre eklenip çıkarılır; durum kartı yazıları ayarlanabilir',
      'Widget galerisi: önizleme widget’ı OBS’teki boyutunda açar (çok küçük görünmüyor), taşan içerik kesilmez; "Test et" widget bağlanınca gönderir; Shoutout ve Olay Etiketleri testleri düzeldi',
      'Hazır temalar renkle birlikte görünümü de değiştirir; hedef barlarında simge barla uyumlu rozet',
      '!sr: Spotify / YouTube Music açık değilse sohbete anlaşılır bildirim',
      'Emote kombo: toplanma ve saçılma kutunun içinde, rastgele yön/boy/düşüşle; skor tablosu yeni görünümler (TV yayını, neon, HUD) ve skor animasyonu',
      'Bağış kupası: doğal düşüş (yerçekimi, sekme) ve alttan düzgün dolan yığın; sohbette ayrı giriş/çıkış animasyonları, ödül/bağış satırları süre sonunda kaybolur',
      'Tek URL stüdyosu: kaldırılan widget önizlemede içeriğiyle görünmez'
    ]
  },
  {
    surum: '1.8.0',
    ad: 'Sohbet Görünümleri',
    tarih: '2026-10-28',
    notlar: [
      "Tek URL OBS Stüdyosu: yalnız seçili widget taşınır; başka widget'a tıklamak onu yalnız seçer, seçili widget üste alınır",
      'Sohbet yazı tipleri okunur: dar/süslü yazı tiplerinin boyutu dengelenir, gerçek kalın sürümler yüklenir; "Press Start 2P" ve "Exo 2" artık uygulanıyor',
      'Sohbet katmanına 8 görünüm stili (platform kartı, başlıklı, ad etiketi, konuşma balonu, platform şeridi, neon, kompakt, klasik) ve 8 yeni hazır tema; platformların özgün renkleri',
      "Twitch rozetleri düzeldi (çoğunun adresi bozuktu); jeton varsa kanalın kendi abone/bit rozetleri; Twitch kanal emote'ları, BTTV ve FFZ emote'ları",
      'Widget ayar penceresi: ayarlar geniş, önizleme sağda sabit; önizleme titremeden ve sohbette okunur ölçekte yakınlaşır'
    ]
  },
  {
    surum: '1.7.0',
    ad: 'Stüdyo Düzeni',
    tarih: '2026-10-28',
    notlar: [
      "Tek URL OBS Stüdyosu'nda TÜM katmanların ayarları açılır (sabitlenmiş mesaj, shoutout, izleyici sayacı, sıralama, sadakat, jenerik… eskiden açılmıyordu); kelime bulutu ve skor tablosu Tek URL'ye eklendi",
      'Sabitlenmiş mesaj: panelden kendi metnini yazıp sabitleme',
      'Emote kombo ayrı OBS sayfasında görünmüyordu (kutu genişliği 0) — düzeltildi',
      'Galeri testleri canlı önizlemede görünür ("Test et" önizlemeyi canlı kipe alır); sohbet, hedefler, etkinlik etiketleri, sabit mesaj, kral ve skor tablosuna test eklendi',
      'Canlı önizleme widget’a yakınlaşır (büyük görünür); tüm tuval / yakınlaş seçeneği',
      '!anketac virgülle de açılır: !anketac 60, Hangi oyun?, Valorant, CS2',
      'Subathon: takipler süreye eklenir (ayarlanabilir); Duraklat kalan süreyi saklar, bot kapalıyken süre akmaz, "Kaldığı yerden başlat" ile sonraki yayında sürer',
      'Müzik: gerçekte çalan şarkı (Spotify / YouTube Music) kapak fotoğrafı ve ilerlemeyle; "Now Playing" adları Resonance oldu',
      'Şarkı sözleri: sürüm seçimi çalan parçanın süresine göre (kayma düzeltmesi), senkron kaydırma ayarı, 6 yeni görünüm ve satır yazı tipi',
      'Yazı tipleri: ayarlardaki ve temalardaki tüm yazı tipleri OBS’te yüklenir; 24 yeni Türkçe karakterli yazı tipi; listede yazı tipleri kendi görünümüyle',
      'Temalar: widget’ın tanımadığı görünüm değeri artık yazılmaz (bozuk görünüm); 20 yeni tema (Nord, Dracula, Catppuccin, Synthwave, Lo-fi, Sakura, E-spor…)',
      "AxthrowA Studio'nun 'Hakkında' bölümünde AxBoT sürümü görünür"
    ]
  },
  {
    surum: '1.6.2',
    ad: 'Düzen',
    tarih: '2026-10-28',
    notlar: [
      'Anket sonucu yalnız süre gerçekten o an dolduysa sohbete yazılır (bot kapalıyken biten eski anket ertesi gün duyurulmaz)',
      'Anket sonucu Discord sunucusuna gitmez, yalnız yayın sohbetlerine yazılır',
      '!hatirlat yanıtı botun yeniden başlamasında hatırlatmanın iptal olacağını söyler'
    ]
  },
  {
    surum: '1.6.1',
    ad: 'Vitrin',
    tarih: '2026-10-28',
    notlar: [
      'İzleyici sayacında platform logoları (Kick, Twitch, YouTube); ayarlardan renkli noktaya dönülebilir',
      'Shoutout: 13 yeni tasarım (Yumuşak kart, Kabartma, Yalnız çerçeve, Haber bandı, Ufuk, Sahne ışığı, Kor, Sinyal, Etiket, Kurdele, Konuk kartı, Fosfor ekran, Prizma)',
      'Sabitlenmiş mesaj: 7 yeni tema (Sevimli, Terminal, Rahat, Piksel, Kompakt, Kapsül, HUD)',
      'Emoji kombosu: görsel stil seçimi (Piksel, Neon, Minimal)'
    ]
  },
  {
    surum: '1.6.0',
    ad: 'Tek Bot',
    tarih: '2026-10-28',
    notlar: [
      'Widget ayarları penceresinde canlı önizleme: ayar değişince OBS görünümü yanında güncellenir (uyarı kutusunda "Örnek göster")',
      'Yeni komutlar: !cevir (yapay zekâ ile çeviri), !lurk / !unlurk, !hatirlat 15dk <not>, !emotecount, !chatstats',
      'Moderatör komutları: !timer ac|kapat, !modul ac|kapat (oyunlar, sarki, yapayzeka, bilgi, market), !nukeusername, !srclear, !skortablo',
      'Twitch: !marker (yayın işareti) ve !commercial (reklam)',
      "Yeni widget'lar: Kelime Bulutu (sohbette en çok geçenler) ve Skor Tablosu (2-6 takım, sohbetten güncellenir)",
      'Kelime bulutu penceresinde sohbet istatistikleri: en çok yazanlar, saatlere göre yoğunluk, popüler kelimeler',
      'Değişkenler: $(lastfm kullanıcı) son dinlenen şarkı, $(steam kullanıcı oyun|durum|ad) — Entegrasyonlar › Oyun & Müzik Profilleri',
      'Şans çarkı: 28 renk paleti ve tema (gökkuşağı, tek renk tonları, slot, kart oyunu, neon, matrix, vegas…)',
      'Sohbet katmanına 12, ankete 11 yeni tema; izleyici sayacına Kadife, Borsa bandı, Holografik, Çevirmeli tabela görünümleri'
    ]
  },
  {
    surum: '1.5.0',
    ad: 'Tema Atölyesi',
    tarih: '2026-10-28',
    notlar: [
      'Hedef çubuğu: 25 oyun/film/mevsim teması (Cadılar Bayramı, Retro Arcade, Siberpunk, Fantastik RPG, Uzay, Korku…); renk geçişli/çizgili/parlak dolgu, çerçeve, dolgu ucunda simge',
      'Hedef çubuğu yazıları okunur: koyu gölge, binlik ayırıcı (46.700 / 50.000)',
      'Subathon sayacı: 6 görünüm (kart, minimal, dijital saat, çevirmeli kartlar, neon, tek satır) ve 18 tema',
      'Uyarı kutusu ayarlarında her olay (takip, abone, hediye abone, bağış, raid, KICKs, host) için ayrı GIF ve ses',
      'Sohbetten anket: !anketac [süre] Soru | A | B (yayıncı ve moderatörler) · !anketbitir; süre dolunca sonuç sohbete yazılır',
      'Sohbetten çekiliş: !cekilis [dk] [ödül] · !cekilisbitir (kazananı çeker) · !cekilisiptal (yayıncı ve moderatörler)',
      'Bağış kupası: simgeler kupaya homojen dolar (bir yerde kule, yanında boşluk kalmaz)',
      'Widget ayarları penceresi boşluğa tıklayınca ya da Esc ile kapanır',
      "Yapay zekâ: Groq'ta \"güncel bilgi\" kaldırılan groq/compound yerine gpt-oss internet aramasıyla çalışır (\"model bulunamadı\" hatası)"
    ]
  },
  {
    surum: '1.4.11',
    ad: 'Dengeli Masa',
    tarih: '2026-10-27',
    notlar: [
      'Şans oyunları dengeli: ortalamada bahsin %92-96 kadarı geri döner (eskiden slot %116, kasa açma %165, soygun ~%200 veriyordu; oynayarak sınırsız puan basılıyordu)',
      'Slot: üçlü 6 kat, ikili 1,5 kat · Kasa açma: efsanevi %2 · Bomba: doğru kablo 2,85 kat · Tek kişilik yarış %48 kazanma',
      'Soygun: hedefe göre %25-60 başarı, kâr 0,5-2,2 kat; ekip bonusu kişi başı %2 (en çok 3 kişi)',
      'Yazı-tura, zar, rulet ve düello zaten adil (yarı yarıya); değişmedi'
    ]
  },
  {
    surum: '1.4.10',
    ad: 'Kalıcı Bağ',
    tarih: '2026-10-27',
    notlar: [
      'Twitch: yeniden bağlanınca eski bağlantının geç kapanışı yeni bağlantıyı kopmuş göstermez (bot mesajları gitmiyor, bekçi her dakika yeniden bağlıyordu)',
      "AxthrowA Studio: kısıtlı yetkili uzak kullanıcı yalnız izinli uçlara erişir; Kick oturum dosyaları yarım yazılmaz (yeni AxthrowA Studio exe'si ister)"
    ]
  },
  {
    surum: '1.4.9',
    ad: 'Denetim',
    tarih: '2026-10-27',
    notlar: [
      'Bağış simülasyonu artık sadakat puanı vermez (her deneme 5000 puan yazıyordu)',
      'Kapatılan bağış uyarısı gerçek BynoGame/webhook bağışlarında da kapalı kalır',
      'Twitch ve Discord: botun mesajları panel sohbetinde bot hesabının adıyla görünür',
      "Twitch: çok satırlı bot yanıtı (yapay zekâ) tek satır olarak gider, kesilmez",
      'Düello daveti 2 dakika geçerli; eski davet saatler sonra istemeden kabul edilmez'
    ]
  },
  {
    surum: '1.4.8',
    ad: 'Gerçek Sohbet',
    tarih: '2026-10-27',
    notlar: [
      'Canlı sohbette botun mesajı yerel "AxBoT" kopyası olarak değil, sohbete gerçekten düşen hâliyle (platformdaki bot hesabının adıyla) görünür',
      "AxthrowA Studio taşınabilir kurulumda veritabanını dosyaya yazar (Dashboard 'no such table: app_meta' hatası; yeni AxthrowA Studio exe'si ister)"
    ]
  },
  {
    surum: '1.4.7',
    ad: 'Sıra + Sonraki',
    tarih: '2026-10-27',
    notlar: [
      "!sr isteği Spotify'da sıraya eklenip sonrakine geçilerek başlar (doğrudan \"çal\" komutu masaüstünü durduruyordu; yeni AxthrowA Studio exe'si ister)",
      'Spotify aramasında şarkı adı sorguyla eşleşen sonuç seçilir ("Tame Impala Loser" artık "Dracula" getirmez)',
      '"Resonance müzik çalarını aç" AxthrowA Studio içinde Müzik sekmesini açar',
      "Emote Kombo: gelen emote'lar uçup büyük emote'ta toplanır, büyük emote kombo büyüdükçe irileşir; kombo bitince emote'lar etrafa dağılıp kaybolur (ayarlardan kapatılabilir)",
      'Hazır temalara 14 oyun & film teması (Retro Arcade, Siberpunk, Fantastik RPG, Korku, Vahşi Batı, Kara Film, Çizgi Roman…) ve yazı tipleri',
      'Temalar artık hedef barı gibi kendi renk alanlarını kullanan widget\'lara da uygulanır (önceden bar rengi değişmiyordu)'
    ]
  },
  {
    surum: '1.4.6',
    ad: 'Doğru Cihaz',
    tarih: '2026-10-27',
    notlar: [
      "!sr isteği Spotify'da bu bilgisayardaki masaüstü uygulamasında çalar (başka/hayalet cihaza gidip masaüstünü durdurmaz; yeni AxthrowA Studio exe'si ister)",
      '"Resonance müzik çalarını aç" bağlantısı AxthrowA Studio içinde de açılır'
    ]
  },
  {
    surum: '1.4.5',
    ad: 'Güncel',
    tarih: '2026-10-27',
    notlar: [
      'Yapay zekâ "Güncel bilgi: internette ara" seçeneği: haber, maç skoru gibi sorularda internette arar (Groq: groq/compound, Gemini: Google Arama)',
      'Yapay zekâ bugünün tarihini bilir'
    ]
  },
  {
    surum: '1.4.4',
    ad: 'Her Çalarda',
    tarih: '2026-10-27',
    notlar: [
      "!sr istekleri hangi program açıksa (Spotify ya da YouTube Music Desktop) onda sıraya girer, çalan şarkı bitince kendiliğinden çalar",
      'Bot, isteği işlemeden önce AxthrowA Studio müzik durumunu tazeler (açılışta gelen ilk istek kaybolmaz)',
      'Yeni istek başlarken önceki/takılı kayıtlar kapanır; "Hemen çal" seçeneğinin çalan şarkıyı kestiği açıkça yazar'
    ]
  },
  {
    surum: '1.4.3',
    ad: 'Ücretsiz Zekâ',
    tarih: '2026-10-27',
    notlar: [
      "Groq varsayılan modeli openai/gpt-oss-120b (eski llama-3.3-70b-versatile 16 Ağustos 2026'da kapatıldı)",
      'OpenAI uyumlu sağlayıcılarda yanıt sınırı 1024 jeton (düşünen modeller boş cevap vermesin)'
    ]
  },
  {
    surum: '1.4.2',
    ad: 'Sağlam Sıra',
    tarih: '2026-10-27',
    notlar: [
      'Spotify kapalıyken gelen istek kaybolmaz; 30 sn sonra yeniden denenir (yalnız Spotify\'da bulunamayan istek kapanır)',
      'Kişi başına istek sınırı (varsayılan 2, Şarkı İsteği sayfasından ayarlanır; yayıncı ve mod muaf)',
      'Video kipine geçince bekleyen Spotify istekleri kuyrukta takılı kalmaz'
    ]
  },
  {
    surum: '1.4.1',
    ad: 'Sıradaki',
    tarih: '2026-10-27',
    notlar: [
      "!sr isteği çalan şarkıyı kesmez: AxthrowA Studio'daki Spotify'da istekler bot tarafında sıraya alınır, çalan şarkı bitmek üzereyken sıradaki başlar",
      'Sırada istek yoksa Spotify kendi akışıyla (rastgele/otomatik) çalmaya devam eder; istek başlayınca sohbete "Şimdi çalıyor" yazılır',
      'Şarkı Klipleri: video kipinde katman kendiliğinden açılır; kuyruk boşken Otomatik DJ önceki isteklerden rastgele çalar',
      'Atlamada sırada istek varsa doğrudan o başlar; Spotify API kipinde masaüstü uygulaması ayrıca açılmaz'
    ]
  },
  {
    surum: '1.4.0',
    ad: 'Düzen',
    tarih: '2026-10-26',
    notlar: [
      'Menü sadeleşti: 27 satır 12 ana sekmede toplandı; aynı konudaki sayfalar ana sekmenin içinde alt sekme',
      'Ana sekme, en son açtığın alt sayfayı hatırlar; başlıkta "Ana sekme › Alt sayfa" görünür',
      "Çark dilimleri kaydedilmemişse !cark çevrilmez ve puan düşmez (yayıncıya nasıl ayarlanacağı söylenir)",
      'Kapanış jeneriği KICKs gönderenleri destekçilerde gösterir',
      '"En büyük bağış" farklı para birimlerini karıştırmaz'
    ]
  },
  {
    surum: '1.3.4',
    ad: 'Kıyas',
    tarih: '2026-10-26',
    notlar: [
      'BynoGame/webhook bağışları olay kaydına yazılır: "Son bağış", "En büyük bağış" etiketleri ve kapanış jeneriği artık görür',
      'Kapanış jeneriği yalnız son N saati tarar (varsayılan 12), hediye abonelikleri sayar, test uyarılarını almaz',
      'Sohbet katmanında platform seçimi (Kick, Twitch, YouTube, TikTok, Trovo, Discord)',
      "Shoutout: belirli izleyici sayısının üstündeki raid/host'ta gelen yayıncı otomatik gösterilir",
      '!cark için bekleme süresi ve puan maliyeti widget ayarlarından ayarlanır'
    ]
  },
  {
    surum: '1.3.3',
    ad: 'Net Görüntü',
    tarih: '2026-10-26',
    notlar: [
      "Overlay Stüdyo önizlemesi: açık JumpScare katmanı tuvali kaplayıp tıklamaları yutuyordu; tam ekran katmanlar artık yalnız seçiliyken çizilir",
      'Kapalı katmanlar tuvali doldurmaz; yalnız seçilince (konumlandırmak için) soluk görünür'
    ]
  },
  {
    surum: '1.3.2',
    ad: 'İnce Ayar',
    tarih: '2026-10-26',
    notlar: ['Şarkı kuyruğu, adı benzer şarkıyı ("Hey" / "Hey Jude") yanlış eşleyip istekleri erken düşürmüyor']
  },
  {
    surum: '1.3.1',
    ad: 'Can Simidi',
    tarih: '2026-10-26',
    notlar: [
      'Sohbet Kurtarma mesajı artık gerçekten sohbete yazılıyor; yayın kapalıyken çalışmıyor (yapay zekâ kotası boşa gitmez)',
      'Sohbet Kurtarma seçili yapay zekâyı kullanır, !ai konuşma geçmişini kirletmez, yapay zekâ kapalıysa çağırmaz',
      'Kazanan çekilmeden yeni çekiliş açılırsa ücretli katılım puanları iade edilir'
    ]
  },
  {
    surum: '1.3.0',
    ad: 'Pusula',
    tarih: '2026-10-26',
    notlar: [
      'Hızlı Kurulum: platform → müzik → OBS → test uyarısı → yapay zekâ, durumlar canlı',
      'Başlıkta durum şeridi: Platform, Müzik, OBS, Yapay zekâ (tıklayınca ilgili sayfa)',
      'Menü üç gruba ayrıldı: Yayın sırasında, Etkileşim & Eğlence, Kurulum & Ayarlar',
      "Galeride her widget'a hızlı test; anket, çekiliş ve ödül widget'larının gerçek testi",
      "Spotify kartı, AxthrowA Studio'daki bağlantıyı gösterir (ikinci bağlantı gerekmez)"
    ]
  },
  {
    surum: '1.2.0',
    ad: 'Tek Sahne',
    tarih: '2026-10-26',
    notlar: [
      'Bot adı artık AxBoT (uygulama adı AxBoT)',
      "Tüm widget'lar tek OBS URL'sine eklenebilir; galeride \"Tek URL'ye ekle\" düğmesi",
      "Yeni Şarkı Klipleri widget'ı: !sr istekleri YouTube klibiyle OBS'te sırayla çalar",
      'Anket başlayınca tek URL katmanı kendiliğinden açılır; Kick panelinden başlatılan anket de görünür',
      "!sr, AxthrowA Studio'daki Spotify bağlantısını kullanır (sıraya ekleme yeni AxthrowA Studio exe'si ister; eski exe'de hemen çalar)",
      'Resonance içinde senkron şarkı sözleri (/resonance/lyrics)',
      'Yapay zekâ: Gemini yanında OpenAI, Claude, Groq, OpenRouter, DeepSeek, Mistral, xAI, Ollama ve özel adres',
      'Çıkış jeneriği yalnız o yayında gelen abone/destekçi/takipçileri gösterir (açılıp kapatılabilir)',
      'Düzeltmeler: etkinlik akışında abonelikler, şarkı kuyruğu eşleme, çalışmayan "AI toksisite" ayarı kaldırıldı'
    ]
  },
  {
    surum: '1.1.1',
    ad: 'Bekçi',
    tarih: '2026-10-23',
    notlar: [
      'Twitch/TikTok kopunca kendiliğinden yeniden bağlanır',
      'Puan ve seviye platforma göre ayrı',
      'İzleme süresi puanı, market TTS, bağış tutarı ve Trovo geçmişi düzeltmeleri'
    ]
  },
  {
    surum: '1.1.0',
    ad: 'Stüdyo',
    tarih: '2026-10-22',
    notlar: ['Overlay Stüdyo hizalama/yapışma, sohbet katmanı temizliği, 38 animasyon, çekiliş iyileştirmeleri']
  }
];

export const GUNCEL_SURUM = SURUMLER[0];
