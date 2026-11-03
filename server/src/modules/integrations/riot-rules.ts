/**
 * AxBoT — League of Legends sıralaması: saf kurallar
 * Developed by AxthrowA
 *
 * `$(leagueoflegends <Riot kimliği> <bölge>)` (BotRix belgesinde gözlenen
 * değişken; KNOWN_LIMITATIONS N3). Kaynak: developer.riotgames.com
 * (CONFIRMED_IN_PUBLIC_DOCS):
 *   • ACCOUNT-V1  GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
 *                 — BÖLGESEL yönlendirme (americas / asia / europe)
 *   • LEAGUE-V4   GET /lol/league/v4/entries/by-puuid/{puuid}
 *                 — PLATFORM yönlendirmesi (tr1, euw1, kr…)
 *   • Platform → bölge eşlemesi "docs/lol" sayfasındaki tablodan.
 * Anahtar `X-Riot-Token` başlığıyla gider.
 */

/** Platform kodu → hesap (account-v1) için bölgesel küme. */
const PLATFORM_BOLGE: Record<string, 'americas' | 'asia' | 'europe'> = {
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  kr: 'asia',
  jp1: 'asia',
  // SEA platformları: account-v1 SEA kümesi sunmuyor; hesap her kümeden
  // sorgulanabildiği için en yakın 'asia' kullanılır.
  oc1: 'asia',
  ph2: 'asia',
  sg2: 'asia',
  th2: 'asia',
  tw2: 'asia',
  vn2: 'asia'
};

/** Kullanıcıların yazdığı kısa adlar → platform kodu. */
const TAKMA_AD: Record<string, string> = {
  tr: 'tr1',
  euw: 'euw1',
  eune: 'eun1',
  na: 'na1',
  br: 'br1',
  lan: 'la1',
  las: 'la2',
  jp: 'jp1',
  oce: 'oc1',
  ph: 'ph2',
  sg: 'sg2',
  th: 'th2',
  tw: 'tw2',
  vn: 'vn2'
};

export interface LolSorgusu {
  ad: string;
  etiket: string;
  platform: string;
  bolge: 'americas' | 'asia' | 'europe';
}

export function platformCoz(ham: unknown): string | null {
  const s = String(ham ?? '').trim().toLowerCase();
  const p = TAKMA_AD[s] || s;
  return PLATFORM_BOLGE[p] ? p : null;
}

/**
 * `Hide on bush#KR1 kr` → { ad: 'Hide on bush', etiket: 'KR1', platform: 'kr' }.
 * Oyun adı BOŞLUK içerebilir; bölge son sözcüktür. Bölge yazılmazsa
 * `varsayilanPlatform` (ayar) kullanılır.
 */
export function lolSorgusuCoz(ham: string, varsayilanPlatform = 'tr1'): LolSorgusu | null {
  const parcalar = String(ham || '').trim().split(/\s+/).filter(Boolean);
  if (!parcalar.length) return null;
  let platform = platformCoz(parcalar[parcalar.length - 1]);
  if (platform && parcalar.length > 1) parcalar.pop();
  else platform = platformCoz(varsayilanPlatform);
  if (!platform) return null;

  const kimlik = parcalar.join(' ');
  const i = kimlik.lastIndexOf('#');
  if (i <= 0 || i === kimlik.length - 1) return null;
  const ad = kimlik.slice(0, i).trim();
  const etiket = kimlik.slice(i + 1).trim();
  // Riot kimliği: oyun adı 3–16, etiket 3–5 karakter (istemci kuralı);
  // sınırı biraz geniş tutuyoruz, ama boşluk/# etikette olamaz.
  if (!ad || ad.length > 32 || !/^[\p{L}\p{N}]{2,8}$/u.test(etiket)) return null;
  return { ad, etiket, platform, bolge: PLATFORM_BOLGE[platform] };
}

export interface LigKaydi {
  queueType?: string;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
}

const KUYRUK: Record<string, string> = {
  RANKED_SOLO_5x5: 'Tekli/Çiftli',
  RANKED_FLEX_SR: 'Esnek'
};

/** `GOLD` → `Gold`. Kademe adları oyundaki (İngilizce) haliyle kalır. */
function kademe(t: string): string {
  const s = String(t || '').toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

/** Kayıtlardan tek satır: önce Tekli/Çiftli, yoksa Esnek. */
export function siralamaMetni(kimlik: string, kayitlar: LigKaydi[]): string {
  const k =
    kayitlar.find((x) => x.queueType === 'RANKED_SOLO_5x5') ||
    kayitlar.find((x) => x.queueType === 'RANKED_FLEX_SR');
  if (!k || !k.tier) return `${kimlik}: bu sezon dereceli oynamamış`;
  // Usta ve üstünde küme (I–IV) yoktur
  const ust = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(String(k.tier).toUpperCase());
  const derece = ust ? kademe(k.tier) : `${kademe(k.tier)} ${k.rank || ''}`.trim();
  const g = Number(k.wins) || 0;
  const m = Number(k.losses) || 0;
  const oran = g + m > 0 ? ` · %${Math.round((g * 100) / (g + m))}` : '';
  return `${kimlik} (${KUYRUK[k.queueType || ''] || 'Dereceli'}): ${derece}, ${Number(k.leaguePoints) || 0} LP · ${g}G ${m}M${oran}`;
}
