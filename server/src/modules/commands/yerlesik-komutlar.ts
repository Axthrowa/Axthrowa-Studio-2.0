/**
 * StreamAxT — yerleşik komutların tek listesi
 * Developed by AxthrowA
 *
 * Sohbetteki `!komutlar`, panelin Komutlar › Yerleşik Komutlar sekmesi ve komut ayarları (aç/kapat, yetki,
 * bekleme) buradan okunur. Eskiden panelde elle yazılmış 37 satırlık ayrı bir liste vardı (101 komutun
 * çoğu görünmüyordu), `!komutlar` ise 7 sabit ad yazıyordu. `executeBuiltIn`'e yeni komut eklenince
 * buraya da eklenmeli — `yerlesik-komutlar.test.ts` eksik olanı yakalar.
 */

export type KomutYetkisi = 'herkes' | 'mod' | 'yayinci';

export interface YerlesikKomut {
  /** Asıl ad (ayarlar bu adla tutulur) */
  ad: string;
  takma: string[];
  kategori: string;
  /** Kimin kullanabildiği; `modEk`: herkes kullanır, mod/yayıncının ek alt komutları var */
  yetki: KomutYetkisi;
  modEk?: boolean;
  aciklama: string;
  kullanim?: string;
}

const k = (
  ad: string,
  takma: string[],
  kategori: string,
  yetki: KomutYetkisi,
  aciklama: string,
  kullanim?: string,
  modEk?: boolean
): YerlesikKomut => ({ ad, takma, kategori, yetki, aciklama, ...(kullanim ? { kullanim } : {}), ...(modEk ? { modEk } : {}) });

