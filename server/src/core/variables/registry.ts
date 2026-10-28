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
import { cuzdanAdi, economy } from '../../modules/economy/economy.js';
import { seviyeler } from '../../modules/levels/levels.js';
import { getStreamUptime } from '../variable-parser.js';
import { settingsCache } from '../settings-cache.js';
import { guvenliGetir } from './net.js';
import { lolSiralamasi } from '../../modules/integrations/riot.js';
import { kvOku, kvYaz, kvListele, sayacAl, sayacAyarla, sayacDegistir, sayacIfadesi } from './store.js';
import { SINIR, type DegiskenBaglam, type DegiskenTanimi } from './types.js';
import { noktaliBol } from './resolve.js';
import { sayi, sureMetni, matematik, jsonYolu, jsonYoluYaz, jsonYoluSil, jsonDegeri, JSON_DEGISKEN_SINIRI } from './pure.js';
import { canliDurum } from '../live-status.js';
import { agirlikliSec, havaMetni, ifSonucu, kickAlaniCoz, kickProfilAlani, steamAlani } from './ek-saf.js';

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

/**
 * Yayın başlığı/kategorisi DEĞİŞTİRİCİ. Değişken motoru platform
 * adaptörlerine bağımlı olmasın (döngüsel içe aktarma) diye başlangıçta
 * `index.ts` enjekte eder.
 */
export type YayinDegistirici = (
  tur: 'baslik' | 'kategori',
  deger: string,
  platform: string
) => Promise<{ ok: boolean; hata?: string; kategori?: string }>;

let yayinDegistirici: YayinDegistirici | null = null;

export function yayinDegistiriciAyarla(fn: YayinDegistirici) {
  yayinDegistirici = fn;
}

