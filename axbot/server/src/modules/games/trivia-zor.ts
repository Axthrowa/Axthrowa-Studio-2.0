/**
 * AxBoT — Bil Bakalım zor soru seti
 * Özgün sorular — Developed by AxthrowA
 *
 * Şablonla üretilmiş aşırı kolay sorular ("1925 ile 1929 arası kaç yıl?") bankadan atıldı (bkz. soru-kalite.ts);
 * yerlerine bilgi isteyen sorular. Kısa yazım: [kategori, soru, doğru cevap, çeldirici 1, 2, 3].
 * Doğru şıkkın harfi soru metninden türetilir: hep aynı harfe düşmez, her kurulumda aynıdır.
 */
import type { TriviaSeedItem } from './trivia-data.js';

type Kisa = [kategori: string, soru: string, dogru: string, c1: string, c2: string, c3: string];

const HARF = ['A', 'B', 'C', 'D'] as const;

/** Doğru cevabın yerleşeceği sıra (0-3): soru metninin basit özeti */
export function dogruSirasi(soru: string): number {
  let h = 0;
  for (const c of soru) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return h % 4;
}

export function kisadanSoru([category, question, dogru, c1, c2, c3]: Kisa): TriviaSeedItem {
  const sira = dogruSirasi(question);
  const siklar = [c1, c2, c3];
  siklar.splice(sira, 0, dogru);
  return {
    category: category as TriviaSeedItem['category'],
    question,
    optionA: siklar[0],
    optionB: siklar[1],
    optionC: siklar[2],
    optionD: siklar[3],
    correctOption: HARF[sira],
    points: 140,
    explanation: '',
    difficulty: 'hard',
  };
}