export const YERLESIK_KOMUTLAR: YerlesikKomut[] = [
  // Ekonomi & sadakat
  k('puan', ['bakiye', 'points'], 'Ekonomi', 'herkes', 'Puanını gösterir'),
  k('profil', ['seviye', 'rank', 'sadakat', 'level'], 'Ekonomi', 'herkes', 'Sadakat profili ve rütbe'),
  k('liderlik', ['top', 'siralamasi', 'leaderboard'], 'Ekonomi', 'herkes', 'Puan sıralaması (ilk 5)'),
  k('market', ['magaza', 'store', 'shop'], 'Ekonomi', 'herkes', 'Sadakat mağazasındaki ödüller'),
  k('al', ['buy', 'redeem'], 'Ekonomi', 'herkes', 'Mağazadan ödül al', '!al <ödül adı>'),
  k('puangonder', ['transfer', 'gonder'], 'Ekonomi', 'herkes', 'Başka izleyiciye puan gönder', '!puangonder @kullanıcı 100'),
  k('puanver', ['puanekle', 'givepoints'], 'Ekonomi', 'yayinci', 'İzleyiciye puan ver ya da al (eksi sayı)', '!puanver @kullanıcı 500'),
  k('pdrops', ['puandususu'], 'Ekonomi', 'herkes', 'Puan düşüşü durumu · yetkili başlatır/durdurur', '!pdrops · !pdrops start', true),
  k('seviye2', ['xp'], 'Ekonomi', 'herkes', 'XP seviyesi ve ilerleme', '!xp [@kullanıcı]'),
  k('seviyeler', ['toplevel'], 'Ekonomi', 'herkes', 'Seviye sıralaması'),
  k('watchtime', ['izleme'], 'Ekonomi', 'herkes', 'İzleme süresi', '!izleme [@kullanıcı]'),

  // Mini oyunlar
  k('oyunlar', ['games'], 'Oyunlar', 'herkes', 'Mini oyun listesi'),
  k('slot', ['slots'], 'Oyunlar', 'herkes', 'Slot makinesi', '!slot 25'),
  k('rulet', ['roulette'], 'Oyunlar', 'herkes', 'Rulet', '!rulet 50 · !rulet hepsi'),
  k('duello', ['duel'], 'Oyunlar', 'herkes', 'Puanına düello', '!duello @kullanıcı <puan>'),
  k('soygun', ['heist'], 'Oyunlar', 'herkes', 'Ortak soygun', '!soygun 50 · !soygun hepsi'),
  k('yaris', ['race', 'drag'], 'Oyunlar', 'herkes', 'Yarışa katıl', '!yaris 50'),
  k('balik', ['avla', 'fish'], 'Oyunlar', 'herkes', 'Balık tut'),
  k('kasaac', ['kasa', 'case'], 'Oyunlar', 'herkes', 'Kasa aç'),
  k('bomba', ['c4'], 'Oyunlar', 'herkes', 'Bomba al (40 puan), sonra doğru kabloyu kes', '!bomba'),
  k('kes', ['cut'], 'Oyunlar', 'herkes', 'Bombanın kablosunu kes', '!kes kirmizi|mavi|yesil'),
  k('yazitura', ['cf', 'coinflip'], 'Oyunlar', 'herkes', 'Yazı tura', '!yazitura tura 50'),
  k('zar', ['dice'], 'Oyunlar', 'herkes', 'Zar at', '!zar 50'),
  k('8ball', ['kure'], 'Oyunlar', 'herkes', 'Sihirli küre soruna cevap verir', '!8ball <soru>'),
  k('kelime', ['anagram'], 'Oyunlar', 'herkes', 'Karışık harflerden kelime bulmaca'),
  k('cark', ['wheel'], 'Oyunlar', 'herkes', 'Şans çarkını çevir (puan karşılığı olabilir)'),
  k('bahis', ['bet'], 'Oyunlar', 'herkes', 'Topluluk bahsi · mod: !bahis ac Soru | A | B', '!bahis <seçenek> <puan>', true),
  k('bingo', [], 'Oyunlar', 'herkes', 'Emote bingosu · mod: !bingo baslat', undefined, true),
  k('kappagen', ['emotepatlat'], 'Oyunlar', 'herkes', 'Emote patlat (ücretliyse herkes, değilse mod)', '!kappagen KEKW'),

  // Bilgi yarışması
  k('soru', ['trivia', 'bilgi', 'bilgiyarismasi'], 'Bil Bakalım', 'herkes', 'Yeni soru sor (kategori verilebilir)', '!soru tarih'),
  k('yarisma', ['turnuva'], 'Bil Bakalım', 'herkes', 'Çok sorulu yarışma · mod durdurur', '!yarisma 10', true),
  k('soruatla', ['sorubitir', 'pas'], 'Bil Bakalım', 'mod', 'Aktif soruyu atla'),
  k('triviaskor', ['skor'], 'Bil Bakalım', 'herkes', 'Bil Bakalım puanın'),
  k('triviatop', ['bilgitop'], 'Bil Bakalım', 'herkes', 'Bil Bakalım ilk 5'),

  // Yayın kralı
  k('kral', ['taht', 'king'], 'Krallık', 'herkes', 'Tahtın sahibi ve hüküm süresi'),
  k('tahtikap', ['claimthrone', 'claimking'], 'Krallık', 'herkes', 'Puanla tahtı kap', '!tahtikap <puan>'),
  k('tahttan_in', ['abdicate'], 'Krallık', 'mod', 'Tahtı sıfırla'),

  // Şarkı
  k('sr', ['songrequest', 'sarkiiste'], 'Şarkı', 'herkes', 'Şarkı iste (ad, YouTube/Spotify linki)', '!sr Teoman Paramparça'),
  k('sarki', ['song', 'currentsong'], 'Şarkı', 'herkes', 'Şu an çalan şarkı'),
  k('sira', ['queue'], 'Şarkı', 'herkes', 'Sıradaki şarkılar'),
  k('when', ['sarkisiram'], 'Şarkı', 'herkes', 'İsteğinin sırası'),
  k('wrongsong', ['yanlissarki'], 'Şarkı', 'herkes', 'Son isteğini geri al'),
  k('atla', ['skip', 'voteskip'], 'Şarkı', 'herkes', 'Atlama oyu · mod hemen atlar', undefined, true),
  k('removesong', ['sarkisil'], 'Şarkı', 'mod', 'Sıradan şarkı sil', '!removesong <sıra no | @kullanıcı>'),
  k('srclear', ['sirabosalt'], 'Şarkı', 'mod', 'Şarkı sırasını temizle (çalan sürer)'),

  // Ses panosu
  k('ses', ['blerp'], 'Ses', 'herkes', 'Ses/klip çal', '!ses alkış'),
  k('sesler', [], 'Ses', 'herkes', 'Çalınabilir sesler'),
  k('sesgec', [], 'Ses', 'mod', 'Çalan sesi atla'),

  // Çekiliş & anket
  k('katil', ['join'], 'Çekiliş', 'herkes', 'Açık çekilişe katıl'),
  k('cekilis', ['cekilisac', 'giveaway'], 'Çekiliş', 'mod', 'Çekiliş başlat', '!cekilis 5 Steam kodu'),
  k('cekilisbitir', ['cekiliscek'], 'Çekiliş', 'mod', 'Kazananı çek'),
  k('cekilisiptal', [], 'Çekiliş', 'mod', 'Çekilişi kazanansız kapat (ücretli katılım iade)'),
  k('winner', ['kazanan'], 'Çekiliş', 'mod', 'Sohbetten rastgele kazanan seç'),
  k('anketac', ['poll'], 'Anket', 'mod', 'Anket başlat', '!anketac 60, Hangi oyun?, Valorant, CS2'),
  k('anketbitir', ['anketkapat', 'endpoll'], 'Anket', 'mod', 'Anketi kapat, sonucu yaz'),
  k('oy', ['vote', 'anket'], 'Anket', 'herkes', 'Ankette oy ver', '!oy 1'),

  // İzleyici kuyruğu
  k('joinq', ['sirayagir'], 'Kuyruk', 'herkes', 'Oyun/izleyici kuyruğuna gir'),
  k('leaveq', ['siradancik'], 'Kuyruk', 'herkes', 'Kuyruktan çık'),
  k('posq', ['siram'], 'Kuyruk', 'herkes', 'Kuyrukta sıran'),
  k('listq', ['siradakiler', 'kuyruk'], 'Kuyruk', 'herkes', 'Kuyruktakiler'),
  k('openq', [], 'Kuyruk', 'mod', 'Kuyruğu aç'),
  k('closeq', [], 'Kuyruk', 'mod', 'Kuyruğu yeni katılıma kapat'),
  k('nextq', [], 'Kuyruk', 'mod', 'Sıradakini çağır'),
  k('removeq', [], 'Kuyruk', 'mod', 'Kuyruktan çıkar', '!removeq @kullanıcı'),
  k('clearq', [], 'Kuyruk', 'mod', 'Kuyruğu temizle'),

  // Sohbet araçları
  k('komutlar', ['commands', 'yardim', 'help'], 'Sohbet', 'herkes', 'Komut listesi · mod: !komutlar ekle|duzenle|sil', '!komutlar oyunlar', true),
  k('sor', ['ask', 'ai'], 'Sohbet', 'herkes', 'Yapay zekâya sor', '!sor En iyi oyun hangisi?'),
  k('cevir', ['translate', 'tr'], 'Sohbet', 'herkes', 'Çeviri (Türkçe↔İngilizce ya da dil kodu)', '!cevir de Merhaba'),
  k('lurk', [], 'Sohbet', 'herkes', 'Arka planda izliyorum'),
  k('unlurk', [], 'Sohbet', 'herkes', 'Geri döndüm (süre söylenir)'),
  k('hatirlat', ['remindme'], 'Sohbet', 'herkes', 'Hatırlatıcı kur', '!hatirlat 15dk su iç'),
  k('emotecount', ['kackez'], 'Sohbet', 'herkes', 'Emote/kelime bu oturumda kaç mesajda geçti', '!emotecount KEKW'),
  k('chatstats', ['sohbetistatistik'], 'Sohbet', 'herkes', 'Sohbet istatistikleri · mod: sifirla', undefined, true),
  k('skortablo', ['takimskor'], 'Sohbet', 'herkes', 'Skor tablosu · mod: !skortablo 1 +1', undefined, true),
  k('quote', [], 'Sohbet', 'herkes', 'Rastgele alıntı'),
  k('addquote', [], 'Sohbet', 'mod', 'Alıntı ekle', '!addquote metin'),
  k('count', ['sayac'], 'Sohbet', 'herkes', 'Sayacı artır', '!count ölüm'),
  k('editcounter', ['sayacduzenle'], 'Sohbet', 'mod', 'Sayacı ayarla', '!editcounter ölüm 5'),

  // Yayın
  k('uptime', ['yayinsuresi'], 'Yayın', 'herkes', 'Yayın süresi'),
  k('title', ['baslik'], 'Yayın', 'herkes', 'Başlığı gösterir · mod değiştirir', '!title <yeni başlık>', true),
  k('game', ['category', 'kategori'], 'Yayın', 'herkes', 'Kategoriyi gösterir · mod değiştirir', '!game <kategori>', true),
  k('followage', ['takipsuresi'], 'Yayın', 'herkes', 'Takip süresi', '!followage [@kullanıcı]'),
  k('accountage', ['hesapyasi'], 'Yayın', 'herkes', 'Hesap yaşı', '!accountage [@kullanıcı]'),
  k('so', ['promo'], 'Yayın', 'mod', 'Kanal tavsiyesi (shoutout)', '!so @kanal'),
  k('clip', [], 'Yayın', 'herkes', 'Yayından klip al'),
  k('marker', ['isaret'], 'Yayın', 'mod', 'Twitch yayın işareti koy'),
  k('commercial', ['reklam'], 'Yayın', 'mod', 'Twitch reklamı başlat', '!commercial 60'),

  // Moderasyon
  k('permit', [], 'Moderasyon', 'mod', 'Kullanıcıya 60 sn link izni', '!permit @kullanıcı'),
  k('nuke', [], 'Moderasyon', 'mod', 'Son mesajlarda kalıba uyanları sil/sustur', '!nuke spam* 600'),
  k('nukeusername', ['adnuke'], 'Moderasyon', 'mod', 'Adı kalıba uyanları sustur/banla', '!nukeusername bot* ban'),
  k('vanish', ['kaybol'], 'Moderasyon', 'herkes', 'Kendi son mesajlarını sil'),
  k('regulars', ['duzenli'], 'Moderasyon', 'mod', 'Düzenli izleyici listesi', '!regulars add @kullanıcı'),
  k('votekick', ['oylasustur'], 'Moderasyon', 'herkes', 'Susturma oylaması (ayardan açılır) · mod iptal eder', '!votekick @kullanıcı', true),
  k('timer', ['zamanlayici'], 'Moderasyon', 'mod', 'Zamanlayıcıları listele / aç / kapat', '!timer ac <ad>'),
  k('modul', ['module'], 'Moderasyon', 'mod', 'Modül aç/kapat (oyunlar, sarki, yapayzeka, bilgi, market)', '!modul kapat oyunlar'),

  // Komut yönetimi
  k('addcom', ['komutekle'], 'Komut yönetimi', 'mod', 'Sohbetten komut ekle', '!addcom !merhaba Selam $(sender)'),
  k('editcom', ['komutduzenle'], 'Komut yönetimi', 'mod', 'Komut yanıtını değiştir', '!editcom !merhaba Yeni yanıt'),
  k('delcom', ['komutsil'], 'Komut yönetimi', 'mod', 'Komutu sil', '!delcom merhaba'),

  // Uyarılar ve bot
  k('alerts', ['uyarilar'], 'Uyarılar & bot', 'mod', 'Uyarıları sustur/atla/duraklat', '!alerts mute'),
  k('followtest', ['subtest', 'tiptest', 'raidtest'], 'Uyarılar & bot', 'mod', 'Test uyarısı gönder'),
  k('bot', [], 'Uyarılar & bot', 'mod', 'Botu sustur / aç', '!bot mute')
];

