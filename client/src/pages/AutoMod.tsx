/**
 * AxBoT AutoMod
 * Developed by AxthrowA
 *
 * DÜZELTME (3. tur): Bu sayfadaki "Aksiyon" ve "Timeout" seçimleri
 * `automod_advanced` JSON'una `warning/delete/timeout` olarak yazılıyordu ama
 * ihlal motoru (enforcement.ts) kural başına SÜTUNLARI okuyor — seçimler hiç
 * uygulanmıyordu. Artık eylem, süre ve uyarı mesajı doğrudan motorun
 * okuduğu yere (`actions`) yazılıyor; Gelişmiş Bot > Moderasyon Eylemleri ile
 * aynı veriyi düzenliyor.
 */
import { useState, useEffect } from 'react';
import { AutoModSettings } from '../types.js';
import { Plus, X, Link, Type, Smile, Ban, Hash, User } from 'lucide-react';
import { KayitDurumu, useToast } from '../ui/index.js';
import { useOtoKayit } from '../hooks/useOtoKayit.js';

type Adv = {
  caps_timeout: number; caps_exclude_subs: boolean; caps_exclude_vips: boolean; caps_warning: string; caps_action: string;
  links_timeout: number; links_permit_seconds: number; links_exclude_subs: boolean; links_warning: string; links_action: string;
  emotes_timeout: number; emotes_exclude_subs: boolean; emotes_warning: string; emotes_action: string;
  symbols_timeout: number; symbols_min_length: number; symbols_exclude_subs: boolean; symbols_warning: string; symbols_action: string;
  blacklist_timeout: number; blacklist_exclude_subs: boolean; blacklist_warning: string; blacklist_action: string;
  name_enabled: boolean; name_words: string[]; name_regex: string; name_timeout: number; name_warning: string;
  zalgo_enabled: boolean; zalgo_action: string; zalgo_timeout: number; zalgo_warning: string;
  length_enabled: boolean; length_max: number; length_action: string; length_timeout: number; length_warning: string;
  merdiven_acik: boolean; merdiven_pencere_dk: number; moderasyon_hesabi: 'kanal' | 'bot';
};

const ADV_DEFAULT: Adv = {
  caps_timeout: 30, caps_exclude_subs: false, caps_exclude_vips: true, caps_warning: 'Lütfen CAPS kullanmayı azalt.', caps_action: 'timeout',
  links_timeout: 60, links_permit_seconds: 60, links_exclude_subs: false, links_warning: 'İzinsiz link paylaşımı yasak.', links_action: 'timeout',
  emotes_timeout: 20, emotes_exclude_subs: false, emotes_warning: 'Emote spam yapma.', emotes_action: 'delete',
  symbols_timeout: 20, symbols_min_length: 8, symbols_exclude_subs: false, symbols_warning: 'Sembol spam yasak.', symbols_action: 'delete',
  blacklist_timeout: 300, blacklist_exclude_subs: false, blacklist_warning: 'Yasaklı kelime kullanıldı.', blacklist_action: 'timeout',
  name_enabled: false, name_words: [], name_regex: '', name_timeout: 600, name_warning: 'Kullanıcı adın kurala uymuyor.',
  zalgo_enabled: false, zalgo_action: 'delete_warn', zalgo_timeout: 60, zalgo_warning: 'Bozuk (Zalgo) yazı kullanımı yasaktır.',
  length_enabled: false, length_max: 400, length_action: 'delete', length_timeout: 60, length_warning: 'Mesaj çok uzun.',
  merdiven_acik: false, merdiven_pencere_dk: 30, moderasyon_hesabi: 'kanal'
};

const TABS = [
  { id: 'caps', label: 'Büyük Harf' },
  { id: 'links', label: 'Link' },
  { id: 'emotes', label: 'Emoji' },
  { id: 'symbols', label: 'Sembol' },
  { id: 'words', label: 'Yasaklı Kelimeler' },
  { id: 'repeat', label: 'Tekrar' },
  { id: 'name', label: 'Kullanıcı Adı' },
  { id: 'ceza', label: 'Ceza' }
];

