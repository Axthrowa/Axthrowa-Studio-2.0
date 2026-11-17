/**
 * WID-1: özel widget (StreamElements uyumlu) — saf yardımcılar.
 *
 * Kod `sandbox="allow-scripts"` (allow-same-origin YOK) bir iframe'de çalışır: kökeni opak ("null"), botun
 * çerezine/depolamasına erişemez; CSP `connect-src https: wss:` yerel bot API'sine fetch/XHR/WebSocket açtırmaz,
 * sunucu da "null" kökenli yazma isteğini reddeder. Olaylar ana sayfadan `postMessage` köprüsüyle gelir.
 */

export interface SeAlan {
  type: string;
  label?: string;
  value?: unknown;
  options?: Record<string, string>;
  min?: number;
  max?: number;
  step?: number;
  group?: string;
}

export interface OzelWidget {
  ad: string;
  html: string;
  css: string;
  js: string;
  /** SE alan şeması (fields.json) */
  alanlar: Record<string, SeAlan>;
  /** Alan değerleri (SE fieldData / data.json) */
  veri: Record<string, unknown>;
  /** SE_API.store */
  depo?: Record<string, unknown>;
}

export const BOS_WIDGET: OzelWidget = {
  ad: 'Yeni widget',
  html: '<div id="kutu">Merhaba {{baslik}}</div>',
  css: '#kutu { font: 700 32px sans-serif; color: {{renk}}; }',
  js: "window.addEventListener('onEventReceived', (o) => {\n  const e = o.detail.event;\n  if (o.detail.listener === 'follower-latest') $('#kutu').text('Teşekkürler ' + e.name);\n});",
  alanlar: {
    baslik: { type: 'text', label: 'Başlık', value: 'dünya' },
    renk: { type: 'colorpicker', label: 'Renk', value: '#ffffff' }
  },
  veri: {}
};

/** Desteklenen SE alan türleri */
export const SE_ALAN_TURLERI = ['text', 'checkbox', 'colorpicker', 'number', 'slider', 'dropdown', 'image-input', 'video-input', 'sound-input', 'googleFont', 'button', 'hidden'] as const;

/** Alanların varsayılanları + kayıtlı değerler = SE `fieldData` */
export function alanVerisi(w: Pick<OzelWidget, 'alanlar' | 'veri'>): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const [k, a] of Object.entries(w.alanlar || {})) if (a && typeof a === 'object' && 'value' in a) d[k] = a.value;
  return { ...d, ...(w.veri || {}) };
}

/** SE gibi `{{alan}}` ve `{alan}` yerleştirmesi — yalnız bilinen alan adları (JS'teki `{a}` nesnelerine dokunmaz) */
export function yerlestir(metin: string, veri: Record<string, unknown>): string {
  return metin.replace(/\{\{\s*([\w-]+)\s*\}\}|\{([\w-]+)\}/g, (tum, a: string | undefined, b: string | undefined) => {
    const k = (a ?? b) as string;
    return Object.prototype.hasOwnProperty.call(veri, k) ? String(veri[k] ?? '') : tum;
  });
}

type SeOlayTuru = 'follower' | 'subscriber' | 'tip' | 'cheer' | 'raid' | 'host';
const SAYAC_TURLERI: SeOlayTuru[] = ['follower', 'subscriber', 'tip', 'cheer', 'raid', 'host'];

/** SE `session.data` iskeleti: widget'lar `data['follower-total'].count` gibi alanlara doğrudan erişir */
export function oturumIskeleti(): Record<string, any> {
  const d: Record<string, any> = {};
  for (const t of SAYAC_TURLERI) {
    d[`${t}-latest`] = { name: '', amount: 0, message: '' };
    for (const s of ['session', 'week', 'month', 'total', 'goal']) d[`${t}-${s}`] = { count: 0, amount: 0 };
    d[`${t}-recent`] = [];
  }
  return d;
}

export interface SeOlay {
  listener: string;
  event: Record<string, any>;
}