const SORULAR: Kisa[] = [
  // Tarih
  ['Tarih', 'Otuz Yıl Savaşları\'nı bitiren Vestfalya Barışı hangi yıl imzalandı?', '1648', '1618', '1555', '1713'],
  ['Tarih', 'İngiltere\'de kralın yetkilerini sınırlayan Magna Carta hangi yıl kabul edildi?', '1215', '1066', '1348', '1492'],
  ['Tarih', 'Tarihte bilinen ilk yazılı antlaşma sayılan Kadeş Antlaşması hangi iki devlet arasında yapıldı?', 'Mısır ve Hitit', 'Asur ve Babil', 'Pers ve Lidya', 'Roma ve Kartaca'],
  ['Tarih', 'Napolyon Savaşları\'ndan sonra Avrupa\'nın yeniden düzenlendiği Viyana Kongresi hangi yıl sonuçlandı?', '1815', '1789', '1848', '1871'],
  ['Tarih', 'Lozan Antlaşması hangi tarihte imzalandı?', '24 Temmuz 1923', '29 Ekim 1923', '10 Ağustos 1920', '30 Ekim 1918'],
  ['Tarih', 'Türkiye\'de kadınlar milletvekili seçme ve seçilme hakkını hangi yıl kazandı?', '1934', '1930', '1926', '1946'],
  ['Tarih', 'Türkiye\'de birden çok partinin katıldığı ilk genel seçim hangi yıl yapıldı?', '1946', '1950', '1930', '1960'],
  ['Tarih', 'Orhun (Göktürk) Yazıtları bugün hangi ülkenin sınırları içindedir?', 'Moğolistan', 'Kazakistan', 'Çin', 'Kırgızistan'],
  ['Tarih', '751 yılındaki Talas Savaşı hangi iki güç arasında yapıldı?', 'Abbasiler ve Çin (Tang)', 'Emeviler ve Bizans', 'Karahanlılar ve Samaniler', 'Göktürkler ve Sasaniler'],
  ['Tarih', 'Roma İmparatorluğu hangi yıl Doğu ve Batı olarak kalıcı biçimde ikiye ayrıldı?', '395', '476', '330', '1054'],
  ['Tarih', 'Batı Roma İmparatorluğu hangi yıl yıkıldı?', '476', '395', '410', '1453'],
  ['Tarih', 'Amerikan Bağımsızlık Bildirgesi hangi yıl ilan edildi?', '1776', '1789', '1783', '1812'],
  ['Tarih', '1402 Ankara Savaşı\'nda Yıldırım Bayezid kime yenildi?', 'Timur', 'Cengiz Han', 'Uzun Hasan', 'Şah İsmail'],
  ['Tarih', '1243 Kösedağ Savaşı\'nda Anadolu Selçukluları kime yenildi?', 'Moğollar', 'Bizans', 'Haçlılar', 'Memlükler'],
  ['Tarih', 'Anadolu\'nun Türk yurdu olduğunu kesinleştiren Miryokefalon Savaşı hangi yıl yapıldı?', '1176', '1071', '1243', '1299'],
  ['Tarih', 'Anadolu\'da kurulan ilk Türk beyliklerinden, merkezi Erzurum olan hangisidir?', 'Saltuklular', 'Mengücekliler', 'Danişmentliler', 'Artuklular'],
  ['Tarih', 'Madeni parayı ilk kullanan uygarlık hangisidir?', 'Lidyalılar', 'Frigler', 'Urartular', 'İyonlar'],
  ['Tarih', 'Hammurabi Kanunları hangi uygarlığa aittir?', 'Babil', 'Sümer', 'Asur', 'Hitit'],
  ['Tarih', 'Harf Devrimi hangi yıl yapıldı?', '1928', '1925', '1926', '1934'],
  ['Tarih', 'İsviçre\'den uyarlanan Türk Medeni Kanunu hangi yıl kabul edildi?', '1926', '1924', '1928', '1934'],
  ['Tarih', 'Berlin Duvarı hangi yıl yıkıldı?', '1989', '1991', '1987', '1985'],
  ['Tarih', 'Kavimler Göçü\'nü başlatan Hunlar hangi yüzyılda Avrupa\'ya yöneldi?', '4. yüzyıl', '1. yüzyıl', '7. yüzyıl', '10. yüzyıl'],

  // Osmanlı Tarihi
  ['Osmanlı Tarihi', 'Osmanlı\'nın ilk kez büyük toprak kaybettiği Karlofça Antlaşması hangi yıl imzalandı?', '1699', '1718', '1774', '1683'],
  ['Osmanlı Tarihi', 'Kırım\'ın Osmanlı\'dan ayrıldığı Küçük Kaynarca Antlaşması hangi yıl imzalandı?', '1774', '1699', '1792', '1829'],
  ['Osmanlı Tarihi', 'Tanzimat Fermanı hangi yıl ilan edildi?', '1839', '1856', '1876', '1808'],
  ['Osmanlı Tarihi', 'Islahat Fermanı hangi yıl ilan edildi?', '1856', '1839', '1876', '1826'],
  ['Osmanlı Tarihi', 'I. Meşrutiyet hangi padişah döneminde ilan edildi?', 'II. Abdülhamid', 'Abdülmecid', 'Abdülaziz', 'V. Mehmed Reşad'],
  ['Osmanlı Tarihi', 'Sened-i İttifak hangi padişah döneminde imzalandı?', 'II. Mahmud', 'III. Selim', 'Abdülmecid', 'IV. Mustafa'],
  ['Osmanlı Tarihi', 'Yeniçeri Ocağı\'nın kaldırıldığı Vaka-i Hayriye hangi yıl gerçekleşti?', '1826', '1808', '1839', '1789'],
  ['Osmanlı Tarihi', 'Osmanlı\'da Türkçe kitap basan ilk matbaayı kim kurdu?', 'İbrahim Müteferrika', 'Evliya Çelebi', 'Kâtip Çelebi', 'Şinasi'],
  ['Osmanlı Tarihi', 'Lale Devri hangi padişah döneminde yaşandı?', 'III. Ahmed', 'I. Mahmud', 'IV. Murad', 'III. Selim'],
  ['Osmanlı Tarihi', 'Lale Devri hangi antlaşmayla başlar?', 'Pasarofça', 'Karlofça', 'Zitvatorok', 'Belgrad'],
  ['Osmanlı Tarihi', '1517 Ridaniye Savaşı\'yla Mısır\'ı Osmanlı topraklarına katan padişah kimdir?', 'Yavuz Sultan Selim', 'Kanuni Sultan Süleyman', 'II. Bayezid', 'Fatih Sultan Mehmed'],
  ['Osmanlı Tarihi', '1538 Preveze Deniz Savaşı\'nda Osmanlı donanmasının komutanı kimdi?', 'Barbaros Hayreddin Paşa', 'Turgut Reis', 'Piri Reis', 'Kılıç Ali Paşa'],
  ['Osmanlı Tarihi', 'Osmanlı donanmasının büyük yenilgi aldığı İnebahtı Deniz Savaşı hangi yıl yapıldı?', '1571', '1538', '1522', '1683'],
  ['Osmanlı Tarihi', 'Edirne\'yi Osmanlı topraklarına katan padişah kimdir?', 'I. Murad', 'Orhan Bey', 'Yıldırım Bayezid', 'II. Murad'],
  ['Osmanlı Tarihi', 'Fetret Devri\'ni sona erdirip devleti yeniden toparlayan padişah kimdir?', 'I. Mehmed (Çelebi)', 'II. Murad', 'Musa Çelebi', 'Yıldırım Bayezid'],
  ['Osmanlı Tarihi', 'Osmanlı ilk dış borcunu hangi savaş sırasında aldı?', 'Kırım Savaşı', '93 Harbi', 'Balkan Savaşları', 'Trablusgarp Savaşı'],
  ['Osmanlı Tarihi', 'Osmanlı borçlarını yönetmek için kurulan Düyun-ı Umumiye hangi yıl kuruldu?', '1881', '1854', '1876', '1908'],
  ['Osmanlı Tarihi', 'Son Osmanlı padişahı kimdir?', 'VI. Mehmed Vahdettin', 'V. Mehmed Reşad', 'II. Abdülhamid', 'Abdülmecid Efendi'],
  ['Osmanlı Tarihi', 'İkinci Viyana Kuşatması hangi yıl yapıldı?', '1683', '1529', '1699', '1606'],
  ['Osmanlı Tarihi', 'Osmanlı\'da divan toplantılarına padişah adına başkanlık eden görevli kimdir?', 'Sadrazam', 'Defterdar', 'Nişancı', 'Kazasker'],

  // Coğrafya
  ['Coğrafya', 'Tamamı Türkiye sınırları içinde kalan en uzun nehir hangisidir?', 'Kızılırmak', 'Fırat', 'Sakarya', 'Yeşilırmak'],
  ['Coğrafya', 'Dünyanın en derin gölü hangisidir?', 'Baykal', 'Tanganika', 'Hazar', 'Superior'],
  ['Coğrafya', 'Dünyanın en uzun sıradağı hangisidir?', 'And Dağları', 'Himalayalar', 'Kayalık Dağlar', 'Alpler'],
  ['Coğrafya', 'Yüzölçümü bakımından dünyanın ikinci büyük ülkesi hangisidir?', 'Kanada', 'Çin', 'ABD', 'Brezilya'],
  ['Coğrafya', 'Avustralya\'nın başkenti neresidir?', 'Canberra', 'Sidney', 'Melbourne', 'Perth'],
  ['Coğrafya', 'Kanada\'nın başkenti neresidir?', 'Ottawa', 'Toronto', 'Montreal', 'Vancouver'],
  ['Coğrafya', 'Brezilya\'nın başkenti neresidir?', 'Brasília', 'Rio de Janeiro', 'São Paulo', 'Salvador'],
  ['Coğrafya', 'Yeni Zelanda\'nın başkenti neresidir?', 'Wellington', 'Auckland', 'Christchurch', 'Queenstown'],
  ['Coğrafya', 'Türkiye\'nin ikinci büyük gölü hangisidir?', 'Tuz Gölü', 'Beyşehir Gölü', 'Eğirdir Gölü', 'İznik Gölü'],
  ['Coğrafya', 'Ağrı Dağı\'nın yüksekliği yaklaşık kaç metredir?', '5137', '4058', '3917', '5895'],
  ['Coğrafya', 'Kutup çölleri de sayıldığında dünyanın en büyük çölü hangisidir?', 'Antarktika', 'Sahra', 'Gobi', 'Arabistan Çölü'],
  ['Coğrafya', 'Aşağıdaki Güney Amerika ülkelerinden hangisinin denize kıyısı yoktur?', 'Bolivya', 'Peru', 'Şili', 'Ekvador'],
  ['Coğrafya', 'Ekvator çizgisi aşağıdaki ülkelerden hangisinden geçer?', 'Endonezya', 'Hindistan', 'Mısır', 'Meksika'],
  ['Coğrafya', 'Türkiye\'nin en kuzey ucu neresidir?', 'İnceburun (Sinop)', 'Kerempe Burnu (Kastamonu)', 'Bafra Burnu (Samsun)', 'İğneada (Kırklareli)'],
  ['Coğrafya', 'Çin\'in kaç kara komşusu vardır?', '14', '9', '11', '17'],
  ['Coğrafya', 'Tuna Nehri hangi denize dökülür?', 'Karadeniz', 'Adriyatik', 'Baltık Denizi', 'Kuzey Denizi'],
  ['Coğrafya', 'Okyanusların bilinen en derin noktası hangisidir?', 'Mariana Çukuru', 'Porto Riko Çukuru', 'Java Çukuru', 'Tonga Çukuru'],
  ['Coğrafya', 'Türkiye\'nin yüzölçümü en büyük ili hangisidir?', 'Konya', 'Sivas', 'Ankara', 'Erzurum'],
  ['Coğrafya', 'İzlanda\'nın başkenti neresidir?', 'Reykjavik', 'Oslo', 'Helsinki', 'Kopenhag'],
  ['Coğrafya', 'Afrika\'nın en yüksek dağı hangisidir?', 'Kilimanjaro', 'Kenya Dağı', 'Atlas Dağları', 'Ruwenzori'],
  ['Coğrafya', 'Cebelitarık Boğazı hangi iki su kütlesini birbirine bağlar?', 'Akdeniz ve Atlas Okyanusu', 'Akdeniz ve Kızıldeniz', 'Karadeniz ve Ege', 'Kuzey Denizi ve Baltık'],
  ['Coğrafya', 'Türkiye kaç ülkeyle kara sınırına sahiptir?', '8', '6', '7', '9'],

  // Bilim
  ['Bilim', 'Işığın boşluktaki hızı saniyede yaklaşık kaç kilometredir?', '300.000', '150.000', '30.000', '1.000.000'],
  ['Bilim', 'Periyodik tabloda W simgesi hangi elemente aittir?', 'Tungsten', 'Vanadyum', 'Kurşun', 'Çinko'],
  ['Bilim', 'Periyodik tabloda Hg simgesi hangi elemente aittir?', 'Cıva', 'Gümüş', 'Magnezyum', 'Hafniyum'],
  ['Bilim', 'Periyodik tabloda K simgesi hangi elemente aittir?', 'Potasyum', 'Kalsiyum', 'Kripton', 'Kobalt'],
  ['Bilim', 'DNA\'nın çift sarmal yapısını 1953\'te açıklayan ikili kimdir?', 'Watson ve Crick', 'Mendel ve Darwin', 'Curie ve Becquerel', 'Bohr ve Rutherford'],
  ['Bilim', 'Mutlak sıfır kaç santigrat derecedir?', '-273,15', '-100', '-459,67', '0'],
  ['Bilim', 'Radyoaktiviteyi keşfeden bilim insanı kimdir?', 'Henri Becquerel', 'Marie Curie', 'Ernest Rutherford', 'Wilhelm Röntgen'],
  ['Bilim', 'Elektronu keşfeden bilim insanı kimdir?', 'J. J. Thomson', 'Niels Bohr', 'James Chadwick', 'John Dalton'],
  ['Bilim', 'Nötronu keşfeden bilim insanı kimdir?', 'James Chadwick', 'Ernest Rutherford', 'Enrico Fermi', 'J. J. Thomson'],
  ['Bilim', 'Penisilini keşfeden bilim insanı kimdir?', 'Alexander Fleming', 'Louis Pasteur', 'Robert Koch', 'Edward Jenner'],
  ['Bilim', 'Kanın pıhtılaşmasını sağlayan kan hücresi hangisidir?', 'Trombosit', 'Alyuvar', 'Akyuvar', 'Plazma'],
  ['Bilim', 'Sağlıklı bir insan hücresinde kaç kromozom bulunur?', '46', '23', '44', '48'],
  ['Bilim', 'Hücrede enerji üretiminden sorumlu organel hangisidir?', 'Mitokondri', 'Ribozom', 'Golgi aygıtı', 'Lizozom'],
  ['Bilim', 'Mohs sertlik ölçeğinde en sert mineral hangisidir?', 'Elmas', 'Korindon', 'Kuvars', 'Topaz'],
  ['Bilim', 'Pascal hangi büyüklüğün birimidir?', 'Basınç', 'Kuvvet', 'Enerji', 'Güç'],
  ['Bilim', 'Hertz hangi büyüklüğün birimidir?', 'Frekans', 'Direnç', 'Akım', 'Gerilim'],
  ['Bilim', 'Ses havada (20 °C) saniyede yaklaşık kaç metre yol alır?', '343', '1500', '120', '3000'],
  ['Bilim', 'Bir mol maddedeki tanecik sayısını veren sabit hangisidir?', 'Avogadro sayısı', 'Planck sabiti', 'Boltzmann sabiti', 'Faraday sabiti'],
  ['Bilim', 'İnsan vücudundaki en büyük organ hangisidir?', 'Deri', 'Karaciğer', 'Akciğer', 'Bağırsak'],
  ['Bilim', 'Atmosferde en çok bulunan gaz hangisidir?', 'Azot', 'Oksijen', 'Karbondioksit', 'Argon'],
  ['Bilim', 'Evrim kuramını "Türlerin Kökeni" kitabıyla ortaya koyan bilim insanı kimdir?', 'Charles Darwin', 'Gregor Mendel', 'Jean-Baptiste Lamarck', 'Alfred Wegener'],
  ['Bilim', 'Kıtaların kayması kuramını ortaya atan bilim insanı kimdir?', 'Alfred Wegener', 'Charles Lyell', 'Galileo Galilei', 'Johannes Kepler'],

  // Uzay
  ['Uzay', 'Güneş\'ten sonra Dünya\'ya en yakın yıldız hangisidir?', 'Proxima Centauri', 'Sirius', 'Betelgeuse', 'Vega'],
  ['Uzay', 'Güneş ışığı Dünya\'ya yaklaşık ne kadar sürede ulaşır?', '8 dakika', '8 saniye', '1 saat', '1 gün'],
  ['Uzay', 'Kendi ekseni etrafındaki dönüşü, Güneş çevresindeki turundan uzun süren gezegen hangisidir?', 'Venüs', 'Merkür', 'Mars', 'Uranüs'],
  ['Uzay', 'Güneş Sistemi\'nin en büyük uydusu hangisidir?', 'Ganymede', 'Titan', 'Ay', 'Europa'],
  ['Uzay', 'Güneş Sistemi\'nin en yüksek dağı Olympus Mons hangi gezegendedir?', 'Mars', 'Venüs', 'Merkür', 'Jüpiter'],
  ['Uzay', 'Mars\'ın uyduları hangileridir?', 'Phobos ve Deimos', 'Io ve Europa', 'Titan ve Rhea', 'Triton ve Nereid'],
  ['Uzay', 'Plüton hangi yıl cüce gezegen sınıfına alındı?', '2006', '1999', '2012', '1986'],
  ['Uzay', 'Uzaya çıkan ilk insan Yuri Gagarin bu uçuşu hangi yıl yaptı?', '1961', '1957', '1969', '1965'],
  ['Uzay', 'İlk yapay uydu Sputnik 1 hangi yıl fırlatıldı?', '1957', '1961', '1949', '1969'],
  ['Uzay', 'Bir kara deliğin ilk görüntüsü hangi yıl yayımlandı?', '2019', '2009', '2015', '2022'],
  ['Uzay', 'Samanyolu\'na en yakın büyük sarmal galaksi hangisidir?', 'Andromeda', 'Üçgen Galaksisi', 'Sombrero', 'Girdap Galaksisi'],
  ['Uzay', 'James Webb Uzay Teleskobu hangi yıl fırlatıldı?', '2021', '2018', '2015', '2023'],

  // Genel Kültür
  ['Genel Kültür', 'Nobel Barış Ödülü hangi şehirde verilir?', 'Oslo', 'Stockholm', 'Kopenhag', 'Cenevre'],
  ['Genel Kültür', 'Modern Olimpiyat Oyunları ilk kez hangi yıl ve şehirde yapıldı?', '1896, Atina', '1900, Paris', '1888, Londra', '1912, Stockholm'],
  ['Genel Kültür', 'UNESCO\'nun genel merkezi hangi şehirdedir?', 'Paris', 'New York', 'Cenevre', 'Viyana'],
  ['Genel Kültür', 'NATO\'nun genel merkezi hangi şehirdedir?', 'Brüksel', 'Washington', 'Paris', 'Lahey'],
  ['Genel Kültür', 'Maraton koşusunun resmi uzunluğu kaç kilometredir?', '42,195', '40', '45,5', '38,2'],
  ['Genel Kültür', 'İstiklal Marşı\'nın bestecisi kimdir?', 'Osman Zeki Üngör', 'Ali Rıfat Çağatay', 'Ulvi Cemal Erkin', 'Cemal Reşit Rey'],
  ['Genel Kültür', 'Türkiye Büyük Millet Meclisi hangi tarihte açıldı?', '23 Nisan 1920', '19 Mayıs 1919', '29 Ekim 1923', '30 Ağustos 1922'],
  ['Genel Kültür', 'Soyadı Kanunu hangi yıl kabul edildi?', '1934', '1928', '1925', '1938'],
  ['Genel Kültür', 'Ana dili olarak dünyada en çok konuşulan dil hangisidir?', 'Mandarin Çincesi', 'İngilizce', 'İspanyolca', 'Hintçe'],
  ['Genel Kültür', 'Roma rakamlarında D harfi hangi sayıyı gösterir?', '500', '50', '100', '1000'],
  ['Genel Kültür', 'Altın oranın yaklaşık değeri kaçtır?', '1,618', '3,141', '2,718', '1,414'],
  ['Genel Kültür', 'Türk alfabesinde kaç ünlü harf vardır?', '8', '6', '7', '9'],
  ['Genel Kültür', 'Uluslararası Adalet Divanı hangi şehirdedir?', 'Lahey', 'Cenevre', 'Strazburg', 'Brüksel'],
  ['Genel Kültür', 'Dünyanın yedi harikasından günümüze ulaşan tek yapı hangisidir?', 'Keops Piramidi', 'Rodos Heykeli', 'İskenderiye Feneri', 'Babil\'in Asma Bahçeleri'],
  ['Genel Kültür', 'Braille alfabesi hangi amaçla kullanılır?', 'Görme engellilerin okuması', 'İşitme engellilerin iletişimi', 'Denizcilikte işaretleşme', 'Telgraf haberleşmesi'],

  // Spor
  ['Spor', 'FIFA Dünya Kupası\'nı en çok kazanan ülke hangisidir?', 'Brezilya', 'Almanya', 'İtalya', 'Arjantin'],
  ['Spor', 'İlk FIFA Dünya Kupası hangi yıl ve ülkede düzenlendi?', '1930, Uruguay', '1934, İtalya', '1926, Brezilya', '1938, Fransa'],
  ['Spor', 'Türkiye A Millî Futbol Takımı Dünya Kupası\'nda üçüncülüğü hangi yıl elde etti?', '2002', '1954', '2008', '1998'],
  ['Spor', 'Galatasaray UEFA Kupası\'nı hangi yıl kazandı?', '2000', '1996', '2002', '1989'],
  ['Spor', 'Aşağıdakilerden hangisi teniste Grand Slam turnuvası değildir?', 'Indian Wells', 'Wimbledon', 'Roland Garros', 'Avustralya Açık'],
  ['Spor', 'Roland Garros tenis turnuvası hangi zeminde oynanır?', 'Toprak', 'Çim', 'Sert zemin', 'Halı'],
  ['Spor', 'Michael Schumacher Formula 1\'de kaç dünya şampiyonluğu kazandı?', '7', '5', '6', '8'],
  ['Spor', 'Usain Bolt\'un 100 metre dünya rekoru kaç saniyedir?', '9,58', '9,69', '9,79', '9,49'],
  ['Spor', 'Hentbolda bir takım sahada kaç oyuncuyla oynar?', '7', '6', '5', '8'],
  ['Spor', '"Cep Herkülü" lakaplı Naim Süleymanoğlu hangi spor dalında olimpiyat şampiyonu oldu?', 'Halter', 'Güreş', 'Boks', 'Judo'],
  ['Spor', 'Tour de France hangi spor dalının yarışıdır?', 'Bisiklet', 'Atletizm', 'Otomobil', 'Yelken'],
  ['Spor', 'Olimpik bir yüzme havuzunun uzunluğu kaç metredir?', '50', '25', '100', '33'],
  ['Spor', 'Futbolda Ballon d\'Or ödülünü en çok kazanan oyuncu kimdir?', 'Lionel Messi', 'Cristiano Ronaldo', 'Michel Platini', 'Johan Cruyff'],

  // Basketbol
  ['Basketbol', 'NBA tarihinde tek maçta 100 sayı atan oyuncu kimdir?', 'Wilt Chamberlain', 'Michael Jordan', 'Kobe Bryant', 'Kareem Abdul-Jabbar'],
  ['Basketbol', 'Michael Jordan Chicago Bulls ile kaç NBA şampiyonluğu kazandı?', '6', '5', '4', '7'],
  ['Basketbol', 'FIBA kurallarında bir çeyrek kaç dakikadır?', '10', '12', '8', '15'],
  ['Basketbol', 'NBA\'de forma giyen ilk Türk oyuncu kimdir?', 'Mirsad Türkcan', 'Hidayet Türkoğlu', 'Mehmet Okur', 'İbrahim Kutluay'],
  ['Basketbol', 'EuroLeague şampiyonluğunu kazanan ilk Türk takımı hangisidir?', 'Fenerbahçe', 'Anadolu Efes', 'Galatasaray', 'Beşiktaş'],
  ['Basketbol', 'Türkiye\'nin 2010 FIBA Dünya Şampiyonası\'ndaki derecesi nedir?', 'İkincilik', 'Şampiyonluk', 'Üçüncülük', 'Dördüncülük'],
  ['Basketbol', 'Basketbolda "triple-double" ne demektir?', 'Üç istatistikte çift haneye ulaşmak', 'Üst üste üç üçlük atmak', 'Üç çeyrekte 20 sayı atmak', 'Üç uzatma oynamak'],
  ['Basketbol', 'Basketbolu 1891\'de icat eden kişi kimdir?', 'James Naismith', 'Pierre de Coubertin', 'William Morgan', 'Abner Doubleday'],
  ['Basketbol', 'NBA\'de bir oyuncu kaç kişisel faulle oyun dışı kalır?', '6', '5', '4', '7'],
  ['Basketbol', 'NBA normal sezonunda bir takım kaç maç oynar?', '82', '72', '90', '66'],

  // Sanat
  ['Sanat', 'Guernica tablosu hangi ressama aittir?', 'Pablo Picasso', 'Salvador Dalí', 'Joan Miró', 'Francisco Goya'],
  ['Sanat', 'Çığlık tablosu hangi ressama aittir?', 'Edvard Munch', 'Vincent van Gogh', 'Gustav Klimt', 'Egon Schiele'],
  ['Sanat', 'İnci Küpeli Kız tablosu hangi ressama aittir?', 'Johannes Vermeer', 'Rembrandt', 'Frans Hals', 'Jan van Eyck'],
  ['Sanat', 'Eriyen saatleriyle tanınan "Belleğin Azmi" tablosu kime aittir?', 'Salvador Dalí', 'René Magritte', 'Pablo Picasso', 'Marc Chagall'],
  ['Sanat', 'Kaplumbağa Terbiyecisi tablosu hangi ressama aittir?', 'Osman Hamdi Bey', 'Şeker Ahmed Paşa', 'İbrahim Çallı', 'Hoca Ali Rıza'],
  ['Sanat', 'Mimar Sinan\'ın "ustalık eserim" dediği yapı hangisidir?', 'Selimiye Camii', 'Süleymaniye Camii', 'Şehzade Camii', 'Mihrimah Sultan Camii'],
  ['Sanat', 'Barselona\'daki Sagrada Família\'nın mimarı kimdir?', 'Antoni Gaudí', 'Le Corbusier', 'Frank Lloyd Wright', 'Santiago Calatrava'],
  ['Sanat', 'Empresyonizm akımına adını veren "İzlenim: Gün Doğumu" tablosu kime aittir?', 'Claude Monet', 'Édouard Manet', 'Auguste Renoir', 'Edgar Degas'],
  ['Sanat', 'Dört Mevsim adlı keman konçertolarının bestecisi kimdir?', 'Antonio Vivaldi', 'Johann Sebastian Bach', 'Wolfgang Amadeus Mozart', 'Joseph Haydn'],
  ['Sanat', 'Kuğu Gölü balesinin bestecisi kimdir?', 'Pyotr İlyiç Çaykovski', 'İgor Stravinski', 'Sergey Prokofyev', 'Frédéric Chopin'],
  ['Sanat', 'Sistine Şapeli\'nin tavan fresklerini kim yaptı?', 'Michelangelo', 'Raffaello', 'Leonardo da Vinci', 'Botticelli'],
  ['Sanat', 'Kübizm akımının Picasso ile birlikte kurucusu sayılan ressam kimdir?', 'Georges Braque', 'Henri Matisse', 'Paul Cézanne', 'Wassily Kandinsky'],

  // Edebiyat
  ['Edebiyat', 'Tutunamayanlar romanının yazarı kimdir?', 'Oğuz Atay', 'Yusuf Atılgan', 'Orhan Pamuk', 'Adalet Ağaoğlu'],
  ['Edebiyat', 'Saatleri Ayarlama Enstitüsü romanının yazarı kimdir?', 'Ahmet Hamdi Tanpınar', 'Peyami Safa', 'Sabahattin Ali', 'Yakup Kadri Karaosmanoğlu'],
  ['Edebiyat', 'Türk edebiyatının ilk romanı sayılan Taaşşuk-ı Talat ve Fitnat\'ın yazarı kimdir?', 'Şemsettin Sami', 'Namık Kemal', 'Ahmet Mithat Efendi', 'Recaizade Mahmut Ekrem'],
  ['Edebiyat', 'Nobel Edebiyat Ödülü\'nü kazanan ilk Türk yazar kimdir?', 'Orhan Pamuk', 'Yaşar Kemal', 'Aziz Nesin', 'Nâzım Hikmet'],
  ['Edebiyat', 'Yüzyıllık Yalnızlık romanının yazarı kimdir?', 'Gabriel García Márquez', 'Jorge Luis Borges', 'Mario Vargas Llosa', 'Pablo Neruda'],
  ['Edebiyat', 'Gregor Samsa\'nın bir sabah böceğe dönüşerek uyandığı eser hangisidir?', 'Dönüşüm', 'Dava', 'Şato', 'Bulantı'],
  ['Edebiyat', 'Sinekli Bakkal romanının yazarı kimdir?', 'Halide Edib Adıvar', 'Reşat Nuri Güntekin', 'Halit Ziya Uşaklıgil', 'Refik Halit Karay'],
  ['Edebiyat', 'Savaş ve Barış romanının yazarı kimdir?', 'Lev Tolstoy', 'Fyodor Dostoyevski', 'Anton Çehov', 'İvan Turgenyev'],
  ['Edebiyat', 'Kürk Mantolu Madonna\'nın yazarı kimdir?', 'Sabahattin Ali', 'Sait Faik Abasıyanık', 'Orhan Kemal', 'Kemal Tahir'],
  ['Edebiyat', 'Divan edebiyatında "Leyla ile Mecnun" mesnevisiyle tanınan şair kimdir?', 'Fuzûlî', 'Bâkî', 'Nedîm', 'Nef\'î'],

  // Sinema TV
  ['Sinema TV', 'Yabancı dilde çekilip En İyi Film Oscar\'ını kazanan ilk film hangisidir?', 'Parazit', 'Roma', 'Kaplan ve Ejderha', 'Hayat Güzeldir'],
  ['Sinema TV', 'Baba (The Godfather) filminin yönetmeni kimdir?', 'Francis Ford Coppola', 'Martin Scorsese', 'Sergio Leone', 'Brian De Palma'],
  ['Sinema TV', '2001: Bir Uzay Destanı filminin yönetmeni kimdir?', 'Stanley Kubrick', 'Ridley Scott', 'Steven Spielberg', 'George Lucas'],
  ['Sinema TV', '2014\'te Altın Palmiye kazanan Nuri Bilge Ceylan filmi hangisidir?', 'Kış Uykusu', 'Bir Zamanlar Anadolu\'da', 'Üç Maymun', 'Ahlat Ağacı'],
  ['Sinema TV', '1982\'de Altın Palmiye kazanan ve senaryosunu Yılmaz Güney\'in yazdığı film hangisidir?', 'Yol', 'Sürü', 'Umut', 'Duvar'],
  ['Sinema TV', 'Breaking Bad\'de Walter White\'ı canlandıran oyuncu kimdir?', 'Bryan Cranston', 'Aaron Paul', 'Bob Odenkirk', 'Giancarlo Esposito'],
  ['Sinema TV', 'Esaretin Bedeli filmi hangi yazarın eserinden uyarlanmıştır?', 'Stephen King', 'John Grisham', 'Ken Kesey', 'Thomas Harris'],
  ['Sinema TV', 'İlk sesli uzun metrajlı film sayılan yapım hangisidir?', 'The Jazz Singer', 'Metropolis', 'Modern Zamanlar', 'Yurttaş Kane'],
  ['Sinema TV', 'Sapık (Psycho) filminin yönetmeni kimdir?', 'Alfred Hitchcock', 'Orson Welles', 'Billy Wilder', 'Roman Polanski'],
  ['Sinema TV', 'Aşağıdaki filmlerden hangisi 11 Oscar kazanmamıştır?', 'Avatar', 'Titanic', 'Ben-Hur', 'Yüzüklerin Efendisi: Kralın Dönüşü'],
  ['Sinema TV', 'Taht Oyunları dizisi hangi yazarın kitap serisinden uyarlanmıştır?', 'George R. R. Martin', 'J. R. R. Tolkien', 'Andrzej Sapkowski', 'Brandon Sanderson'],
  ['Sinema TV', 'Yedinci Mühür filminin yönetmeni kimdir?', 'Ingmar Bergman', 'Federico Fellini', 'Andrey Tarkovski', 'Akira Kurosawa'],

  // Teknoloji
  ['Teknoloji', 'World Wide Web\'i icat eden kişi kimdir?', 'Tim Berners-Lee', 'Vint Cerf', 'Bill Gates', 'Steve Wozniak'],
  ['Teknoloji', 'Linux çekirdeğini ilk geliştiren kişi kimdir?', 'Linus Torvalds', 'Richard Stallman', 'Dennis Ritchie', 'Ken Thompson'],
  ['Teknoloji', 'Python programlama dilini kim geliştirdi?', 'Guido van Rossum', 'James Gosling', 'Bjarne Stroustrup', 'Brendan Eich'],
  ['Teknoloji', 'C programlama dilini kim geliştirdi?', 'Dennis Ritchie', 'Bjarne Stroustrup', 'Linus Torvalds', 'John Backus'],
  ['Teknoloji', 'Bir IPv4 adresi kaç bitten oluşur?', '32', '16', '64', '128'],
  ['Teknoloji', 'HTTPS\'in varsayılan port numarası kaçtır?', '443', '80', '22', '8080'],
  ['Teknoloji', 'İlk bilgisayar programcısı olarak kabul edilen kişi kimdir?', 'Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Charles Babbage'],
  ['Teknoloji', 'İlk iPhone hangi yıl tanıtıldı?', '2007', '2005', '2008', '2010'],
  ['Teknoloji', 'Bitcoin\'in yaratıcısının kullandığı takma ad nedir?', 'Satoshi Nakamoto', 'Vitalik Buterin', 'Hal Finney', 'Nick Szabo'],
  ['Teknoloji', 'Moore Yasası neyi öngörür?', 'Çipteki transistör sayısının yaklaşık iki yılda ikiye katlanmasını', 'İnternet hızının her yıl ikiye katlanmasını', 'Depolama fiyatının her yıl yarıya inmesini', 'Pil ömrünün on yılda ikiye katlanmasını'],
  ['Teknoloji', 'SQL kısaltmasının açılımı nedir?', 'Structured Query Language', 'Simple Question Language', 'System Queue Logic', 'Standard Query Layer'],
  ['Teknoloji', 'SSH\'nin varsayılan port numarası kaçtır?', '22', '21', '25', '23'],
  ['Teknoloji', 'JavaScript dilini 1995\'te kim geliştirdi?', 'Brendan Eich', 'James Gosling', 'Tim Berners-Lee', 'Guido van Rossum'],

  // Oyunlar
  ['Oyunlar', 'Mario karakteri ilk kez hangi oyunda göründü?', 'Donkey Kong', 'Super Mario Bros.', 'Mario Bros.', 'Wrecking Crew'],
  ['Oyunlar', 'The Witcher oyun serisini geliştiren stüdyo hangisidir?', 'CD Projekt Red', 'BioWare', 'Bethesda', 'Ubisoft'],
  ['Oyunlar', 'Dark Souls serisini geliştiren stüdyo hangisidir?', 'FromSoftware', 'Capcom', 'Square Enix', 'Konami'],
  ['Oyunlar', 'Tetris\'i tasarlayan kişi kimdir?', 'Alexey Pajitnov', 'Shigeru Miyamoto', 'Hideo Kojima', 'Sid Meier'],
  ['Oyunlar', 'The Legend of Zelda serisinde oyuncunun yönettiği kahramanın adı nedir?', 'Link', 'Zelda', 'Ganon', 'Epona'],
  ['Oyunlar', 'Tüm zamanların en çok satan oyun konsolu hangisidir?', 'PlayStation 2', 'Nintendo DS', 'Nintendo Switch', 'PlayStation 4'],
  ['Oyunlar', 'Dota 2\'nin yıllık dünya şampiyonasının adı nedir?', 'The International', 'Worlds', 'Major', 'Champions'],
  ['Oyunlar', 'The Last of Us\'ı geliştiren stüdyo hangisidir?', 'Naughty Dog', 'Santa Monica Studio', 'Insomniac Games', 'Guerrilla Games'],
  ['Oyunlar', 'Elden Ring\'in dünya kurgusuna katkı veren yazar kimdir?', 'George R. R. Martin', 'Neil Gaiman', 'Stephen King', 'Andrzej Sapkowski'],
  ['Oyunlar', 'Half-Life serisini geliştiren şirket hangisidir?', 'Valve', 'id Software', 'Epic Games', 'Blizzard'],
  ['Oyunlar', 'Pac-Man hangi yıl piyasaya çıktı?', '1980', '1975', '1985', '1990'],
  ['Oyunlar', 'League of Legends\'ın ana haritasının adı nedir?', 'Sihirdar Vadisi', 'Uluyan Uçurum', 'Dust II', 'Verdansk'],
  ['Oyunlar', 'Metal Gear Solid serisinin yaratıcısı kimdir?', 'Hideo Kojima', 'Shinji Mikami', 'Hidetaka Miyazaki', 'Yu Suzuki'],

  // Ekonomi
  ['Ekonomi', '"Ulusların Zenginliği" kitabının yazarı kimdir?', 'Adam Smith', 'David Ricardo', 'John Maynard Keynes', 'Karl Marx'],
  ['Ekonomi', '1929 Büyük Buhranı hangi ülkedeki borsa çöküşüyle başladı?', 'ABD', 'İngiltere', 'Almanya', 'Fransa'],
  ['Ekonomi', 'IMF ve Dünya Bankası\'nın kurulmasına yol açan 1944 konferansı hangisidir?', 'Bretton Woods', 'Yalta', 'Potsdam', 'San Francisco'],
  ['Ekonomi', 'Durgunluk ile yüksek enflasyonun aynı anda yaşanmasına ne ad verilir?', 'Stagflasyon', 'Deflasyon', 'Resesyon', 'Devalüasyon'],
  ['Ekonomi', 'Türk lirasından altı sıfır hangi yıl atıldı?', '2005', '2001', '2009', '1999'],
  ['Ekonomi', 'OPEC\'in genel merkezi hangi şehirdedir?', 'Viyana', 'Riyad', 'Cenevre', 'Dubai'],
  ['Ekonomi', '"İstihdam, Faiz ve Paranın Genel Teorisi" kitabının yazarı kimdir?', 'John Maynard Keynes', 'Milton Friedman', 'Friedrich Hayek', 'Joseph Schumpeter'],
  ['Ekonomi', 'Bir ülkenin parasının değerinin resmî kararla düşürülmesine ne denir?', 'Devalüasyon', 'Revalüasyon', 'Enflasyon', 'Konsolidasyon'],
  ['Ekonomi', 'Euro banknot ve madeni paraları hangi yıl tedavüle girdi?', '2002', '1999', '1995', '2005'],
  ['Ekonomi', 'Gelir dağılımındaki eşitsizliği ölçen katsayı hangisidir?', 'Gini katsayısı', 'Beta katsayısı', 'Sharpe oranı', 'Engel katsayısı'],
];

export const TRIVIA_ZOR_SORULAR: TriviaSeedItem[] = SORULAR.map(kisadanSoru);
