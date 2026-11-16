/**
 * Tutulan istatistiklerin kayıt sayısı ve silinmesi. Panelde her grup ayrı silinir; puan ve seviye
 * burada yok: onlar cüzdan sayılır, sıfırlaması Seviye / XP sekmesinde.
 */
import { db } from '../../db/index.js';
import { economy } from '../economy/economy.js';
import { sohbetIstatistik } from './sohbet-istatistik.js';

const sayi = (sql: string) => (db.prepare(sql).get() as { c: number }).c;

/** Önbellek üzerinden: doğrudan UPDATE, sonraki toplu yazımda eski değerlerle eziliyordu */
const cuzdanda = (set: string) => () => economy.tabloyuDegistir(() => db.prepare(`UPDATE economy SET ${set}`).run());

const GRUPLAR = [
  {
    id: 'trivia',
    ad: 'Bil Bakalım skorları',
    aciklama: 'Liderlik sıralaması, doğru/yanlış sayıları, en hızlı cevap ve seriler.',
    say: () => sayi('SELECT COUNT(*) c FROM trivia_scores'),
    sil: () => db.exec('DELETE FROM trivia_scores')
  },
  {
    id: 'izleme',
    ad: 'İzleme süreleri',
    aciklama: 'Sıralamadaki izleme süresi ve !izleme. Puanlar değişmez.',
    say: () => sayi('SELECT COUNT(*) c FROM economy WHERE watch_time_minutes > 0'),
    sil: cuzdanda('watch_time_minutes = 0')
  },
  {
    id: 'mesaj',
    ad: 'Mesaj sayıları',
    aciklama: 'Sıralamadaki mesaj sayısı. Puanlar değişmez.',
    say: () => sayi('SELECT COUNT(*) c FROM economy WHERE messages_count > 0'),
    sil: cuzdanda('messages_count = 0')
  },
  {
    id: 'destek',
    ad: 'Abone ve bağış toplamları',
    aciklama: 'İzleyici başına abonelik, hediye abonelik ve bağış toplamı. Bağış kayıtları silinmez.',
    say: () => sayi('SELECT COUNT(*) c FROM economy WHERE subs_count > 0 OR gifted_subs_count > 0 OR tips_amount > 0'),
    sil: cuzdanda('subs_count = 0, gifted_subs_count = 0, tips_amount = 0')
  },
  {
    id: 'sohbet',
    ad: 'Sohbet istatistikleri',
    aciklama: 'Kelime bulutu, !chatstats ve !emotecount sayaçları.',
    say: () => sohbetIstatistik.ozet().mesajSayisi,
    sil: () => sohbetIstatistik.sifirla()
  },
  {
    id: 'komut',
    ad: 'Komut kullanım sayıları',
    aciklama: 'Komutların kaç kez kullanıldığı ve {count} değeri. Komutlar silinmez.',
    say: () => sayi('SELECT COUNT(*) c FROM commands WHERE use_count > 0'),
    sil: () => db.exec('UPDATE commands SET use_count = 0')
  },
  {
    id: 'sayac',
    ad: 'Adlı sayaçlar',
    aciklama: '{count:ad} ile tutulan bütün sayaçlar.',
    say: () => sayi('SELECT COUNT(*) c FROM counters'),
    sil: () => db.exec('DELETE FROM counters')
  },
  {
    id: 'olaylar',
    ad: 'Olay geçmişi',
    aciklama: 'Panodaki son olaylar, sohbet geçmişi, jenerik listesi ve !takipsuresi kaydı.',
    say: () => sayi('SELECT COUNT(*) c FROM stream_events'),
    sil: () => db.exec('DELETE FROM stream_events')
  }
];

export function istatistikler() {
  // Sayılar diskten okunur: bellekteki son değişiklikler de sayılsın
  economy.flushAll();
  return GRUPLAR.map(({ id, ad, aciklama, say }) => ({ id, ad, aciklama, kayit: say() }));
}

/** Grubu siler; bilinmeyen grup için false döner. */
export function istatistikSil(id: string): boolean {
  const grup = GRUPLAR.find((g) => g.id === id);
  if (!grup) return false;
  grup.sil();
  return true;
}