/** Sohbette son görülen kullanıcılardan rastgele biri. */
export function rastgeleIzleyici(): string {
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
    // Nightbot uyumluluğu: oradan kopyalanan komutlar ham "$(user)" yazmasın
    tanim('user', 'user', '$(sender) ile aynı (Nightbot adı)', (_h, c) => c.user.displayName || c.user.username),
    tanim('userlevel', 'user', 'owner / moderator / vip / subscriber / everyone (Nightbot adı)', (_h, c) =>
      c.user.isBroadcaster ? 'owner' : c.user.isMod ? 'moderator' : c.user.isVip ? 'vip' : c.user.isSub ? 'subscriber' : 'everyone'
    ),
    tanim('querystring', 'text', 'Komuttan sonraki metin, adrese uygun kodlanmış (Nightbot adı)', (h, c) =>
      encodeURIComponent(yedekli(h, c.rawArgs))
    ),
    tanim('command', 'text', 'Çalışan komutun adı (Nightbot adı)', (_h, c) => (c.commandName || '').replace(/^!/, '')),
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
    tanim('title', 'channel', 'Yayının şu anki başlığı', (_h, c) => canliDurum.platform(c.platform)?.baslik || ''),
    tanim('game', 'channel', 'Yayının şu anki kategorisi', (_h, c) => canliDurum.platform(c.platform)?.kategori || ''),
    tanim('viewers', 'channel', 'Anlık izleyici sayısı (tüm platformlar)', () => String(canliDurum.genel().izleyici || 0)),
    tanim(
      'settitle',
      'channel',
      'Yayın başlığını değiştirir — yalnız mod/yayıncı çalıştırabilir',
      async (h, c) => {
        if (!(c.user.isMod || c.user.isBroadcaster)) return '(yetki yok)';
        const yeni = h.trim();
        if (!yeni) return '(başlık boş)';
        if (!yayinDegistirici) return '(desteklenmiyor)';
        const r = await yayinDegistirici('baslik', yeni, c.platform);
        return r.ok ? yeni : `(değiştirilemedi: ${r.hata})`;
      },
      { yazar: true, ornek: '$(settitle $(query))' }
    ),
    tanim(
      'setcategory',
      'channel',
      'Yayın kategorisini değiştirir — yalnız mod/yayıncı çalıştırabilir',
      async (h, c) => {
        if (!(c.user.isMod || c.user.isBroadcaster)) return '(yetki yok)';
        const yeni = h.trim();
        if (!yeni) return '(kategori boş)';
        if (!yayinDegistirici) return '(desteklenmiyor)';
        const r = await yayinDegistirici('kategori', yeni, c.platform);
        return r.ok ? r.kategori || yeni : `(değiştirilemedi: ${r.hata})`;
      },
      { yazar: true, ornek: '$(setcategory $(query))' }
    ),
    tanim('followers', 'channel', 'Takipçi sayısı', async () => {
      // Eskiden kurulumdan beri kaydedilen takip olaylarını (testler dahil) sayıyordu
      const { takipciSayisi } = await import('../../modules/widgets/takipci-sayisi.js');
      const gercek = await takipciSayisi();
      if (typeof gercek === 'number') return String(gercek);
      const r = db
        .prepare("SELECT COUNT(*) c FROM stream_events WHERE event_type = 'follow' AND (metadata IS NULL OR metadata NOT LIKE '%\"isTest\":true%')")
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
      const hedef = cuzdanAdi(c.platform, atSil(h) || c.user.username);
      return String(economy.getUserPoints(hedef));
    }),
    tanim('puan', 'loyalty', '$(points) ile aynı', (h, c) => {
      const hedef = cuzdanAdi(c.platform, atSil(h) || c.user.username);
      return String(economy.getUserPoints(hedef));
    }),
    tanim(
      'addpoints',
      'loyalty',
      'Puan ekler/çıkarır. $(addPoints 100) veya $(addPoints @kisi -50)',
      (h, c) => {
        const p = h.trim().split(/\s+/);
        const hedef = cuzdanAdi(c.platform, p.length > 1 ? atSil(p[0]) : c.user.username);
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
        const hedef = cuzdanAdi(c.platform, p.length > 1 ? atSil(p[0]) : c.user.username);
        const deger = Math.max(0, Number(p[p.length - 1]));
        if (!Number.isFinite(deger)) return '-1';
        const suAn = economy.getUserPoints(hedef);
        return String(economy.addPoints(hedef, deger - suAn));
      },
      { yazar: true }
    ),
    tanim('currency', 'loyalty', 'Puan biriminin adı', () => settingsCache.get('currency_name', 'Puan')),
    tanim('level', 'loyalty', 'Kullanıcının seviyesi', (h, c) => String(seviyeler.kullanici(cuzdanAdi(c.platform, atSil(h) || c.user.username)).seviye)),
    tanim('xp', 'loyalty', 'Kullanıcının toplam XP değeri', (h, c) => String(seviyeler.kullanici(cuzdanAdi(c.platform, atSil(h) || c.user.username)).xp)),
    tanim('nextlvl', 'loyalty', 'Sonraki seviye için gereken XP', (h, c) =>
      String(seviyeler.kullanici(cuzdanAdi(c.platform, atSil(h) || c.user.username)).sonrakiIcinXp)
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
    tanim('pickw', 'random', 'Ağırlıklı rastgele seçim. $(pickw kazandın:10;kaybettin:90)', (h) => agirlikliSec(noktaliBol(h)), {
      ornek: '🎰 $(pickw JACKPOT:5;Az kalsın:35;Kaybettin:60)'
    }),
    tanim('if', 'text', 'Koşullu yanıt: $(if koşul;doğruysa;yanlışsa). Op: == != > < >= <= ~= (içerir)', (h) => ifSonucu(noktaliBol(h)), {
      ornek: '$(if $(1) == evet;Harika!;Tamam, sonra)'
    }),
    tanim('weather', 'web', 'Hava durumu (Open-Meteo). $(weather İstanbul)', (h) => havaDurumu(h), {
      ag: true,
      ornek: '$(weather $(query))'
    }),
    tanim('lastfm', 'web', 'Last.fm son dinlenen şarkı: $(lastfm kullanıcı). Ayarlarda Last.fm API anahtarı (lastfm_api_key) gerekir', (h) => lastfmSon(h), {
      ag: true,
      ornek: '🎧 Şu an: $(lastfm kullaniciadim)'
    }),
    tanim('steam', 'web', 'Steam profili: $(steam kullanıcı|64-bit kimlik [oyun|durum|ad]). Profil herkese açık olmalı', (h) => steamProfili(h), {
      ag: true,
      ornek: '🎮 $(steam gabelogannewell oyun)'
    }),
    tanim(
      'kick',
      'user',
      `Kick profilinden bilgi: $(kick alan [kullanıcı]). Alan: bio, instagram, twitter, youtube, discord, tiktok, facebook, takipci, url`,
      async (h, c) => {
        const [alanHam = '', kimHam = ''] = h.trim().split(/\s+/);
        const alan = kickAlaniCoz(alanHam);
        if (!alan) return '(kick: bilinmeyen alan)';
        const kim = atSil(kimHam) || c.user.username;
        const { kickPlatform } = await import('../../platforms/kick.js');
        const kanal = await kickPlatform.profil(kim);
        return kanal ? kickProfilAlani(kanal, alan, kim) : '';
      },
      { ag: true, ornek: '@$(touser) hesapları: IG $(kick instagram $(touser)) · $(kick url $(touser))' }
    ),
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
    tanim(
      'leagueoflegends',
      'web',
      'League of Legends dereceli sıralaması (Riot API anahtarı gerekir)',
      (h) => lolSiralamasi(h),
      { ag: true, ornek: '$(leagueoflegends Oyuncu#TR1 tr)' }
    ),
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
    }),
    tanim(
      'jsonset',
      'json',
      'JSON içinde yol yazar. $(jsonset globalvar;profil;stats.wins;2) veya $(jsonset uservar;@kisi;profil;stats.wins;4)',
      (h, c) => jsonDegistir(h, c, 'yaz'),
      { yazar: true }
    ),
    tanim(
      'jsonunset',
      'json',
      'JSON içinden yol siler. $(jsonunset globalvar;profil;stats.wins)',
      (h, c) => jsonDegistir(h, c, 'sil'),
      { yazar: true }
    )
  ];

  /** `$(jsonset …)` / `$(jsonunset …)` ortak gövdesi: oku → değiştir → sınır → yaz. */
  function jsonDegistir(h: string, c: DegiskenBaglam, islem: 'yaz' | 'sil'): string {
    const p = noktaliBol(h);
    const kapsam = p[0];
    const kisiVerildi = p[1]?.startsWith('@');
    const sahip = kisiVerildi ? p[1] : c.user.username;
    const k = kisiVerildi ? p[2] : p[1];
    const yol = kisiVerildi ? p[3] : p[2];
    const degerHam = (kisiVerildi ? p.slice(4) : p.slice(3)).join(';');
    if (!k || !yol) return '(json yol?)';

    let ham: string | null = null;
    if (kapsam === 'local') ham = c.yerel.get(k) ?? null;
    else if (kapsam === 'uservar') ham = kvOku('user', sahip, k);
    else if (kapsam === 'globalvar') ham = kvOku('global', '', k);
    else return '(json kapsam?)';

    let veri: unknown = {};
    if (ham !== null && ham !== '') {
      try {
        veri = JSON.parse(ham);
      } catch {
        return '(json invalid)';
      }
    }
    const yeni = islem === 'yaz' ? jsonYoluYaz(veri, yol, jsonDegeri(degerHam)) : jsonYoluSil(veri, yol);
    if (yeni === null) return '(json yol?)';
    const metin = JSON.stringify(yeni);
    if (metin.length > JSON_DEGISKEN_SINIRI) return '(json çok büyük)';
    if (kapsam === 'local') c.yerel.set(k, metin);
    else if (kapsam === 'uservar') kvYaz('user', sahip, k, metin);
    else kvYaz('global', '', k, metin);
    return metin;
  }

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