/** Şeffaf 1×1: rozet görseli olmayan platformda kırık resim simgesi çıkmasın */
const BOS_GORSEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function kacisla(m: string): string {
  return m.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Bot soket iletisi → SE `onEventReceived` ayrıntısı (karşılığı yoksa null) */
export function seOlayinaCevir(m: { type?: string; subType?: string; data?: any; alert?: any }): SeOlay | null {
  const d = m.data || {};
  if (m.type === 'chat' && d.user) {
    const roller = [d.user.isBroadcaster && 'broadcaster', d.user.isMod && 'moderator', d.user.isVip && 'vip', d.user.isSub && 'subscriber'].filter(Boolean) as string[];
    const metin = String(d.message ?? '');
    return {
      listener: 'message',
      event: {
        service: d.platform,
        data: {
          time: d.timestamp ?? Date.now(),
          tags: { badges: roller.map((r) => `${r}/1`).join(','), 'display-name': d.user.displayName, color: d.user.color || '', mod: d.user.isMod ? '1' : '0', subscriber: d.user.isSub ? '1' : '0' },
          nick: d.user.username,
          userId: d.user.id || d.user.username,
          displayName: d.user.displayName || d.user.username,
          displayColor: d.user.color || '',
          badges: roller.map((r) => ({ type: r, version: '1', url: BOS_GORSEL, description: r })),
          channel: d.channel,
          text: metin,
          isAction: false,
          emotes: [],
          msgId: d.id
        },
        renderedText: kacisla(metin)
      }
    };
  }
  if (m.type === 'chat_deleted') return { listener: 'delete-message', event: { msgId: d.id } };
  if (m.type === 'chat_user_removed') return { listener: 'delete-messages', event: { userId: d.username, nick: d.username } };
  if (m.type !== 'alert' || !m.subType || m.alert?.isReplay) return null;
  const ad = String(d.displayName || d.username || m.alert?.user || '');
  const ortak = { name: ad, displayName: ad, isTest: m.alert?.isTest === true || d.isTest === true };
  switch (m.subType) {
    case 'follow':
      return { listener: 'follower-latest', event: { ...ortak, type: 'follower' } };
    case 'sub':
    case 'gift_sub':
      return {
        listener: 'subscriber-latest',
        event: { ...ortak, type: 'subscriber', amount: Number(d.months) || 1, tier: String(d.tier ?? '1000'), gifted: m.subType === 'gift_sub', bulkGifted: (Number(d.count) || 0) > 1, sender: m.subType === 'gift_sub' ? ad : undefined }
      };
    case 'tip':
      return { listener: 'tip-latest', event: { ...ortak, type: 'tip', amount: Number(d.amount) || 0, message: String(d.message ?? ''), currency: d.currency } };
    case 'kicks':
      // Kick'in bits karşılığı
      return { listener: 'cheer-latest', event: { ...ortak, type: 'cheer', amount: Number(d.amount) || 0, message: String(d.message ?? '') } };
    case 'raid':
      return { listener: 'raid-latest', event: { ...ortak, type: 'raid', amount: Number(d.viewers) || 0 } };
    case 'host':
      return { listener: 'host-latest', event: { ...ortak, type: 'host', amount: Number(d.viewers) || 0 } };
    default:
      return null;
  }
}

/** Olayı oturum sayaçlarına işler (SE `onSessionUpdate`); değişmezse aynı nesne */
export function oturumaIsle(data: Record<string, any>, o: SeOlay): Record<string, any> {
  const t = o.listener.replace(/-latest$/, '') as SeOlayTuru;
  if (!SAYAC_TURLERI.includes(t) || o.event.isTest) return data;
  const miktar = Number(o.event.amount) || 0;
  const yeni = { ...data, [`${t}-latest`]: { name: o.event.name, amount: miktar, message: o.event.message ?? '' } };
  for (const s of ['session', 'week', 'month', 'total']) {
    const k = `${t}-${s}`;
    yeni[k] = { ...data[k], count: (Number(data[k]?.count) || 0) + 1, amount: (Number(data[k]?.amount) || 0) + miktar };
  }
  yeni[`${t}-recent`] = [{ name: o.event.name, amount: miktar, createdAt: new Date().toISOString() }, ...(data[`${t}-recent`] || [])].slice(0, 25);
  return yeni;
}

/** Editördeki "Test" düğmeleri (SE'nin "Emulate" karşılığı) */
export function testOlayi(tur: 'follower' | 'subscriber' | 'tip' | 'cheer' | 'raid' | 'message'): SeOlay {
  const ortak = { name: 'TestIzleyici', displayName: 'TestIzleyici', isTest: true };
  if (tur === 'message') {
    return seOlayinaCevir({
      type: 'chat',
      data: { id: `test-${Date.now()}`, platform: 'twitch', channel: 'kanal', message: 'Merhaba! Bu bir test iletisi', timestamp: Date.now(), user: { id: 'test', username: 'testizleyici', displayName: 'TestIzleyici', isSub: true, color: '#a78bfa' } }
    })!;
  }
  const ek: Record<string, Record<string, unknown>> = {
    follower: {},
    subscriber: { amount: 3, tier: '1000', gifted: false },
    tip: { amount: 50, message: 'Harika yayın!', currency: 'TRY' },
    cheer: { amount: 100, message: 'Kick!' },
    raid: { amount: 25 }
  };
  return { listener: `${tur}-latest`, event: { ...ortak, type: tur, ...ek[tur] } };
}

/** onWidgetLoad ayrıntısı */
export function yuklemeAyrintisi(fieldData: Record<string, unknown>, oturum: Record<string, any>, editorde: boolean) {
  return {
    channel: { username: 'axbot', apiToken: '', id: 'axbot', providerId: '', avatar: '' },
    currency: { code: 'TRY', name: 'Türk lirası', symbol: '₺' },
    fieldData,
    recents: [],
    session: { data: oturum, settings: { autoReset: false } },
    overlay: { isEditorMode: editorde, muted: false },
    emotes: []
  };
}

/** jQuery: SE katmanları sayfaya hazır verir; yazılan widget'ların çoğu `$` kullanır */
const JQUERY = '<script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>';

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'unsafe-inline' https:",
  'img-src * data: blob:',
  'media-src * data: blob:',
  'font-src https: data:',
  // Yerel bot API'si (http://127.0.0.1) bu listede yok: iframe'den fetch/XHR/WebSocket açılamaz
  'connect-src https: wss:',
  'frame-src https:'
].join('; ');

