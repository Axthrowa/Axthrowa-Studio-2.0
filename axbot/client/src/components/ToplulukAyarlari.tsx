/**
 * AxBoT — Topluluk: düzenli izleyiciler, votekick, emote piramidi,
 * emote bingo, kappagen ve 7TV ayarları
 * Developed by AxthrowA
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { Anahtar, Panel } from '../ui/index.js';

interface Duzenli {
  platform: string;
  username: string;
  added_by: string;
  created_at: number;
}

const VARSAYILAN = {
  votekick_enabled: 'false',
  votekick_threshold: '5',
  votekick_window: '60',
  votekick_timeout: '300',
  pyramid_enabled: 'false',
  pyramid_min: '3',
  pyramid_message: '🔺 @{user} {height} katlı bir emote piramidi kurdu!',
  kappagen_chat_enabled: 'true',
  kappagen_cost: '0',
  seventv_enabled: 'true'
};
type Anahtar = keyof typeof VARSAYILAN;

const KANAL_DURUM: Record<string, string> = {
  ok: 'kanal seti yüklendi',
  'hesap-yok': 'bu Kick kanalının 7TV hesabı yok (yalnız genel set)',
  'kanal-yok': 'Kick kanalı bağlı değil (yalnız genel set)',
  hata: '7TV\'ye ulaşılamadı',
  kapali: 'kapalı'
};

const girdi = 'w-full bg-black/40 border border-white/10 rounded-xl p-2 text-sm';

export function ToplulukAyarlari() {
  const [a, setA] = useState<Record<Anahtar, string>>(VARSAYILAN);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [duzenliler, setDuzenliler] = useState<Duzenli[]>([]);
  const [yeniAd, setYeniAd] = useState('');
  const [hata, setHata] = useState('');
  const [yedi, setYedi] = useState<{ kanal: number; genel: number; durum: string } | null>(null);

  const duzenliYukle = useCallback(() => {
    fetch('/api/regulars')
      .then((r) => r.json())
      .then((d) => setDuzenliler(Array.isArray(d.regulars) ? d.regulars : []))
      .catch(() => {});
  }, []);

  const yediYukle = useCallback((yenile = false) => {
    fetch(`/api/emotes${yenile ? '?yenile=1' : ''}`)
      .then((r) => r.json())
      .then((d) => setYedi({ kanal: d.yediTv?.kanal?.length || 0, genel: d.yediTv?.genel?.length || 0, durum: d.yediTv?.kanalDurum || '' }))
      .catch(() => setYedi(null));
  }, []);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        const y = { ...VARSAYILAN };
        for (const k of Object.keys(VARSAYILAN) as Anahtar[]) if (typeof d?.[k] === 'string') y[k] = d[k];
        setA(y);
      })
      .catch(() => {});
    duzenliYukle();
    yediYukle();
  }, [duzenliYukle, yediYukle]);

  const kaydet = async () => {
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(a) });
    setKaydedildi(true);
    setTimeout(() => setKaydedildi(false), 2000);
    yediYukle();
  };

  const ekle = async () => {
    setHata('');
    const r = await fetch('/api/regulars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'kick', username: yeniAd })
    }).catch(() => null);
    if (!r?.ok) {
      setHata('Geçersiz kullanıcı adı');
      return;
    }
    setYeniAd('');
    duzenliYukle();
  };

  const sil = async (d: Duzenli) => {
    await fetch(`/api/regulars/${encodeURIComponent(d.platform)}/${encodeURIComponent(d.username)}`, { method: 'DELETE' }).catch(() => {});
    duzenliYukle();
  };

  const acik = (k: Anahtar) => a[k] === 'true';
  const anahtar = (k: Anahtar, etiket: string) => (
    <label className="flex justify-between items-center text-xs font-bold">
      {etiket}
      <Anahtar acik={acik(k)} onChange={(v) => setA({ ...a, [k]: v ? 'true' : 'false' })} />
    </label>
  );
  const sayi = (k: Anahtar, etiket: string, min: number, max: number) => (
    <label className="text-xs font-bold space-y-1">
      {etiket}
      <input type="number" min={min} max={max} value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} className={girdi} />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={kaydet} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 ${kaydedildi ? 'bg-emerald-600' : 'bg-purple-600'} text-white`}>
          {kaydedildi && <Check className="w-4 h-4" />} Topluluk ayarlarını kaydet
        </button>
      </div>

      <Panel as="section" className="p-5 rounded-2xl space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" /> Düzenli izleyiciler ({duzenliler.length})
        </h3>
        <p className="text-xs text-gray-400">
          Komut yetkisinde <b>Düzenli izleyiciler</b> seçilen komutları ve AutoMod'da "Düzenli" muafiyetini kullanır. Sohbetten: <code>!regulars add @kişi</code>, <code>!regulars remove @kişi</code>, <code>!regulars list</code> (mod).
        </p>
        <div className="flex gap-2">
          <input value={yeniAd} onChange={(e) => setYeniAd(e.target.value)} placeholder="kick kullanıcı adı" className={girdi} />
          <button onClick={() => void ekle()} className="px-3 py-2 bg-purple-600 rounded-xl text-xs font-bold flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Ekle
          </button>
        </div>
        {hata && <p className="text-xs text-red-300">{hata}</p>}
        <div className="flex flex-wrap gap-2">
          {duzenliler.map((d) => (
            <span key={`${d.platform}:${d.username}`} className="text-xs bg-black/40 border border-white/10 rounded-lg px-2 py-1 flex items-center gap-1">
              {d.username} <span className="text-gray-500">({d.platform})</span>
              <button onClick={() => void sil(d)} title="Çıkar" className="text-red-300 hover:text-red-200">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </Panel>

      <Panel as="section" className="p-5 rounded-2xl space-y-3">
        <h3 className="text-sm font-bold text-white">Oylu susturma — !votekick</h3>
        <p className="text-xs text-gray-400">
          İzleyici <code>!votekick @kişi</code> ile oylama açar, diğerleri <code>!votekick</code> yazarak katılır. Eşik dolunca kişi susturulur.
          Mod/yayıncı/bot hedef alınamaz; hedef son 3 dakikada yazmış olmalı. Modlar <code>!votekick iptal</code> ile kapatır.
        </p>
        {anahtar('votekick_enabled', 'Açık (gerçek zaman aşımı uygular)')}
        <div className="grid grid-cols-3 gap-3">
          {sayi('votekick_threshold', 'Gereken oy', 1, 100)}
          {sayi('votekick_window', 'Oylama süresi (sn)', 10, 600)}
          {sayi('votekick_timeout', 'Susturma (sn)', 10, 86400)}
        </div>
      </Panel>

      <Panel as="section" className="p-5 rounded-2xl space-y-3">
        <h3 className="text-sm font-bold text-white">Emote piramidi</h3>
        <p className="text-xs text-gray-400">Aynı kişi <code>E</code>, <code>E E</code>, <code>E E E</code>, <code>E E</code>, <code>E</code> yazınca bot tebrik eder.</p>
        {anahtar('pyramid_enabled', 'Açık')}
        <div className="grid grid-cols-3 gap-3">
          {sayi('pyramid_min', 'En az kat', 3, 20)}
          <label className="text-xs font-bold space-y-1 col-span-2">
            Mesaj (<code>{'{user}'}</code>, <code>{'{height}'}</code>)
            <input value={a.pyramid_message} onChange={(e) => setA({ ...a, pyramid_message: e.target.value })} className={girdi} />
          </label>
        </div>
      </Panel>

      <Panel as="section" className="p-5 rounded-2xl space-y-3">
        <h3 className="text-sm font-bold text-white">Emote bingo</h3>
        <p className="text-xs text-gray-400">
          Mod: <code>!bingo start KEKW PogU LUL 500</code> (son sayı ödül puanı; emote vermezsen 7TV'den 8 tane seçilir). Gizli emote'u ilk yazan kazanır.
          <code> !bingo stop</code> bitirir ve gizli emote'u açıklar.
        </p>
      </Panel>

      <Panel as="section" className="p-5 rounded-2xl space-y-3">
        <h3 className="text-sm font-bold text-white">Kappagen ve 7TV</h3>
        <p className="text-xs text-gray-400">
          Overlay: Overlay Stüdyo → <b>Ekranda Emojiler (Kappagen)</b>. <code>!kappagen [emote]</code> ortadan patlatır.
        </p>
        {anahtar('kappagen_chat_enabled', "Sohbetteki emote'lar overlay'de uçsun")}
        {sayi('kappagen_cost', '!kappagen izleyici ücreti (puan; 0 = yalnız mod)', 0, 1000000)}
        {anahtar('seventv_enabled', '7TV emote\'ları (sohbet katmanı, kappagen, bingo)')}
        <div className="flex items-center justify-between text-xs text-gray-300 rounded-lg border border-white/10 bg-black/30 p-2">
          <span>
            7TV: {yedi ? `${yedi.genel} genel · ${yedi.kanal} kanal — ${KANAL_DURUM[yedi.durum] || yedi.durum}` : 'okunamadı'}
          </span>
          <button onClick={() => yediYukle(true)} className="flex items-center gap-1 text-gray-300 hover:text-white">
            <RefreshCw className="w-3.5 h-3.5" /> Yenile
          </button>
        </div>
      </Panel>
    </div>
  );
}

export default ToplulukAyarlari;