type Kural = 'caps' | 'links' | 'emotes' | 'symbols' | 'blacklist' | 'repeat';
const KURALLAR: Kural[] = ['caps', 'links', 'emotes', 'symbols', 'blacklist', 'repeat'];
interface KuralEylemi { action: string; timeout: number; message: string }

/** Motorun kabul ettiği eylemler (server/modules/automod/enforcement.ts). */
const EYLEMLER = [
  { value: 'warn', label: 'Uyarı mesajı gönder' },
  { value: 'timeout', label: 'Zaman aşımı ver' },
  { value: 'timeout_warn', label: 'Zaman aşımı + uyarı' },
  { value: 'delete', label: 'Mesajı sil' },
  { value: 'delete_warn', label: 'Sil + uyarı' }
];

/** Örnek alınan bottaki on bir kademe. */
const SURELER = [
  [30, '30 sn'], [60, '1 dk'], [120, '2 dk'], [300, '5 dk'], [600, '10 dk'], [900, '15 dk'], [1800, '30 dk'],
  [3600, '1 sa'], [7200, '2 sa'], [18000, '5 sa'], [43200, '12 sa'], [86400, '1 gün']
] as const;

export function AutoMod() {
  const [settings, setSettings] = useState<AutoModSettings | null>(null);
  const [adv, setAdv] = useState<Adv>(ADV_DEFAULT);
  const [tab, setTab] = useState('caps');
  const [kural, setKural] = useState<Record<Kural, KuralEylemi> | null>(null);
  const [newWord, setNewWord] = useState('');
  /** Kayıtta reddedilen (geçersiz/riskli) kara liste kalıpları. */
  const [gecersiz, setGecersiz] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newNameWord, setNewNameWord] = useState('');
  const toast = useToast();
  // Anlık kayıt; Ctrl+Z üç parçayı birlikte geri getirir
  const { taban, durum, yeniden } = useOtoKayit({ settings, adv, kural }, () => handleSave(), (v) => {
    setSettings(v.settings);
    setAdv(v.adv);
    setKural(v.kural);
  });

  useEffect(() => {
    fetch('/api/automod')
      .then(r => r.json())
      .then(d => {
        setSettings(d);
        const a = { ...ADV_DEFAULT, ...(d.advanced || {}) };
        setAdv(a);
        // Gerçek kaynak: kural başına sütunlar. Mesaj boşsa eski uyarı metni.
        const uyari: Record<Kural, string> = {
          caps: a.caps_warning, links: a.links_warning, emotes: a.emotes_warning,
          symbols: a.symbols_warning, blacklist: a.blacklist_warning, repeat: (a as any).repeat_warning || ''
        };
        const k = {} as Record<Kural, KuralEylemi>;
        for (const r of KURALLAR) {
          k[r] = {
            action: String(d[`${r}_action`] || 'warn'),
            timeout: Number(d[`${r}_timeout`]) || 60,
            message: String(d[`${r}_message`] || uyari[r] || '')
          };
        }
        setKural(k);
        taban({ settings: d, adv: a, kural: k });
      })
      .catch(() => {});
  }, [taban]);

  const handleSave = async (): Promise<boolean> => {
    if (!settings) return false;
    const res = await fetch('/api/automod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `actions`: motorun okuduğu kural başına eylem/süre/mesaj
      body: JSON.stringify({ ...settings, advanced: adv, actions: kural || undefined })
    }).catch(() => null);
    if (!res?.ok) {
      // Eskiden başarısız kayıt sessizce yutuluyordu
      const hata = res ? await res.json().catch(() => null) : null;
      toast(`Moderasyon ayarları kaydedilemedi${hata?.error ? `: ${hata.error}` : ''}`, 'hata');
      return false;
    }
    const yanit = await res.json().catch(() => null);
    setGecersiz(Array.isArray(yanit?.gecersizKaliplar) ? yanit.gecersizKaliplar : []);
    return true;
  };

  if (!settings || !kural) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  const ekKural = (on: 'zalgo' | 'length', baslik: string, aciklama: string) => (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
      <label className="flex justify-between text-xs font-bold">{baslik} <input type="checkbox" checked={!!(adv as any)[on + '_enabled']} onChange={e => setAdv(a => ({ ...a, [on + '_enabled']: e.target.checked } as any))} /></label>
      <p className="text-[11px] text-gray-500">{aciklama}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {on === 'length' && <label className="space-y-1">En çok karakter<input type="number" min={20} max={2000} value={adv.length_max} onChange={e => setAdv(a => ({ ...a, length_max: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-lg p-1.5" /></label>}
        <label className="space-y-1">Eylem<select value={(adv as any)[on + '_action']} onChange={e => setAdv(a => ({ ...a, [on + '_action']: e.target.value } as any))} className="w-full bg-black/40 border border-white/10 rounded-lg p-1.5"><option value="warn">Uyar</option><option value="delete">Sil</option><option value="delete_warn">Sil + uyar</option><option value="timeout_warn">Sustur + uyar</option></select></label>
        <label className="space-y-1">Susturma (sn)<input type="number" min={30} max={86400} value={(adv as any)[on + '_timeout']} onChange={e => setAdv(a => ({ ...a, [on + '_timeout']: +e.target.value } as any))} className="w-full bg-black/40 border border-white/10 rounded-lg p-1.5" /></label>
      </div>
      <input value={(adv as any)[on + '_warning']} onChange={e => setAdv(a => ({ ...a, [on + '_warning']: e.target.value } as any))} className="w-full bg-black/40 border border-white/10 rounded-lg p-1.5 text-xs" placeholder="Uyarı mesajı" />
    </div>
  );

  const kuralDegis = (r: Kural, yama: Partial<KuralEylemi>) => setKural({ ...kural, [r]: { ...kural[r], ...yama } });

  /** Kural başına eylem — motorun okuduğu yere yazılır. */
  // NOT: Bileşen değil düz fonksiyon — render içinde tanımlanan bileşen her
  // tuşta yeniden bağlanır ve metin kutusu odağı kaybederdi.
  const eylemSecimi = (k: string) => {
    const r = (k.replace(/_action$/, '') as Kural);
    const e = kural[r];
    const sureli = e.action === 'timeout' || e.action === 'timeout_warn';
    return (
      <>
        <label className="text-xs text-gray-300 font-bold space-y-1">
          İhlal eylemi
          <select value={e.action} onChange={ev => kuralDegis(r, { action: ev.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
            {EYLEMLER.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </label>
        {sureli && (
          <label className="text-xs text-gray-300 font-bold space-y-1">
            Zaman aşımı süresi
            <select value={e.timeout} onChange={ev => kuralDegis(r, { timeout: Number(ev.target.value) })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              {SURELER.map(([sn, ad]) => <option key={sn} value={sn}>{ad}</option>)}
            </select>
          </label>
        )}
      </>
    );
  };

  const uyariMesaji = (r: Kural) => (
    <label className="text-xs space-y-1 block">Uyarı mesajı<input value={kural[r].message} onChange={e => kuralDegis(r, { message: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Bot Moderasyonu</h1>
          <p className="text-sm text-gray-400">Büyük harf, link, emoji, sembol, yasaklı kelime, tekrar ve kullanıcı adı koruması.</p>
        </div>
        <KayitDurumu durum={durum} onYeniden={yeniden} />
      </div>

      <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-bold ${tab === t.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'caps' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Type className="w-5 h-5 text-purple-400" /><h2 className="font-bold">Büyük Harf Koruması</h2></div>
          <label className="flex justify-between text-xs">Caps Lock filtresi <input type="checkbox" checked={settings.caps_enabled !== 0} onChange={e => setSettings({ ...settings, caps_enabled: e.target.checked ? 1 : 0 })} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">Asgari karakter<input type="number" value={settings.caps_min_length} onChange={e => setSettings({ ...settings, caps_min_length: +e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            <label className="text-xs space-y-1">Max büyük harf % ({settings.caps_max_percent})<input type="range" min={30} max={100} value={settings.caps_max_percent} onChange={e => setSettings({ ...settings, caps_max_percent: +e.target.value })} className="w-full" /></label>
            {eylemSecimi("caps_action")}
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={adv.caps_exclude_subs} onChange={e => setAdv(a => ({ ...a, caps_exclude_subs: e.target.checked }))} /></label>
          <label className="flex justify-between text-xs">VIP muaf <input type="checkbox" checked={adv.caps_exclude_vips} onChange={e => setAdv(a => ({ ...a, caps_exclude_vips: e.target.checked }))} /></label>
          {uyariMesaji("caps")}
        </div>
      )}

      {tab === 'links' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Link className="w-5 h-5 text-blue-400" /><h2 className="font-bold">Link Koruması</h2></div>
          <label className="flex justify-between text-xs">İzinsiz linkleri engelle <input type="checkbox" checked={settings.links_enabled !== 0} onChange={e => setSettings({ ...settings, links_enabled: e.target.checked ? 1 : 0 })} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">!permit süresi (sn)<input type="number" value={adv.links_permit_seconds} onChange={e => setAdv(a => ({ ...a, links_permit_seconds: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            {eylemSecimi("links_action")}
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={adv.links_exclude_subs} onChange={e => setAdv(a => ({ ...a, links_exclude_subs: e.target.checked }))} /></label>
          {uyariMesaji("links")}
          <div className="flex gap-2">
            <input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="twitch.tv" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs" />
            <button type="button" onClick={() => { if (newDomain.trim()) setSettings({ ...settings, links_whitelist: [...settings.links_whitelist, newDomain.trim()] }); setNewDomain(''); }} className="px-3 py-2 bg-blue-600 rounded-xl"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">{settings.links_whitelist.map(dom => (
            <span key={dom} className="px-2 py-1 rounded-lg bg-blue-500/15 text-blue-300 text-xs flex items-center gap-1">{dom}<button onClick={() => setSettings({ ...settings, links_whitelist: settings.links_whitelist.filter(d => d !== dom) })}><X className="w-3 h-3" /></button></span>
          ))}</div>
        </div>
      )}

      {tab === 'emotes' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Smile className="w-5 h-5 text-pink-400" /><h2 className="font-bold">Emoji Koruması</h2></div>
          <label className="flex justify-between text-xs">Emoji sınırı <input type="checkbox" checked={settings.emotes_enabled !== 0} onChange={e => setSettings({ ...settings, emotes_enabled: e.target.checked ? 1 : 0 })} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">Max emote<input type="number" value={settings.emotes_max} onChange={e => setSettings({ ...settings, emotes_max: +e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            {eylemSecimi("emotes_action")}
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={adv.emotes_exclude_subs} onChange={e => setAdv(a => ({ ...a, emotes_exclude_subs: e.target.checked }))} /></label>
          {uyariMesaji("emotes")}
        </div>
      )}

      {tab === 'symbols' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Hash className="w-5 h-5 text-amber-400" /><h2 className="font-bold">Sembol Koruması</h2></div>
          <label className="flex justify-between text-xs">Sembol filtresi <input type="checkbox" checked={settings.symbols_enabled !== 0} onChange={e => setSettings({ ...settings, symbols_enabled: e.target.checked ? 1 : 0 })} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">Max sembol % ({settings.symbols_max_percent})<input type="range" min={20} max={100} value={settings.symbols_max_percent} onChange={e => setSettings({ ...settings, symbols_max_percent: +e.target.value })} className="w-full" /></label>
            <label className="text-xs space-y-1">Min uzunluk<input type="number" value={adv.symbols_min_length} onChange={e => setAdv(a => ({ ...a, symbols_min_length: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            {eylemSecimi("symbols_action")}
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={adv.symbols_exclude_subs} onChange={e => setAdv(a => ({ ...a, symbols_exclude_subs: e.target.checked }))} /></label>
          {uyariMesaji("symbols")}
        </div>
      )}

      {tab === 'repeat' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Type className="w-5 h-5 text-sky-400" /><h2 className="font-bold">Tekrarlanan Mesaj Koruması</h2></div>
          <p className="text-[11px] text-gray-500">Aynı izleyici kısa sürede aynı mesajı tekrar yazarsa ihlal sayılır. "Merhaba", "MERHABA!!" ve "merhaba" aynı mesajdır. Moderatör ve yayıncı muaftır.</p>
          <label className="flex justify-between text-xs">Tekrar koruması <input type="checkbox" checked={Number((settings as any).repeat_enabled) === 1} onChange={e => setSettings({ ...settings, repeat_enabled: e.target.checked ? 1 : 0 } as any)} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">Kaçıncı tekrarda ({Number((settings as any).repeat_count) || 3})<input type="range" min={2} max={10} value={Number((settings as any).repeat_count) || 3} onChange={e => setSettings({ ...settings, repeat_count: +e.target.value } as any)} className="w-full" /></label>
            <label className="text-xs space-y-1">Zaman penceresi (sn)<input type="number" min={5} max={3600} value={Number((settings as any).repeat_window) || 30} onChange={e => setSettings({ ...settings, repeat_window: +e.target.value } as any)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            {eylemSecimi("repeat_action")}
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={!!(adv as any).repeat_exclude_subs} onChange={e => setAdv(a => ({ ...a, repeat_exclude_subs: e.target.checked } as any))} /></label>
          {uyariMesaji("repeat")}
        </div>
      )}

      {tab === 'words' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Ban className="w-5 h-5 text-red-400" /><h2 className="font-bold">Yasaklı Kelime Koruması</h2></div>
          <div className="grid grid-cols-2 gap-4">
            {eylemSecimi("blacklist_action")}
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={adv.blacklist_exclude_subs} onChange={e => setAdv(a => ({ ...a, blacklist_exclude_subs: e.target.checked }))} /></label>
          {uyariMesaji("blacklist")}
          <div className="flex gap-2">
            <input value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newWord.trim()) { setSettings({ ...settings, blacklist_words: [...settings.blacklist_words, newWord.trim()] }); setNewWord(''); } }} placeholder="yasaklı kelime" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <button type="button" onClick={() => { if (newWord.trim()) setSettings({ ...settings, blacklist_words: [...settings.blacklist_words, newWord.trim()] }); setNewWord(''); }} className="px-4 py-2 bg-red-600 rounded-xl text-xs font-bold">Ekle</button>
          </div>
          <p className="text-[11px] text-gray-500">Yazım: <code>kelime</code> (Türkçe harf ve büyük/küçük fark etmez) · <code>test*</code> joker (testing, testçi…) · <code>~/desen/i</code> düzenli ifade. İç içe niceleyicili riskli desenler (<code>(a+)+</code>) kayıtta reddedilir. Silinen mesajın kendisi Kalkan ve Denetim günlüğüne yazılır.</p>
          {gecersiz.length > 0 && <p className="text-[11px] rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">Uygulanmayan (geçersiz ya da riskli) kalıplar: {gecersiz.join(', ')}</p>}
          <div className="flex flex-wrap gap-2">{settings.blacklist_words.map(word => (
            <span key={word} className="px-3 py-1.5 rounded-xl bg-red-500/15 text-red-300 text-xs font-bold flex items-center gap-2">{word}<button onClick={() => setSettings({ ...settings, blacklist_words: settings.blacklist_words.filter(w => w !== word) })}><X className="w-3.5 h-3.5" /></button></span>
          ))}</div>
          {ekKural('zalgo', 'Zalgo (bozuk) yazı filtresi', 'Harflerin üstüne/altına yığılmış işaretlerle sohbeti bozan mesajlar.')}
          {ekKural('length', 'Mesaj uzunluğu sınırı', 'Belirlenen karakter sayısından uzun mesajlar.')}
        </div>
      )}

      {tab === 'ceza' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Ban className="w-5 h-5 text-orange-400" /><h2 className="font-bold">Ceza Merdiveni ve Hesap</h2></div>
          <label className="flex justify-between text-xs">Ceza merdiveni <input type="checkbox" checked={!!adv.merdiven_acik} onChange={e => setAdv(a => ({ ...a, merdiven_acik: e.target.checked }))} /></label>
          <p className="text-[11px] text-gray-500">Açıkken kuralların kendi eylemi yerine aynı kişinin ihlal sayısına göre artan ceza uygulanır: 1. uyarı, 2. 1 dk susturma, 3. 10 dk susturma, 4. kalıcı ban. Belirlenen süre boyunca temiz kalan baştan başlar. Tekrarı sürdüren her mesaj bir basamak çıkarır. Sayım bot yeniden başlayınca sıfırlanır.</p>
          <label className="text-xs space-y-1 block">Temiz kalınca sıfırlama (dk)<input type="number" min={1} max={1440} value={adv.merdiven_pencere_dk} onChange={e => setAdv(a => ({ ...a, merdiven_pencere_dk: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs space-y-1 block">Kick'te cezayı uygulayan hesap
            <select value={adv.moderasyon_hesabi} onChange={e => setAdv(a => ({ ...a, moderasyon_hesabi: e.target.value === 'bot' ? 'bot' : 'kanal' }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              <option value="kanal">Yayıncı (kanal girişi)</option>
              <option value="bot">Bot hesabı</option>
            </select>
          </label>
          <p className="text-[11px] text-gray-500">Susturma, ban ve mesaj silme Kick'te bu hesapla yapılır; bot hesabı seçiliyse kanalda moderatör olmalıdır. Bot bağlı değilse yayıncı hesabına düşülür. Twitch tek hesapla bağlandığı için bu seçim orada geçerli değil. Silinen mesajlar metniyle Kalkan ve Denetim günlüğüne yazılır.</p>
        </div>
      )}

      {tab === 'name' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><User className="w-5 h-5 text-cyan-400" /><h2 className="font-bold">Kullanıcı Adı Koruması</h2></div>
          <label className="flex justify-between text-xs">Kullanıcı adı filtresi <input type="checkbox" checked={adv.name_enabled} onChange={e => setAdv(a => ({ ...a, name_enabled: e.target.checked }))} /></label>
          <label className="text-xs space-y-1">Regex<input value={adv.name_regex} onChange={e => setAdv(a => ({ ...a, name_regex: e.target.value }))} placeholder="(scam|xxx)" className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <p className="text-[10px] text-gray-500">İhlalde "Yasaklı Kelimeler" kuralının eylemi uygulanır.</p>
          <label className="text-xs space-y-1">Uyarı<input value={adv.name_warning} onChange={e => setAdv(a => ({ ...a, name_warning: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <div className="flex gap-2">
            <input value={newNameWord} onChange={e => setNewNameWord(e.target.value)} placeholder="yasaklı isim parçası" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs" />
            <button type="button" onClick={() => { if (newNameWord.trim()) setAdv(a => ({ ...a, name_words: [...a.name_words, newNameWord.trim()] })); setNewNameWord(''); }} className="px-3 py-2 bg-cyan-700 rounded-xl"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap gap-2">{adv.name_words.map(w => (
            <span key={w} className="px-2 py-1 bg-cyan-500/15 text-cyan-300 text-xs rounded-lg flex items-center gap-1">{w}<button onClick={() => setAdv(a => ({ ...a, name_words: a.name_words.filter(x => x !== w) }))}><X className="w-3 h-3" /></button></span>
          ))}</div>
        </div>
      )}

    </div>
  );
}

export default AutoMod;
