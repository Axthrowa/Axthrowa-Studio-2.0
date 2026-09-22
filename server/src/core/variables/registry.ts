/**
 * StreamAxT — değişken kayıt defteri
 * Developed by AxthrowA
 *
 * Şablon değişkenlerinin uygulaması. Çözümleme mantığı `resolve.ts`'te;
 * burada yalnız tek tek değişkenlerin ne döndürdüğü var.
 *
 * Eski `variable-parser.ts` yalnız 8 değişken destekliyordu
 * (`{user}` `{touser}` `{query}` `{args}` `{uptime}` `{platform}`
 * `{points}` `{1}..{9}`). Bu dosya onu kapsayıp genişletiyor; eski
 * `{...}` biçimi geriye uyum için `variable-parser.ts`'te korunuyor.
 */
import { db } from '../../db/index.js';
import { economy } from '../../modules/economy/economy.js';
import { seviyeler } from '../../modules/levels/levels.js';
import { getStreamUptime } from '../variable-parser.js';
import { settingsCache } from '../settings-cache.js';
import { guvenliGetir } from './net.js';
import { kvOku, kvYaz, kvListele, sayacAl, sayacAyarla, sayacDegistir, sayacIfadesi } from './store.js';
import { SINIR, type DegiskenBaglam, type DegiskenTanimi } from './types.js';
import { noktaliBol } from './resolve.js';
import { sayi, sureMetni, matematik, jsonYolu } from './pure.js';

export { matematik, jsonYolu } from './pure.js';

/** `@Ad` → `Ad` */
function atSil(s: string): string {
  return String(s || '').replace(/^@/, '');
}

/** Boş argümanda yedek değere düş. */
function yedekli(ham: string, deger: string): string {
  if (deger) return deger;
  return ham.trim();
}

/** Sohbette son görülen kullanıcılardan rastgele biri. */
function rastgeleIzleyici(): string {
  const r = db
    .prepare('SELECT display_name, username FROM economy ORDER BY last_active DESC LIMIT 50')
    .all() as Array<{ display_name?: string; username: string }>;
  if (!r.length) return '';
  const s = r[Math.floor(Math.random() * r.length)];
  return s.display_name || s.username;
}

function tanim(
  ad: string,
  grup: DegiskenTanimi['grup'],
  aciklama: string,
  isleyici: DegiskenTanimi['isleyici'],
  ekstra: Partial<DegiskenTanimi> = {}
): DegiskenTanimi {
  return { ad, grup, aciklama, isleyici, ...ekstra };
}

