/**
 * AxBoT — `{{...}}` söz dizimi uyumu
 * Developed by AxthrowA
 *
 * KickBot belgelerindeki `{{sender.username}}`, `{{randomRange(1,6)}}` gibi
 * yer tutucular AxBoT'un `$(...)` değişkenlerine çevrilir; başka bottan
 * taşınan komutlar elle düzeltmeden çalışır. Tanınmayan `{{...}}` olduğu gibi
 * bırakılır (sessizce silinmez). Kaynak: herkese açık KickBot belgeleri.
 */

const KISI_ALANLARI = ['bio', 'instagram', 'twitter', 'youtube', 'discord', 'tiktok', 'facebook', 'followers', 'url'] as const;

/** `sender.x` / `taggedUser.x` / `streamer.x` → kimin değişkeni */
const KISI: Record<string, string> = {
  sender: '$(user)',
  taggeduser: '$(touser)',
  streamer: '$(channel)'
};

/** Düz (parametresiz) yer tutucular */
const DUZ: Record<string, string> = {
  username: '$(user)',
  'sender.username': '$(user)',
  'sender.displayname': '$(user)',
  'taggeduser.username': '$(touser)',
  'streamer.username': '$(channel)',
  'stream.title': '$(title)',
  'stream.category': '$(game)',
  'stream.game': '$(game)',
  'stream.viewers': '$(viewers)',
  'stream.uptime': '$(uptime)',
  target: '$(touser)',
  param: '$(query)',
  profileurl: 'https://kick.com/$(user)',
  'sender.points': '$(points)'
};

/** “akıllı” tırnakları ve çevreleyen tırnakları temizler */
function tirnaksiz(s: string): string {
  return s
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .trim();
}

/** Virgülle ayırır; tırnak içindeki virgüle dokunmaz. */
function virgulBol(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let tirnak = '';
  for (const ch of s) {
    if (tirnak) {
      if (ch === tirnak || (tirnak === '“' && ch === '”')) tirnak = '';
      cur += ch;
    } else if (ch === '"' || ch === "'" || ch === '“') {
      tirnak = ch;
      cur += ch;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** `;` değişken ayıracıdır; seçeneğin içinde geçerse virgüle çevrilir. */
const secenek = (s: string) => tirnaksiz(s).replace(/;/g, ',');

function fonksiyonCevir(ad: string, govde: string): string | null {
  const parcalar = virgulBol(govde);
  switch (ad) {
    case 'randomrange': {
      const [a, b] = parcalar.map((p) => Number(tirnaksiz(p)));
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      return `$(random ${Math.min(a, b)} ${Math.max(a, b)})`;
    }
    case 'randomitem':
      return parcalar.length ? `$(pick ${parcalar.map(secenek).join(';')})` : null;
    case 'randomitempercentage': {
      const ogeler: string[] = [];
      for (const p of parcalar) {
        const m = p.match(/^(.*?)\s*:\s*(\d+(?:\.\d+)?)\s*$/s);
        if (!m) return null;
        ogeler.push(`${secenek(m[1])}:${m[2]}`);
      }
      return ogeler.length ? `$(pickw ${ogeler.join(';')})` : null;
    }
    case 'request': {
      const adres = tirnaksiz(govde);
      return /^https?:\/\//i.test(adres) ? `$(urlfetch ${adres})` : null;
    }
    default:
      return null;
  }
}

/**
 * Metindeki tanınan `{{...}}` yer tutucularını `$(...)` biçimine çevirir.
 * Metinde `{{` yoksa aynen döner (sıcak yol ucuz kalsın).
 */
export function kickbotCevir(metin: string): string {
  if (!metin || !metin.includes('{{')) return metin;
  return metin.replace(/\{\{\s*([^{}]{1,300}?)\s*\}\}/g, (tum, icHam: string) => {
    const ic = icHam.trim();
    // Fonksiyon: ad(...)
    const f = ic.match(/^([a-zA-Z]+)\s*\(([\s\S]*)\)$/);
    if (f) return fonksiyonCevir(f[1].toLowerCase(), f[2]) ?? tum;

    const anahtar = ic.toLowerCase();
    if (DUZ[anahtar]) return DUZ[anahtar];

    // kişi.alan → $(kick alan kişi)
    const k = anahtar.match(/^(sender|taggeduser|streamer)\.([a-z]+)$/);
    if (k && (KISI_ALANLARI as readonly string[]).includes(k[2])) {
      const alan = k[2] === 'followers' ? 'takipci' : k[2];
      return `$(kick ${alan} ${KISI[k[1]]})`;
    }
    return tum;
  });
}
