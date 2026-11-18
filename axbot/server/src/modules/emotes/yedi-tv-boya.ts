/**
 * WID-4: 7TV isim boyaları. Sohbet katmanı kullanıcı adını 7TV'deki boyasıyla (degrade, görsel, gölge) çizer.
 * Kullanıcı → boya kimliği 7tv.io/v3/users/<platform>/<kimlik>, boya tanımı 7tv.io/v3/gql'den; ikisi de önbellekte.
 * Katman 7TV'ye hiç gitmez: CSS burada kurulur, görsel adresi yalnız cdn.7tv.app/paint/… olabilir.
 */
import axios from 'axios';
import https from 'https';

export interface BoyaCss {
  /** `background-image` değeri (metne kırpılır) */
  arkaPlan: string;
  /** `filter` değeri (drop-shadow zinciri) */
  golge?: string;
}

const AJAN = new https.Agent({ family: 4, keepAlive: false });
const OPTS = { timeout: 8000, httpsAgent: AJAN, headers: { Accept: 'application/json', 'User-Agent': 'AxBoT' } };
const KULLANICI_MS = 30 * 60_000;
const EN_COK_KULLANICI = 5000;
const BOYA_KIMLIGI = /^[A-Za-z0-9]{10,40}$/;

/** 7TV rengi: işaretli 32 bit RGBA tamsayı */
export function renk(c: unknown): string {
  const n = Number(c);
  if (!Number.isFinite(n)) return 'transparent';
  const r = (n >>> 24) & 255;
  const g = (n >>> 16) & 255;
  const b = (n >>> 8) & 255;
  const a = Math.round(((n & 255) / 255) * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** GQL boya tanımı → CSS (tanınmayan biçim null) */
export function boyaCss(p: any): BoyaCss | null {
  if (!p || typeof p !== 'object') return null;
  const tekrar = p.repeat ? 'repeating-' : '';
  const duraklar = (Array.isArray(p.stops) ? p.stops : [])
    .slice(0, 32)
    .map((s: any) => `${renk(s?.color)} ${Math.round(Math.max(0, Math.min(1, Number(s?.at) || 0)) * 1000) / 10}%`)
    .join(', ');
  let arkaPlan: string | null = null;
  if (p.function === 'LINEAR_GRADIENT' && duraklar) arkaPlan = `${tekrar}linear-gradient(${Number(p.angle) || 0}deg, ${duraklar})`;
  else if (p.function === 'RADIAL_GRADIENT' && duraklar) arkaPlan = `${tekrar}radial-gradient(${p.shape === 'ellipse' ? 'ellipse' : 'circle'}, ${duraklar})`;
  else if (p.function === 'URL' && /^https:\/\/cdn\.7tv\.app\/paint\/[\w/.-]+$/.test(String(p.image_url))) arkaPlan = `url("${p.image_url}")`;
  else if (p.color != null) arkaPlan = `linear-gradient(${renk(p.color)}, ${renk(p.color)})`;
  if (!arkaPlan) return null;
  const golgeler = (Array.isArray(p.shadows) ? p.shadows : [])
    .slice(0, 6)
    .map((s: any) => `drop-shadow(${Number(s?.x_offset) || 0}px ${Number(s?.y_offset) || 0}px ${Math.max(0, Number(s?.radius) || 0)}px ${renk(s?.color)})`);
  return golgeler.length ? { arkaPlan, golge: golgeler.join(' ') } : { arkaPlan };
}

const kullanicilar = new Map<string, { boya: string | null; zaman: number }>();
const boyalar = new Map<string, BoyaCss | null>();
const bekleyen = new Map<string, Promise<BoyaCss | null>>();

async function boyaTanimi(id: string): Promise<BoyaCss | null> {
  if (boyalar.has(id)) return boyalar.get(id)!;
  const sorgu = `query { cosmetics(list: ["${id}"]) { paints { id function color angle shape image_url repeat stops { at color } shadows { x_offset y_offset radius color } } } }`;
  const r = await axios.post('https://7tv.io/v3/gql', { query: sorgu }, OPTS);
  const css = boyaCss(r.data?.data?.cosmetics?.paints?.[0]);
  if (boyalar.size > 2000) boyalar.clear();
  boyalar.set(id, css);
  return css;
}

/** Sohbetteki kullanıcının boyası; 7TV hesabı/boyası yoksa ya da ulaşılamazsa null */
export async function kullaniciBoyasi(platform: 'kick' | 'twitch', kimlik: string): Promise<BoyaCss | null> {
  if (!/^\d{1,20}$/.test(kimlik)) return null;
  const anahtar = `${platform}:${kimlik}`;
  const k = kullanicilar.get(anahtar);
  if (k && Date.now() - k.zaman < KULLANICI_MS) return k.boya ? boyaTanimi(k.boya).catch(() => null) : null;
  let is = bekleyen.get(anahtar);
  if (!is) {
    is = (async () => {
      let boya: string | null = null;
      try {
        const r = await axios.get(`https://7tv.io/v3/users/${platform}/${kimlik}`, { ...OPTS, validateStatus: (s) => s === 200 || s === 404 });
        const id = r.status === 200 ? String(r.data?.user?.style?.paint_id ?? '') : '';
        boya = BOYA_KIMLIGI.test(id) ? id : null;
      } catch {
        return null; // ağ hatası önbelleğe yazılmaz
      }
      if (kullanicilar.size >= EN_COK_KULLANICI) kullanicilar.delete(kullanicilar.keys().next().value as string);
      kullanicilar.set(anahtar, { boya, zaman: Date.now() });
      return boya ? boyaTanimi(boya).catch(() => null) : null;
    })().finally(() => bekleyen.delete(anahtar));
    bekleyen.set(anahtar, is);
  }
  return is;
}
