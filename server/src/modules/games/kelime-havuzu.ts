/**
 * StreamAxT — !kelime oyununun kelime havuzu ve harf karıştırma (saf)
 * Developed by AxthrowA
 *
 * Eskiden 11 kelime vardı ve "karışık" harfler elle yazılmıştı: çoğu kelimenin kendisiydi
 * ("K - I - C - K"), biri yanlış harf içeriyordu. Harfler artık her turda karıştırılır.
 */
export interface Kelime {
  kelime: string;
  ipucu: string;
}

const grup = (ipucuOnu: string, liste: Array<[string, string]>): Kelime[] =>
  liste.map(([kelime, ipucu]) => ({ kelime, ipucu: `${ipucuOnu}: ${ipucu}` }));

export const KELIMELER: Kelime[] = [
  ...grup('Yayın', [
    ['yayıncı', 'ekrandaki kişi'], ['abonelik', 'kanala aylık destek'], ['moderatör', 'sohbetin düzenini sağlar'],
    ['takipçi', 'kanalı izlemeye alan'], ['izleyici', 'yayını seyreden'], ['sohbet', 'yazışılan bölüm'],
    ['kulaklık', 'sesi kulağa verir'], ['mikrofon', 'sesi alır'], ['klavye', 'tuşlarla yazılır'],
    ['kamera', 'görüntü alır'], ['monitör', 'görüntü verir'], ['bağış', 'yayıncıya verilen para'],
    ['stüdyo', 'çekimin yapıldığı oda'], ['kanal', 'yayınların yapıldığı sayfa'], ['sahne', 'OBS ekran düzeni'],
    ['emote', 'sohbette kullanılan küçük görsel'], ['çekiliş', 'rastgele kazanan seçilir'], ['anket', 'oylama']
  ]),
  ...grup('Oyun', [
    ['oyuncu', 'oyunu oynayan'], ['görev', 'tamamlanması gereken iş'], ['karakter', 'oyunda yönetilen kişi'],
    ['harita', 'oyunda yol gösterir'], ['envanter', 'eşyaların durduğu yer'], ['seviye', 'ilerledikçe artar'],
    ['düello', 'iki kişilik kapışma'], ['turnuva', 'elemeli yarışma'], ['kılıç', 'keskin silah'],
    ['zırh', 'vücudu korur'], ['ejderha', 'ateş püskürten yaratık'], ['büyücü', 'sihir yapar'],
    ['satranç', 'şah ve vezir'], ['tavla', 'zar ve pul'], ['bilmece', 'çözülmesi gereken soru'],
    ['kasa', 'içinden eşya çıkar'], ['şövalye', 'at üstünde savaşçı'], ['korsan', 'denizlerin haydudu']
  ]),
  ...grup('Hayvan', [
    ['kaplan', 'çizgili yırtıcı'], ['zürafa', 'en uzun boyunlu'], ['penguen', 'uçamayan kutup kuşu'],
    ['kartal', 'yırtıcı kuş'], ['tavşan', 'uzun kulaklı'], ['kirpi', 'dikenli'],
    ['kaplumbağa', 'evini sırtında taşır'], ['yunus', 'zeki deniz canlısı'], ['aslan', 'ormanlar kralı'],
    ['sincap', 'fındık saklar'], ['baykuş', 'geceleri öter'], ['timsah', 'sulak yerlerin sürüngeni'],
    ['kelebek', 'tırtıldan dönüşür'], ['deve', 'hörgüçlü'], ['ahtapot', 'sekiz kollu'],
    ['papağan', 'konuşmayı taklit eder'], ['fil', 'hortumlu'], ['kurt', 'sürüyle avlanır']
  ]),
  ...grup('Yemek', [
    ['baklava', 'şerbetli tatlı'], ['lahmacun', 'ince hamurlu kıymalı'], ['mantı', 'yoğurtla yenir'],
    ['karpuz', 'yaz meyvesi'], ['simit', 'susamlı halka'], ['çorba', 'kaşıkla içilir'],
    ['kebap', 'ızgara et'], ['künefe', 'peynirli tatlı'], ['dondurma', 'soğuk tatlı'],
    ['pilav', 'pirinç yemeği'], ['börek', 'yufkalı hamur işi'], ['domates', 'salatanın kırmızısı'],
    ['ayran', 'yoğurtlu içecek'], ['çikolata', 'kakaodan yapılır'], ['patates', 'kızartması sevilir'],
    ['zeytin', 'kahvaltının siyahı'], ['portakal', 'C vitamini deposu'], ['salata', 'yeşillikli yemek']
  ]),
  ...grup('Meslek', [
    ['doktor', 'hasta bakar'], ['öğretmen', 'ders anlatır'], ['mühendis', 'tasarlar ve hesaplar'],
    ['aşçı', 'yemek yapar'], ['pilot', 'uçak kullanır'], ['itfaiyeci', 'yangın söndürür'],
    ['berber', 'saç keser'], ['avukat', 'mahkemede savunur'], ['terzi', 'kıyafet diker'],
    ['fırıncı', 'ekmek yapar'], ['ressam', 'tablo yapar'], ['şoför', 'araç kullanır'],
    ['eczacı', 'ilaç verir'], ['astronot', 'uzaya çıkar'], ['çiftçi', 'toprağı ekip biçer']
  ]),
  ...grup('Doğa', [
    ['gökkuşağı', 'yağmur sonrası renkler'], ['volkan', 'lav püskürtür'], ['şelale', 'yüksekten dökülen su'],
    ['orman', 'ağaçlarla kaplı'], ['çöl', 'kumlu ve kurak'], ['buzul', 'dev buz kütlesi'],
    ['fırtına', 'sert rüzgar'], ['deprem', 'yer sarsıntısı'], ['ırmak', 'akarsu'],
    ['deniz', 'tuzlu su'], ['bulut', 'gökyüzünde süzülür'], ['şimşek', 'gökte çakar'],
    ['yıldız', 'geceleri parlar'], ['güneş', 'gündüzün ışığı'], ['mağara', 'dağın içindeki oyuk']
  ]),
  ...grup('Teknoloji', [
    ['bilgisayar', 'kasa ve ekran'], ['telefon', 'cepte taşınır'], ['internet', 'dünyayı bağlayan ağ'],
    ['şifre', 'hesabı korur'], ['yazılım', 'kodla yazılır'], ['robot', 'programlı makine'],
    ['uydu', 'dünyanın çevresinde döner'], ['ekran', 'görüntü burada'], ['kablo', 'bağlantı teli'],
    ['uçak', 'gökyüzünde yolcu taşır'], ['batarya', 'enerji depolar'], ['tablet', 'dokunmatik ve büyük ekranlı']
  ]),
  ...grup('Eşya', [
    ['şemsiye', 'yağmurdan korur'], ['anahtar', 'kapı açar'], ['makas', 'kesmeye yarar'],
    ['ayna', 'yansıtır'], ['saat', 'zamanı gösterir'], ['gözlük', 'görmeye yardım eder'],
    ['bavul', 'yolculukta taşınır'], ['kalem', 'yazı yazar'], ['defter', 'içine not alınır'],
    ['yastık', 'başın altına konur'], ['merdiven', 'basamaklı'], ['pusula', 'kuzeyi gösterir'],
    ['çekiç', 'çivi çakar'], ['battaniye', 'üşüyünce örtülür'], ['terlik', 'evde giyilir']
  ]),
  ...grup('Spor', [
    ['futbol', 'on bir kişilik'], ['basketbol', 'pota ve top'], ['voleybol', 'file üzerinden'],
    ['tenis', 'raket ve sarı top'], ['güreş', 'er meydanında'], ['yüzme', 'havuzda yapılır'],
    ['kaleci', 'kaleyi korur'], ['hakem', 'düdük çalar'], ['maraton', '42 kilometre'],
    ['okçuluk', 'yay ve hedef'], ['boks', 'eldivenle ringde'], ['kayak', 'karda kayılır']
  ]),
  ...grup('Yer', [
    ['istanbul', 'iki kıtalı şehir'], ['ankara', 'başkent'], ['kapadokya', 'peri bacaları'],
    ['pamukkale', 'beyaz travertenler'], ['antalya', 'turizm başkenti'], ['trabzon', 'Karadeniz şehri'],
    ['japonya', 'güneşin doğduğu ülke'], ['mısır', 'piramitler ülkesi'], ['almanya', 'başkenti Berlin'],
    ['brezilya', 'samba ülkesi'], ['fransa', 'Eyfel Kulesi'], ['italya', 'çizme biçimli ülke']
  ])
];

