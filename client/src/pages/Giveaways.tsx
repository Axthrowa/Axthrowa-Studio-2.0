import { useState, useEffect } from 'react';
import { Giveaway } from '../types.js';
import { Gift, Trophy, Plus, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import { WidgetSettingsForm } from './WidgetSettingsForm.js';

export function Giveaways() {
  const [active, setActive] = useState<Giveaway | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [pastGiveaways, setPastGiveaways] = useState<Giveaway[]>([]);
  const [winner, setWinner] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [title, setTitle] = useState('');
  const [keyword, setKeyword] = useState('!katil');
  const [subMultiplier, setSubMultiplier] = useState(2.0);
  const [costPoints, setCostPoints] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [winnerCount, setWinnerCount] = useState(1);
  const [maxEntries, setMaxEntries] = useState(0);
  const [subOnly, setSubOnly] = useState(false);
  const [minWatch, setMinWatch] = useState(0);
  const baseUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port || '5173'}`;

  useEffect(() => {
    loadGiveaways();
    const interval = setInterval(loadGiveaways, 4000);
    return () => clearInterval(interval);
  }, []);

  const loadGiveaways = () => {
    fetch('/api/giveaways')
      .then(r => r.json())
      .then(d => {
        setActive(d.active);
        setEntries(d.entries || []);
        setPastGiveaways(d.pastGiveaways || []);
      })
      .catch(() => {});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/giveaways/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        keyword,
        subBonusMultiplier: subMultiplier,
        costPoints,
        durationMinutes,
        winnerCount,
        maxEntries,
        subOnly,
        minWatchMinutes: minWatch
      })
    });
    // Sunucu ek ayarları yazamazsa artık söylüyor (eskiden sessizdi)
    const veri = await res.json().catch(() => null);
    if (veri?.uyari) alert(veri.uyari);
    setIsCreating(false);
    setTitle('');
    loadGiveaways();
  };

  const handleDraw = async () => {
    const res = await fetch('/api/giveaways/draw', { method: 'POST' });
    const data = await res.json();
    if (data.winner) {
      setWinner(data.winner);
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.5 }
      });
      loadGiveaways();
    } else {
      alert('Çekilişe katılan kimse bulunamadı!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Çekiliş & Hediye Merkezi</h1>
          <p className="text-sm text-gray-400">
            İzleyicilerinizin belirlediğiniz kelimeyle (örn: <code className="text-purple-400">!katil</code>) katılabileceği çekilişler düzenleyin.
          </p>
        </div>

        {!active && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
          >
            <Plus className="w-4 h-4" /> Yeni Çekiliş Başlat
          </button>
        )}
      </div>

      {/* Active Giveaway Section */}
      {active ? (
        <div className="glass-panel p-6 rounded-2xl border border-purple-500/40 glow-purple space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="bg-purple-500/20 text-purple-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-purple-500/40">
                AKTİF ÇEKİLİŞ
              </span>
              <h2 className="text-2xl font-black text-white mt-1">{active.title}</h2>
              <div className="flex items-center space-x-3 text-xs text-gray-400 mt-2">
                <span>Katılım Kelimesi: <b className="text-purple-400">{active.keyword}</b></span>
                <span>•</span>
                <span>Abone Bonusu: <b className="text-pink-400">{active.sub_bonus_multiplier}x Bilet</b></span>
                <span>•</span>
                <span>Toplam Katılımcı: <b className="text-emerald-400">{entries.length} kişi</b></span>
              </div>
            </div>

            <button
              onClick={handleDraw}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-extrabold text-sm flex items-center gap-2 shadow-xl shadow-pink-600/30 transition-all transform hover:scale-105"
            >
              <Trophy className="w-5 h-5 text-yellow-300" /> KAZANANI ÇEK (ÇARKI ÇEVİR)
            </button>
          </div>

          {/* Winner Banner */}
          {winner && (
            <div className="bg-gradient-to-r from-yellow-500/20 via-amber-500/30 to-yellow-500/20 border border-yellow-500/50 p-4 rounded-xl text-center animate-in zoom-in-95">
              <div className="text-yellow-400 font-extrabold text-xs tracking-wider uppercase">🎉 TEBRİKLER! ÇEKİLİŞİ KAZANAN 🎉</div>
              <div className="text-3xl font-black text-white mt-1">@{(winner.winners?.length ? winner.winners : [winner.winner]).join(', @')}</div>
              <div className="text-xs text-gray-300 mt-1">
                {winner.participantsCount} katılımcı ve {winner.totalTickets} bilet arasından seçildi!
              </div>
            </div>
          )}

          {/* Entrants List */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" /> Katılımcı Listesi ({entries.length})
            </h3>

            <div className="max-h-60 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pr-1">
              {entries.map(e => (
                <div key={e.id} className="bg-black/40 border border-white/5 p-2.5 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-white truncate">@{e.username}</span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold">
                    {e.tickets} bilet
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-8 rounded-2xl text-center space-y-4">
          <Gift className="w-12 h-12 text-gray-600 mx-auto" />
          <div>
            <h3 className="text-lg font-bold text-white">Şu Anda Aktif Çekiliş Yok</h3>
            <p className="text-xs text-gray-400 mt-1">
              Yayın sırasında anında çekiliş başlatmak için yukarıdaki "Yeni Çekiliş Başlat" butonuna tıklayın.
            </p>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/20 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-400" />
              Yeni Çekiliş Başlat
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Çekiliş Başlığı / Ödül
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Örn: 100 TL Steam Cüzdan Kodu"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Katılım Kelimesi
                  </label>
                  <input
                    type="text"
                    required
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    placeholder="!katil"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Abone Bilet Çarpanı
                  </label>
                  <select
                    value={subMultiplier}
                    onChange={e => setSubMultiplier(parseFloat(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="1.0">1x (Eşit Şans)</option>
                    <option value="2.0">2x Bilet (Önerilen)</option>
                    <option value="3.0">3x Bilet</option>
                    <option value="5.0">5x Bilet</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold">Puan maliyeti<input type="number" value={costPoints} onChange={e => setCostPoints(+e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 mt-1" /></label>
                <label className="text-xs font-bold">Katılım süresi (dk, 0 = süresiz)<input type="number" min={0} value={durationMinutes} onChange={e => setDurationMinutes(+e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 mt-1" /></label>
                <label className="text-xs font-bold">Kazanan sayısı<input type="number" value={winnerCount} onChange={e => setWinnerCount(+e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 mt-1" /></label>
                <label className="text-xs font-bold">Max katılım (0=∞)<input type="number" value={maxEntries} onChange={e => setMaxEntries(+e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 mt-1" /></label>
                <label className="text-xs font-bold">Min izleme (dk)<input type="number" value={minWatch} onChange={e => setMinWatch(+e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 mt-1" /></label>
                <label className="text-xs font-bold flex items-center gap-2"><input type="checkbox" checked={subOnly} onChange={e => setSubOnly(e.target.checked)} /> Sadece abone</label>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30"
                >
                  Çekilişi Başlat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Geçmiş çekilişler — sunucu son 10'u döndürüyordu ama sayfa hiç göstermiyordu */}
      {pastGiveaways.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" /> Geçmiş Çekilişler
          </h2>
          <div className="divide-y divide-white/5">
            {pastGiveaways.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{g.title}</div>
                  <div className="text-[11px] text-gray-500">
                    {new Date(g.created_at).toLocaleString('tr-TR')} · {g.keyword}
                  </div>
                </div>
                <div className="shrink-0 text-xs font-bold">
                  {g.winner ? (
                    <span className="text-yellow-300">🏆 @{g.winner}</span>
                  ) : (
                    <span className="text-gray-500">kazanan yok</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <WidgetSettingsForm widgetId="giveaways" baseUrl={baseUrl} />
    </div>
  );
}

export default Giveaways;
