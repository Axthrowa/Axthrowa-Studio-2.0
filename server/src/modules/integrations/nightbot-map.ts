/**
 * AxBoT — Nightbot eşlemesi (saf)
 * Developed by AxthrowA
 *
 * Veritabanı erişimi YOK — testler sunucunun SQLite kilidine takılmasın.
 */

export interface NightbotKomut {
  name?: string;
  message?: string;
  coolDown?: number;
  userLevel?: string;
  alias?: string;
  count?: number;
}

export interface NightbotTimer {
  name?: string;
  message?: string;
  interval?: number;
  lines?: number;
  enabled?: boolean;
}

export interface IceAktarmaSonucu {
  komut: { eklenen: number; atlanan: number; atlananlar: string[] };
  zamanlayici: { eklenen: number; atlanan: number };
  uyarilar: string[];
}

/** Nightbot yetki seviyesini bizimkine çevirir. */
export function seviyeCevir(nb: string | undefined): string {
  const s = String(nb || 'everyone').toLowerCase();
  if (s === 'owner') return 'broadcaster';
  if (s === 'moderator') return 'mod';
  if (s === 'vip') return 'vip';
  if (s === 'regular') return 'regular';
  if (s === 'subscriber') return 'sub';
  return 'everyone';
}

/**
 * Nightbot şablonunu bizim değişken sözdizimimize çevirir.
 *
 * Çoğu değişken zaten aynı; farklı olanlar ve DESTEKLENMEYENLER eşlenir.
 * Desteklenmeyen bir değişken varsa uyarı döner — sessizce bozuk komut
 * oluşturmaktansa kullanıcı bilsin.
 */
export function sablonCevir(ham: string): { metin: string; uyarilar: string[] } {
  let t = String(ham || '');
  const uyarilar: string[] = [];

  // Bizde farklı adla var
  const esleme: Array<[RegExp, string]> = [
    [/\$\(user\)/gi, '$(sender)'],
    [/\$\(channel\)/gi, '$(channel)'],
    [/\$\(querystring\)/gi, '$(urlencode $(variable))'],
    [/\$\(query\)/gi, '$(variable)'],
    [/\$\(touser\)/gi, '$(toname)'],
    [/\$\(eval\s/gi, '$(math ']
  ];
  for (const [re, yeni] of esleme) t = t.replace(re, yeni);

  // Karşılığı olmayanlar
  const desteklenmeyen: Array<[RegExp, string]> = [
    [/\$\(twitch\s/i, '$(twitch ...) — Twitch kanal bilgisi değişkeni desteklenmiyor'],
    [/\$\(weather\s/i, '$(weather ...) — hava durumu değişkeni desteklenmiyor'],
    [/\$\(customapi\s/i, '$(customapi ...) → $(urlfetch ...) olarak değiştirin']
  ];
  for (const [re, mesaj] of desteklenmeyen) {
    if (re.test(t)) uyarilar.push(mesaj);
  }

  return { metin: t, uyarilar };
}