const DIZIN = new Map<string, YerlesikKomut>();
for (const kmt of YERLESIK_KOMUTLAR) for (const a of [kmt.ad, ...kmt.takma]) if (!DIZIN.has(a)) DIZIN.set(a, kmt);

/** Ad ya da takma addan komut (küçük harf, ASCII) */
export function yerlesikBul(ad: string): YerlesikKomut | undefined {
  return DIZIN.get(String(ad || '').toLowerCase());
}

/** Panelden ayarlanan yetki/bekleme (ayar: `yerlesik_komut_ayarlari`, JSON) */
export interface YerlesikAyar {
  yetki?: KomutYetkisi;
  /** Genel bekleme (sn) */
  bekleme?: number;
}

export function yerlesikAyarlariCoz(ham: unknown): Record<string, YerlesikAyar> {
  let v: unknown;
  try {
    v = typeof ham === 'string' ? JSON.parse(ham || '{}') : ham;
  } catch {
    return {};
  }
  const out: Record<string, YerlesikAyar> = {};
  if (!v || typeof v !== 'object') return out;
  for (const [ad, a] of Object.entries(v as Record<string, any>)) {
    if (!yerlesikBul(ad) || !a || typeof a !== 'object') continue;
    const yetki = ['herkes', 'mod', 'yayinci'].includes(a.yetki) ? (a.yetki as KomutYetkisi) : undefined;
    const bekleme = Number.isFinite(Number(a.bekleme)) ? Math.max(0, Math.min(3600, Math.round(Number(a.bekleme)))) : undefined;
    if (yetki || bekleme) out[yerlesikBul(ad)!.ad] = { ...(yetki ? { yetki } : {}), ...(bekleme ? { bekleme } : {}) };
  }
  return out;
}

