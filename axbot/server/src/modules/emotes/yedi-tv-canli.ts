/**
 * WID-4: kanalın 7TV seti değişince (emote eklendi/kaldırıldı) önbellek hemen tazelenir ve katmanlara
 * `emotes_tazele` gider. 7TV EventAPI: hello (op 1) → abone ol (op 35, emote_set.update) → olay (op 0).
 * Yalnız sabit events.7tv.io adresi; set kimliği 7TV yanıtından gelir ve yalnız [A-Za-z0-9] kabul edilir.
 */
import WebSocket from 'ws';
import { eventBus } from '../../core/event-bus.js';
import { kanallarlaGetir } from './yedi-tv.js';

let soket: WebSocket | null = null;
let izlenen: string | null = null;
let bekleme = 2000;
let zamanlayici: ReturnType<typeof setTimeout> | null = null;
let tazeleZamani: ReturnType<typeof setTimeout> | null = null;

function abone(ws: WebSocket, setId: string) {
  ws.send(JSON.stringify({ op: 35, d: { type: 'emote_set.update', condition: { object_id: setId } } }));
}

/** Art arda gelen değişiklikler tek tazelemede birleşir */
function tazele() {
  if (tazeleZamani) return;
  tazeleZamani = setTimeout(() => {
    tazeleZamani = null;
    void kanallarlaGetir(true)
      .then(() => eventBus.emit('widget_update', { type: 'emotes_tazele' }))
      .catch(() => {});
  }, 1500);
}

function baglan() {
  if (!izlenen) return;
  const ws = new WebSocket('wss://events.7tv.io/v3', { headers: { 'User-Agent': 'AxBoT' } });
  soket = ws;
  ws.on('message', (ham) => {
    let m: any;
    try {
      m = JSON.parse(String(ham));
    } catch {
      return;
    }
    if (m?.op === 1 && izlenen) {
      bekleme = 2000;
      abone(ws, izlenen);
    } else if (m?.op === 0 && m?.d?.type === 'emote_set.update' && m?.d?.body?.id === izlenen) tazele();
    // op 4 (yeniden bağlan) ve op 7 (sunucu kapatıyor): kapanış sonrası yeniden bağlanılır
    else if (m?.op === 4) ws.close();
  });
  ws.on('error', () => {});
  ws.on('close', () => {
    if (soket !== ws) return;
    soket = null;
    if (!izlenen) return;
    zamanlayici = setTimeout(baglan, bekleme);
    bekleme = Math.min(bekleme * 2, 5 * 60_000);
  });
}

/** Kanal seti kimliği bilinince çağrılır; değişirse eski abonelik kapanır. `null` izlemeyi durdurur. */
export function yediTvSetiniIzle(setId: string | null): void {
  const yeni = setId && /^[A-Za-z0-9]{10,40}$/.test(setId) ? setId : null;
  if (yeni === izlenen) return;
  izlenen = yeni;
  if (zamanlayici) clearTimeout(zamanlayici);
  zamanlayici = null;
  const eski = soket;
  soket = null;
  eski?.close();
  if (yeni) baglan();
}