// ---- Last.fm / Steam ---------------------------------------------------------
async function lastfmSon(ham: string): Promise<string> {
  const k = String(ham || '').trim().split(/\s+/)[0] || '';
  if (!/^[A-Za-z0-9_-]{2,15}$/.test(k)) return '(lastfm: Last.fm kullanıcı adı yazın)';
  const anahtar = settingsCache.get('lastfm_api_key', '').trim();
  if (!anahtar) return '(lastfm: Ayarlarda Last.fm API anahtarı gerekir — last.fm/api/account/create)';
  try {
    const j = JSON.parse(
      await guvenliGetir(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(k)}&api_key=${encodeURIComponent(anahtar)}&format=json&limit=1`)
    );
    const t = j?.recenttracks?.track?.[0];
    if (!t) return j?.message ? `(lastfm: ${String(j.message).slice(0, 60)})` : '(lastfm: dinleme yok)';
    const sarki = `${t.artist?.['#text'] || '?'} — ${t.name || '?'}`;
    return t['@attr']?.nowplaying === 'true' ? sarki : `${sarki} (son dinlenen)`;
  } catch {
    return '(lastfm: servise ulaşılamadı)';
  }
}

/** Steam'in herkese açık profil XML'i (anahtarsız): oyun, çevrim içi durum, görünen ad */
async function steamProfili(ham: string): Promise<string> {
  const [kim = '', alan = 'oyun'] = String(ham || '').trim().split(/\s+/);
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(kim)) return '(steam: Steam kullanıcı adı ya da 64-bit kimlik yazın)';
  const yol = /^\d{17}$/.test(kim) ? `profiles/${kim}` : `id/${kim}`;
  const xml = await guvenliGetir(`https://steamcommunity.com/${yol}?xml=1`);
  if (xml.startsWith('(fetch')) return '(steam: profile ulaşılamadı)';
  const al = (etiket: string) => steamAlani(xml, etiket);
  if (/<error>/.test(xml)) return '(steam: profil bulunamadı)';
  const ad = al('steamID') || kim;
  if (alan === 'ad') return ad;
  const durum = al('onlineState');
  if (alan === 'durum') return durum === 'in-game' ? 'oyunda' : durum === 'online' ? 'çevrim içi' : 'çevrim dışı';
  const oyun = al('gameName');
  return oyun ? `${ad} şu an ${oyun} oynuyor` : `${ad} şu an oyunda değil`;
}

// ---- Hava durumu (Open-Meteo: anahtarsız; konum başına 10 dk önbellek) --------
const havaOnbellek = new Map<string, { zaman: number; metin: string }>();

async function havaDurumu(ham: string): Promise<string> {
  const yer = String(ham || '').trim().slice(0, 60);
  if (!yer) return '(weather: konum yazın — ör. $(weather İstanbul))';
  const anahtar = yer.toLocaleLowerCase('tr-TR');
  const o = havaOnbellek.get(anahtar);
  if (o && Date.now() - o.zaman < 10 * 60_000) return o.metin;
  try {
    const geo = JSON.parse(
      await guvenliGetir(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(yer)}&count=1&language=tr&format=json`)
    );
    const k = geo?.results?.[0];
    if (!k || !Number.isFinite(Number(k.latitude))) return `(weather: "${yer}" bulunamadı)`;
    const hava = JSON.parse(
      await guvenliGetir(
        `https://api.open-meteo.com/v1/forecast?latitude=${Number(k.latitude)}&longitude=${Number(k.longitude)}` +
          '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto'
      )
    );
    if (!hava?.current) return '(weather: veri alınamadı)';
    const metin = havaMetni(k, hava.current);
    havaOnbellek.set(anahtar, { zaman: Date.now(), metin });
    if (havaOnbellek.size > 200) havaOnbellek.delete(havaOnbellek.keys().next().value as string);
    return metin;
  } catch {
    return '(weather: hava durumu servisine ulaşılamadı)';
  }
}
