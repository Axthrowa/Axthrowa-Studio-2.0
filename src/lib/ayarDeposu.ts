/**
 * TEK-3 (H9): Studio'nun ortak ayar deposu. `fetchSettings` buradan okur:
 * - aynı ekran için aynı anda gelen istekler tek isteğe iner;
 * - `/ws/overlay-sync` soketi açıkken sunucunun `settings` yayını depoyu günceller, okuma ağa gitmez;
 * - soket kapalıyken her okuma sunucuya gider (önbellek bayatlayabilir, güvenilmez).
 * Çağıran her seferinde kopya alır: birinin nesneyi değiştirmesi depoyu bozmaz.
 */
import { overlaySyncOpen, subscribeOverlaySync } from "./overlaySyncHub";

type Ayar = Record<string, unknown>;
type Kayit = { veri?: Ayar; istek?: Promise<Ayar>; surum: number };

const depo = new Map<string, Kayit>();
let abone = false;

const kayit = (ekran: string) => {
  let k = depo.get(ekran);
  if (!k) depo.set(ekran, (k = { surum: 0 }));
  return k;
};

const kopya = <T>(v: T): T => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

/** Sunucudan gelen ya da az önce yazılan ayarı depoya koyar */
export function ayarYaz(ekran: string, veri: unknown) {
  if (!veri || typeof veri !== "object") return;
  const k = kayit(ekran);
  k.veri = veri as Ayar;
  k.surum++;
}

/** Yayın mesajı: `{type:"settings",screen,data}` ya da açılıştaki `{type:"snapshot",starting,…}` */
export function yayinIsle(m: unknown) {
  if (!m || typeof m !== "object") return;
  const o = m as Record<string, unknown>;
  if (o.type === "settings" && typeof o.screen === "string") ayarYaz(o.screen, o.data);
  else if (o.type === "snapshot") for (const e of ["starting", "ending", "brb", "chat", "panel"]) if (o[e]) ayarYaz(e, o[e]);
}

function aboneOl() {
  // Testlerde (pencere yok) soket açılmaz
  if (abone || typeof window === "undefined") return;
  abone = true;
  subscribeOverlaySync({
    onMessage: (ev) => {
      try {
        yayinIsle(JSON.parse(String(ev.data)));
      } catch {
        /* */
      }
    },
  });
}

/** Ekran ayarını depodan okur; gerekirse `getir` ile bir kez ister */
export function ayarOku(ekran: string, getir: () => Promise<Ayar>, sokAcik: () => boolean = overlaySyncOpen): Promise<Ayar> {
  aboneOl();
  const k = kayit(ekran);
  if (k.veri && sokAcik()) return Promise.resolve(kopya(k.veri));
  if (!k.istek) {
    const basta = k.surum;
    const istek = getir()
      .then((v) => {
        // İstek sürerken soketten daha yeni ayar geldiyse eski yanıt onu ezmez
        if (k.surum === basta) ayarYaz(ekran, v);
        return k.veri ?? v;
      })
      .finally(() => {
        if (k.istek === istek) k.istek = undefined;
      });
    k.istek = istek;
  }
  return k.istek.then(kopya);
}

/** Yalnız testler için */
export function _depoyuSifirla() {
  depo.clear();
}
