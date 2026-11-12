/**
 * AxBoT — bu makinenin adresleri (Host izin listesi için)
 * Developed by AxthrowA
 *
 * LAN kipinde (AXBOT_HOST=0.0.0.0) OBS başka bir bilgisayardan
 * `http://192.168.1.5:3001/widgets/...` ile bağlanır: Host bu makinenin IP'si
 * olur ve kabul edilmelidir. IP'ler DHCP ile değişebildiği için 30 sn'de bir
 * yenilenir.
 */
import os from 'node:os';
import { ekHostlariCoz } from './origin-guard.js';

let onbellek: { zaman: number; kume: Set<string> } | null = null;

export function arayuzAdresleri(): Set<string> {
  if (onbellek && Date.now() - onbellek.zaman < 30_000) return onbellek.kume;
  const kume = new Set<string>();
  try {
    for (const liste of Object.values(os.networkInterfaces())) {
      for (const a of liste || []) {
        if (a?.address) kume.add(a.address.toLowerCase().split('%')[0]);
      }
    }
    const ad = os.hostname().toLowerCase();
    if (ad) kume.add(ad);
  } catch {
    /* arayüz okunamazsa yalnız döngü adresleri geçerli kalır */
  }
  onbellek = { zaman: Date.now(), kume };
  return kume;
}

/** Kullanıcının eklediği adlar: AXBOT_IZINLI_HOSTLAR="yayin.local,ev-pc" */
export function ekIzinliHostlar(): Set<string> {
  return ekHostlariCoz(process.env.AXBOT_IZINLI_HOSTLAR);
}