/** iframe içindeki köprü: SE_API ve ana sayfadan gelen olayların `window` olayına çevrilmesi */
function kopruBetigi(editorde: boolean): string {
  return `(function(){
var n=0,b={};
function iste(tur,veri){return new Promise(function(r){var id=++n;b[id]=r;parent.postMessage({axtOzel:1,tur:tur,id:id,veri:veri},'*');});}
window.addEventListener('message',function(e){if(e.source!==parent)return;var m=e.data||{};
if(m.axtYanit){if(b[m.id]){b[m.id](m.deger);delete b[m.id];}return;}
if(m.axtOlay){window.dispatchEvent(new CustomEvent(m.axtOlay,{detail:m.detail}));}});
window.SE_API={store:{get:function(k){return iste('depoOku',{k:k});},set:function(k,v){iste('depoYaz',{k:k,v:v});}},
counters:{get:function(k){return Promise.resolve({counter:k,value:0});}},
resumeQueue:function(){},sanitize:function(o){return Promise.resolve({result:{message:(o&&o.message)||''},skip:false});},
cheerFilter:function(m){return Promise.resolve(m);},setField:function(k,v){iste('alanYaz',{k:k,v:v});},
getOverlayStatus:function(){return {isEditorMode:${editorde},muted:false};}};
})();`;
}

/** Kullanıcı metni betik/stil etiketini kapatamasın */
const betikIci = (s: string) => s.replace(/<\/script/gi, '<\\/script');
const stilIci = (s: string) => s.replace(/<\/style/gi, '');

export function srcdocOlustur(w: OzelWidget, editorde = false): string {
  const veri = alanVerisi(w);
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<script>${kopruBetigi(editorde)}</script>
${JQUERY}
<style>html,body{margin:0;background:transparent;overflow:hidden}</style>
<style>${stilIci(yerlestir(w.css || '', veri))}</style>
</head><body>
${yerlestir(w.html || '', veri)}
<script>${betikIci(yerlestir(w.js || '', veri))}</script>
</body></html>`;
}