/** Harfleri karıştırır; sonuç kelimenin kendisi olmaz. */
export function harfleriKaristir(kelime: string, rastgele: () => number = Math.random): string[] {
  const harfler = [...kelime];
  // Karıştırma nadiren aynı sırayı verebilir: birkaç deneme, sonra iki farklı harfi değiştirir
  for (let deneme = 0; deneme < 8; deneme++) {
    for (let i = harfler.length - 1; i > 0; i--) {
      const j = Math.floor(rastgele() * (i + 1));
      [harfler[i], harfler[j]] = [harfler[j], harfler[i]];
    }
    if (harfler.join('') !== kelime) return harfler;
  }
  const j = harfler.findIndex((h) => h !== harfler[0]);
  if (j > 0) [harfler[0], harfler[j]] = [harfler[j], harfler[0]];
  return harfler;
}

/** Sohbette gösterilen biçim: `K - İ - R - P - İ` */
export function karisikMetin(kelime: string, rastgele: () => number = Math.random): string {
  return harfleriKaristir(kelime, rastgele).map((h) => h.toLocaleUpperCase('tr-TR')).join(' - ');
}

/** Son kullanılan kelimeler dışından seçer (havuz tükenirse hepsinden). */
export function kelimeSec(son: string[], rastgele: () => number = Math.random, havuz: Kelime[] = KELIMELER): Kelime {
  const uygun = havuz.filter((k) => !son.includes(k.kelime));
  const liste = uygun.length ? uygun : havuz;
  return liste[Math.floor(rastgele() * liste.length)];
}
