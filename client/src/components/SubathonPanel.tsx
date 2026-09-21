/**
 * StreamAxT — Subathon kontrol paneli
 * Developed by AxthrowA
 *
 * Kullanıcı istedi: "abone, hediye, bağış geldiğinde ne kadar süre artacağını
 * ben ayarlayabileyim; hediyeyi Kick ile değiştir; gelen abonelik, bağış,
 * KICKs otomatik olarak süreye eklensin."
 *
 * Önceden bu ayarlar yalnız genel widget ayar formunda `subMinutes`,
 * `tipPerAmount` gibi İngilizce anahtar adlarıyla görünüyordu ve sayaç
 * tarayıcıda olduğu için gerçekten uygulanmıyordu. Artık sunucudaki
 * `/api/subathon` motoruna bağlı.
 */
import { useEffect, useState } from 'react';
import { Play, Square, Plus, Minus, Save, RefreshCw } from 'lucide-react';

interface Ayar {
  aktif: boolean;
  baslangicDakika: number;
  aboneDakika: number;
  hediyeAboneDakika: number;
  bagisDakika: number;
  bagisBirimi: number;
  kicksDakika: number;
  kicksBirimi: number;
  maksSaat: number;
}

interface Durum {
  aktif: boolean;
  kalanSaniye: number;
  eklenenSaniye: number;
  sonEkleme: { metin: string; zaman: number } | null;
  ayar: Ayar;
}

const sureYaz = (sn: number) => {
  const t = Math.max(0, Math.floor(sn));
  return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** Tek bir "şu olay → şu kadar dakika" kuralı. */
function Kural({
  baslik,
  aciklama,
  renk,
  dakika,
  birim,
  birimEtiketi,
  onDakika,
  onBirim
}: {
  baslik: string;
  aciklama: string;
  renk: string;
  dakika: number;
  birim?: number;
  birimEtiketi?: string;
  onDakika: (v: number) => void;
  onBirim?: (v: number) => void;
}) {
  return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: renk }} />
        <span className="text-xs font-black text-white">{baslik}</span>
      </div>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="block text-[10px] text-gray-400 font-bold mb-1">Eklenecek dakika</span>
          <input
            type="number"
            min={0}
            value={dakika}
            onChange={(e) => onDakika(Math.max(0, Number(e.target.value) || 0))}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-mono"
          />
        </label>
        {onBirim && (
          <>
            <span className="text-gray-500 text-xs pb-2">her</span>
            <label className="flex-1">
              <span className="block text-[10px] text-gray-400 font-bold mb-1">{birimEtiketi}</span>
              <input
                type="number"
                min={1}
                value={birim}
                onChange={(e) => onBirim(Math.max(1, Number(e.target.value) || 1))}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-mono"
              />
            </label>
          </>
        )}
      </div>
      <p className="text-[10px] text-gray-500 mt-1.5">{aciklama}</p>
    </div>
  );
}