/** Kullanıcı bu yetkiyle komutu çalıştırabilir mi? (Panelden yükseltilen yetki; komutun kendi kontrolü ayrıca geçerli) */
export function yetkiYeterli(yetki: KomutYetkisi | undefined, u: { isMod?: boolean; isBroadcaster?: boolean }): boolean {
  if (!yetki || yetki === 'herkes') return true;
  if (yetki === 'yayinci') return Boolean(u.isBroadcaster);
  return Boolean(u.isMod || u.isBroadcaster);
}

/**
 * Sohbetteki `!komutlar` yanıtı. Kategorisiz: herkesin kullanabildiği açık komutlar (sohbet sınırına sığar);
 * `!komutlar <kategori>`: o kategorinin tümü kullanımlarıyla.
 */
export function komutlarMetni(o: { kategori?: string; kapali: string[]; ozel: string[]; enCok?: number }): string {
  const acik = YERLESIK_KOMUTLAR.filter((x) => !o.kapali.includes(x.ad));
  const kategoriler = [...new Set(YERLESIK_KOMUTLAR.map((x) => x.kategori))];
  const katla = (t: string) => t.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z]/g, '');
  const enCok = o.enCok ?? 450;
  if (o.kategori) {
    const kat = kategoriler.find((x) => katla(x).startsWith(katla(o.kategori!)));
    if (!kat) return `Kategori bulunamadı. Kategoriler: ${kategoriler.join(', ')}`;
    const liste = acik.filter((x) => x.kategori === kat).map((x) => `${x.kullanim || `!${x.ad}`}${x.yetki !== 'herkes' ? ' (mod)' : ''}`);
    return kirp(`📌 ${kat}: ${liste.join(' · ')}`, enCok);
  }
  const herkes = acik.filter((x) => x.yetki === 'herkes').map((x) => `!${x.ad}`);
  const ozel = o.ozel.map((x) => `!${x.replace(/^!/, '')}`).filter((x) => !herkes.includes(x));
  const ipucu = ` · Ayrıntı: !komutlar <${kategoriler.slice(0, 4).map(katla).join('|')}…>`;
  return kirp(`📌 Komutlar: ${[...ozel, ...herkes].join(' ')}`, enCok - ipucu.length) + ipucu;
}

function kirp(m: string, enCok: number): string {
  if (m.length <= enCok) return m;
  const kes = m.slice(0, enCok - 1);
  return kes.slice(0, Math.max(0, kes.lastIndexOf(' '))) + ' …';
}