export function kayitDefteriOlustur(): Map<string, DegiskenTanimi> {
  const liste: DegiskenTanimi[] = [
    // ---- Kullanıcı ve girdi -------------------------------------------------
    tanim('sender', 'user', 'Komutu yazan kişinin adı', (_h, c) => c.user.displayName || c.user.username, {
      ornek: 'Merhaba @$(sender)!'
    }),
    tanim('username', 'user', '$(sender) ile aynı', (_h, c) => c.user.displayName || c.user.username),
    tanim('userid', 'user', 'Kullanıcının platform kimliği', (_h, c) => c.user.userId || ''),
    tanim('senderid', 'user', '$(userid) ile aynı', (_h, c) => c.user.userId || ''),
    tanim('roles', 'user', 'Kullanıcının rolleri', (_h, c) => {
      const r: string[] = [];
      if (c.user.isBroadcaster) r.push('yayıncı');
      if (c.user.isMod) r.push('moderatör');
      if (c.user.isVip) r.push('vip');
      if (c.user.isSub) r.push('abone');
      return r.length ? r.join(', ') : 'yok';
    }),
    tanim('variable', 'text', 'Komuttan sonraki tüm metin', (h, c) => yedekli(h, c.rawArgs), {
      ornek: 'Seçimin: $(variable hiçbir şey)'
    }),
    tanim('optionalvariable', 'text', 'Komuttan sonraki metin, yoksa null', (_h, c) => c.rawArgs || 'null'),
    tanim('args', 'text', 'Komuttan sonraki tüm metin', (h, c) => yedekli(h, c.rawArgs)),
    tanim('query', 'text', '$(args) ile aynı', (h, c) => yedekli(h, c.rawArgs)),
    tanim('toname', 'user', 'Hedef kullanıcı adı (@ olmadan)', (h, c) =>
      atSil(c.args[0] || '') || yedekli(h, c.user.displayName || c.user.username)
    ),
    tanim('touser', 'user', '$(toname) ile aynı', (h, c) =>
      atSil(c.args[0] || '') || yedekli(h, c.user.displayName || c.user.username)
    ),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) =>
      tanim(`v${i}`, 'text', `${i}. kelime`, (h, c) => yedekli(h, c.args[i - 1] || ''))
    ),

    // ---- Kanal ve yayın -----------------------------------------------------
    tanim('platform', 'channel', 'Komutun geldiği platform', (_h, c) => c.platform),
    tanim('channel', 'channel', 'Kanal adı', (_h, c) => c.channel || ''),
    tanim('platformurl', 'channel', 'Platformun adres kökü', (_h, c) => {
      const m: Record<string, string> = {
        kick: 'https://kick.com',
        twitch: 'https://twitch.tv',
        youtube: 'https://youtube.com',
        tiktok: 'https://tiktok.com'
      };
      return m[String(c.platform).toLowerCase()] || '';
    }),
    tanim('uptime', 'channel', 'Yayının ne kadardır açık olduğu', () => getStreamUptime()),
    tanim('followers', 'channel', 'Takipçi sayısı', () => {
      const r = db
        .prepare("SELECT COUNT(*) c FROM stream_events WHERE event_type = 'follow'")
        .get() as { c: number };
      return String(r?.c ?? 0);
    }),
    tanim('subs', 'channel', 'Abone sayısı', () => {
      const r = db.prepare('SELECT COALESCE(SUM(subs_count),0) c FROM economy').get() as { c: number };
      return String(r?.c ?? 0);
    }),
    tanim('commands', 'channel', 'Kullanılabilir komutlar', () => {
      const r = db
        .prepare('SELECT name FROM commands WHERE is_enabled = 1 ORDER BY name LIMIT 30')
        .all() as Array<{ name: string }>;
      return r.map((x) => x.name).join(' ');
    }),

    // ---- Sadakat ------------------------------------------------------------
    tanim('points', 'loyalty', 'Kullanıcının puanı', (h, c) => {
      const hedef = atSil(h) || c.user.username;
      return String(economy.getUserPoints(hedef));
    }),
    tanim('puan', 'loyalty', '$(points) ile aynı', (h, c) => {
      const hedef = atSil(h) || c.user.username;
      return String(economy.getUserPoints(hedef));
    }),
    tanim(
      'addpoints',
      'loyalty',
      'Puan ekler/çıkarır. $(addPoints 100) veya $(addPoints @kisi -50)',
      (h, c) => {
        const p = h.trim().split(/\s+/);
        const hedef = p.length > 1 ? atSil(p[0]) : c.user.username;
        const miktar = Number(p[p.length - 1]);
        if (!Number.isFinite(miktar)) return '-1';
        return String(economy.addPoints(hedef, miktar));
      },
      { yazar: true }
    ),
    tanim(
      'setpoints',
      'loyalty',
      'Puanı tam değere ayarlar',
      (h, c) => {
        const p = h.trim().split(/\s+/);
        const hedef = p.length > 1 ? atSil(p[0]) : c.user.username;
        const deger = Math.max(0, Number(p[p.length - 1]));
        if (!Number.isFinite(deger)) return '-1';
        const suAn = economy.getUserPoints(hedef);
        return String(economy.addPoints(hedef, deger - suAn));
      },
      { yazar: true }
    ),
    tanim('currency', 'loyalty', 'Puan biriminin adı', () => settingsCache.get('currency_name', 'Puan')),
    tanim('level', 'loyalty', 'Kullanıcının seviyesi', (h, c) => String(seviyeler.kullanici(atSil(h) || c.user.username).seviye)),
    tanim('xp', 'loyalty', 'Kullanıcının toplam XP değeri', (h, c) => String(seviyeler.kullanici(atSil(h) || c.user.username).xp)),
    tanim('nextlvl', 'loyalty', 'Sonraki seviye için gereken XP', (h, c) =>
      String(seviyeler.kullanici(atSil(h) || c.user.username).sonrakiIcinXp)
    ),

    // ---- Sayaçlar -----------------------------------------------------------
    tanim(
      'count',
      'counter',
      'Komuta bağlı sayaç. $(count) okur, $(count +1) artırır',
      (h, c) => {
        const ad = (c.commandName || 'genel').replace(/^!/, '');
        const ifade = sayacIfadesi(h);
        if (ifade.tur === 'oku') return sayi(sayacAl(ad));
        if (c.isTest) return sayi(sayacAl(ad));
        if (ifade.tur === 'fark') return sayi(sayacDegistir(ad, ifade.deger));
        return sayi(sayacAyarla(ad, ifade.deger));
      },
      { yazar: true }
    ),
    tanim('getcounter', 'counter', 'Adlandırılmış sayacın değeri', (h) => sayi(sayacAl(h.trim()))),
    tanim(
      'setcounter',
      'counter',
      'Sayacı ayarlar. $(setcounter 50) veya $(setcounter olum 12)',
      (h, c) => {
        const p = h.trim().split(/\s+/);
        const ad = p.length > 1 ? p[0] : (c.commandName || 'genel').replace(/^!/, '');
        const deger = Number(p[p.length - 1]);
        if (!Number.isFinite(deger)) return '0';
        return sayi(sayacAyarla(ad, deger));
      },
      { yazar: true }
    ),

    // ---- Rastgele ve metin --------------------------------------------------
    tanim('random', 'random', 'Rastgele sayı. $(random 0 10)', (h) => {
      const [a, b] = h.trim().split(/\s+/).map(Number);
      const min = Number.isFinite(a) ? a : 0;
      const max = Number.isFinite(b) ? b : 100;
      const alt = Math.min(min, max);
      const ust = Math.max(min, max);
      return String(alt + Math.floor(Math.random() * (ust - alt + 1)));
    }),
    tanim('pick', 'random', 'Listeden rastgele seçer. $(pick a;b;c)', (h) => {
      const s = noktaliBol(h).filter(Boolean);
      return s.length ? s[Math.floor(Math.random() * s.length)] : '';
    }),
    tanim('repeat', 'text', `Metni tekrarlar (en fazla ${SINIR.tekrar})`, (h) => {
      const bosluk = h.trim().search(/\s/);
      if (bosluk === -1) return '';
      const adet = Math.min(SINIR.tekrar, Math.max(0, parseInt(h.slice(0, bosluk), 10) || 0));
      return h.slice(bosluk + 1).repeat(adet);
    }),
    tanim('randomuser', 'random', 'Sohbetten rastgele bir izleyici', () => rastgeleIzleyici()),
    tanim('optionalrandomuser', 'random', 'Verilen kullanıcı, yoksa rastgele biri', (_h, c) =>
      atSil(c.args[0] || '') || rastgeleIzleyici()
    ),
    tanim('upper', 'text', 'Büyük harfe çevirir', (h) => h.toLocaleUpperCase('tr-TR')),
    tanim('lower', 'text', 'Küçük harfe çevirir', (h) => h.toLocaleLowerCase('tr-TR')),

    // ---- Matematik ve zaman -------------------------------------------------
    tanim('math', 'math', 'Matematik işlemi. $(math 5 * 5)', (h) => matematik(h)),
    tanim('round', 'math', 'En yakın tam sayıya yuvarlar', (h) => {
      const n = Number(h.trim().replace(',', '.'));
      return Number.isFinite(n) ? String(Math.round(n)) : '0';
    }),
    tanim('countdown', 'math', 'Tarihe kalan süre. $(countdown 2026-12-31)', (h) => {
      const t = Date.parse(h.trim());
      if (!Number.isFinite(t)) return '(geçersiz tarih)';
      const fark = t - Date.now();
      return fark <= 0 ? 'geçti' : sureMetni(fark);
    }),
    tanim('countup', 'math', 'Tarihten bu yana geçen süre', (h) => {
      const t = Date.parse(h.trim());
      if (!Number.isFinite(t)) return '(geçersiz tarih)';
      const fark = Date.now() - t;
      return fark <= 0 ? 'henüz olmadı' : sureMetni(fark, true);
    }),
    tanim('time', 'math', 'Saat dilimine göre zaman. $(time Europe/Istanbul tr-TR)', (h) => {
      const [tz, yerel] = h.trim().split(/\s+/);
      try {
        return new Date().toLocaleString(yerel || 'tr-TR', { timeZone: tz || 'Europe/Istanbul' });
      } catch {
        return '(geçersiz saat dilimi)';
      }
    }),

    // ---- Web ----------------------------------------------------------------
    tanim('urlfetch', 'web', 'Adresten metin getirir', (h) => guvenliGetir(h), { ag: true }),
    tanim('earlyfetch', 'web', 'Diğer değişkenlerden ÖNCE getirir', (h) => guvenliGetir(h), { ag: true }),
    tanim('urlencode', 'web', 'Adres için metni kodlar', (h) => encodeURIComponent(h)),
    tanim('urldecode', 'web', 'Kodlanmış metni çözer', (h) => {
      try {
        return decodeURIComponent(h);
      } catch {
        return h;
      }
    }),

    // ---- Kalıcı değişkenler -------------------------------------------------
    tanim('setlocal', 'store', 'Yerel değişken yazar. $(setlocal ad;deger)', (h, c) => {
      const [k, ...v] = noktaliBol(h);
      if (!k) return '';
      if (c.yerel.size >= SINIR.yerel && !c.yerel.has(k)) return '';
      const deger = v.join(';');
      c.yerel.set(k, deger);
      return deger;
    }),
    tanim('local', 'store', 'Yerel değişken okur. $(local ad;yedek)', (h, c) => {
      const [k, yedek] = noktaliBol(h);
      return c.yerel.get(k) ?? yedek ?? '';
    }),
    tanim(
      'setuservar',
      'store',
      'Kullanıcı değişkeni yazar. $(setuservar ad;deger) veya $(setuservar @kisi;ad;deger)',
      (h, c) => {
        const p = noktaliBol(h);
        const kisiVerildi = p.length >= 3 && p[0].startsWith('@');
        const sahip = kisiVerildi ? p[0] : c.user.username;
        const k = kisiVerildi ? p[1] : p[0];
        const deger = (kisiVerildi ? p.slice(2) : p.slice(1)).join(';');
        if (!k) return '';
        kvYaz('user', sahip, k, deger);
        return deger;
      },
      { yazar: true }
    ),
    tanim('uservar', 'store', 'Kullanıcı değişkeni okur', (h, c) => {
      const p = noktaliBol(h);
      const kisiVerildi = p[0]?.startsWith('@');
      const sahip = kisiVerildi ? p[0] : c.user.username;
      const k = kisiVerildi ? p[1] : p[0];
      const yedek = kisiVerildi ? p[2] : p[1];
      return kvOku('user', sahip, k) ?? yedek ?? '';
    }),
    tanim('uservarlist', 'store', 'Kullanıcının değişken adları', (h, c) =>
      kvListele('user', atSil(h) || c.user.username).join(', ')
    ),
    tanim(
      'setglobalvar',
      'store',
      'Kanal değişkeni yazar. $(setglobalvar ad;deger)',
      (h) => {
        const [k, ...v] = noktaliBol(h);
        if (!k) return '';
        const deger = v.join(';');
        kvYaz('global', '', k, deger);
        return deger;
      },
      { yazar: true }
    ),
    tanim('globalvar', 'store', 'Kanal değişkeni okur', (h) => {
      const [k, yedek] = noktaliBol(h);
      return kvOku('global', '', k) ?? yedek ?? '';
    }),
    tanim('globalvarlist', 'store', 'Kanal değişken adları', () => kvListele('global', '').join(', ')),

    // ---- JSON ---------------------------------------------------------------
    tanim('json', 'json', 'JSON içinden değer okur. $(json globalvar;profil;stats.wins)', (h, c) => {
      const p = noktaliBol(h);
      const kapsam = p[0];
      const kisiVerildi = p[1]?.startsWith('@');
      const sahip = kisiVerildi ? p[1] : c.user.username;
      const k = kisiVerildi ? p[2] : p[1];
      const yol = kisiVerildi ? p[3] : p[2];
      const yedek = kisiVerildi ? p[4] : p[3];

      let ham: string | null = null;
      if (kapsam === 'local') ham = c.yerel.get(k) ?? null;
      else if (kapsam === 'uservar') ham = kvOku('user', sahip, k);
      else if (kapsam === 'globalvar') ham = kvOku('global', '', k);
      else return '(json kapsam?)';

      if (ham === null) return yedek ?? '';
      try {
        const deger = jsonYolu(JSON.parse(ham), yol);
        if (deger === undefined || deger === null) return yedek ?? '';
        return typeof deger === 'object' ? JSON.stringify(deger) : String(deger);
      } catch {
        return '(json invalid)';
      }
    })
  ];

  const harita = new Map<string, DegiskenTanimi>();
  for (const t of liste) harita.set(t.ad.toLowerCase(), t);
  return harita;
}

/** Tek örnek — sunucu ömrü boyunca aynı defter kullanılır. */
export const kayitDefteri = kayitDefteriOlustur();

/** Panelde listelemek için: gruplanmış değişken kataloğu. */
export function degiskenKatalogu() {
  const gruplar: Record<string, Array<{ ad: string; aciklama: string; ornek?: string; ag?: boolean }>> = {};
  for (const t of kayitDefteri.values()) {
    (gruplar[t.grup] ||= []).push({ ad: t.ad, aciklama: t.aciklama, ornek: t.ornek, ag: t.ag });
  }
  for (const g of Object.values(gruplar)) g.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
  return gruplar;
}