export function SubathonPanel() {
  const [durum, setDurum] = useState<Durum | null>(null);
  const [ayar, setAyar] = useState<Ayar | null>(null);
  const [kaydedildi, setKaydedildi] = useState(false);
  const [hata, setHata] = useState('');
  const [elleDakika, setElleDakika] = useState(5);

  const yukle = async () => {
    try {
      const d = await fetch('/api/subathon').then((r) => r.json());
      setDurum(d);
      setAyar(d.ayar);
      setHata('');
    } catch {
      setHata('Sunucuya ulaşılamadı.');
    }
  };

  useEffect(() => {
    yukle();
    const t = setInterval(yukle, 5000);
    return () => clearInterval(t);
  }, []);

  const kaydet = async () => {
    if (!ayar) return;
    try {
      const y = await fetch('/api/subathon/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ayar)
      }).then((r) => r.json());
      setAyar(y);
      setKaydedildi(true);
      setTimeout(() => setKaydedildi(false), 2000);
    } catch {
      setHata('Kaydedilemedi.');
    }
  };

  const cagir = async (yol: string, govde?: any) => {
    try {
      const d = await fetch(`/api/subathon/${yol}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(govde || {})
      }).then((r) => r.json());
      setDurum(d);
      if (d?.ayar) setAyar(d.ayar);
    } catch {
      setHata('İşlem başarısız.');
    }
  };

  if (!ayar || !durum) {
    return <div className="text-xs text-gray-400 p-3">Subathon durumu yükleniyor…</div>;
  }

  const d = (k: keyof Ayar) => (v: number) => setAyar({ ...ayar, [k]: v });

  return (
    <div className="space-y-3">
      {/* Canlı durum */}
      <div className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div>
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Kalan süre</div>
          <div className="text-3xl font-black font-mono text-white">{sureYaz(durum.kalanSaniye)}</div>
        </div>
        <div className="flex-1 min-w-[120px]">
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Durum</div>
          <div className={`text-sm font-black ${durum.aktif ? 'text-emerald-400' : 'text-gray-500'}`}>
            {durum.aktif ? '● Çalışıyor' : '○ Durduruldu'}
          </div>
          {durum.eklenenSaniye > 0 && (
            <div className="text-[10px] text-gray-500 mt-0.5">Bu yayında eklenen: {sureYaz(durum.eklenenSaniye)}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {durum.aktif ? (
            <button
              onClick={() => cagir('stop')}
              className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" /> Durdur
            </button>
          ) : (
            <button
              onClick={() => cagir('start', { dakika: ayar.baslangicDakika })}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> Başlat ({ayar.baslangicDakika} dk)
            </button>
          )}
          <button
            onClick={yukle}
            title="Yenile"
            className="px-2.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {durum.sonEkleme && (
        <div className="text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 rounded-lg px-3 py-2">
          Son ekleme: {durum.sonEkleme.metin}
        </div>
      )}

      {/* Elle süre */}
      <div className="bg-black/30 border border-white/10 rounded-xl p-3 flex items-end gap-2">
        <label className="flex-1">
          <span className="block text-[10px] text-gray-400 font-bold mb-1">Elle süre ekle / çıkar (dakika)</span>
          <input
            type="number"
            value={elleDakika}
            onChange={(e) => setElleDakika(Number(e.target.value) || 0)}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-mono"
          />
        </label>
        <button
          onClick={() => cagir('add', { dakika: Math.abs(elleDakika) })}
          disabled={!durum.aktif}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Ekle
        </button>
        <button
          onClick={() => cagir('add', { dakika: -Math.abs(elleDakika) })}
          disabled={!durum.aktif}
          className="px-3 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1"
        >
          <Minus className="w-3.5 h-3.5" /> Çıkar
        </button>
      </div>

      {/* Otomatik süre kuralları */}
      <div>
        <h4 className="text-xs font-black text-white mb-2">
          Otomatik süre kuralları
          <span className="ml-2 text-[10px] font-normal text-emerald-400">
            olaylar geldikçe süre kendiliğinden uzar
          </span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Kural
            baslik="Abonelik"
            renk="#22d3ee"
            dakika={ayar.aboneDakika}
            onDakika={d('aboneDakika')}
            aciklama="Yeni abone geldiğinde eklenecek süre."
          />
          <Kural
            baslik="Hediye abonelik"
            renk="#fbbf24"
            dakika={ayar.hediyeAboneDakika}
            onDakika={d('hediyeAboneDakika')}
            aciklama="Hediye edilen HER abonelik için ayrı ayrı eklenir."
          />
          <Kural
            baslik="KICKs"
            renk="#53fc18"
            dakika={ayar.kicksDakika}
            birim={ayar.kicksBirimi}
            birimEtiketi="KICKs"
            onDakika={d('kicksDakika')}
            onBirim={d('kicksBirimi')}
            aciklama="Kick'in kendi para birimi. Örn. 100 KICKs başına 1 dakika."
          />
          <Kural
            baslik="Bağış"
            renk="#34d399"
            dakika={ayar.bagisDakika}
            birim={ayar.bagisBirimi}
            birimEtiketi="tutar"
            onDakika={d('bagisDakika')}
            onBirim={d('bagisBirimi')}
            aciklama="Harici bağış (BynoGame, SuperChat vb.). Örn. 50₺ başına 10 dakika."
          />
        </div>
      </div>

      {/* Genel */}
      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="block text-[10px] text-gray-400 font-bold mb-1">Başlangıç süresi (dakika)</span>
          <input
            type="number"
            min={1}
            value={ayar.baslangicDakika}
            onChange={(e) => setAyar({ ...ayar, baslangicDakika: Math.max(1, Number(e.target.value) || 1) })}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-mono"
          />
        </label>
        <label>
          <span className="block text-[10px] text-gray-400 font-bold mb-1">Üst sınır (saat, 0 = sınırsız)</span>
          <input
            type="number"
            min={0}
            value={ayar.maksSaat}
            onChange={(e) => setAyar({ ...ayar, maksSaat: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white font-mono"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={kaydet}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            kaydedildi ? 'bg-emerald-600 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          <Save className="w-3.5 h-3.5" /> {kaydedildi ? 'Kaydedildi' : 'Kuralları Kaydet'}
        </button>
        {hata && <span className="text-[11px] text-red-400">{hata}</span>}
      </div>
    </div>
  );
}

export default SubathonPanel;
