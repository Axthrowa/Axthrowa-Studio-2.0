import { useState, useEffect } from 'react';
import { Giveaway } from '../types.js';
import { Gift, Trophy, Plus, Users, RotateCw, Settings2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { WidgetSettingsForm } from './WidgetSettingsForm.js';
import { WidgetOnizleme } from '../components/WidgetOnizleme.js';
import { Anahtar, Katlanir, Panel, Secim } from '../ui/index.js';

export function Giveaways() {
  const [active, setActive] = useState<Giveaway | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [pastGiveaways, setPastGiveaways] = useState<Giveaway[]>([]);
  const [winner, setWinner] = useState<any | null>(null);
  const [uyari, setUyari] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  // Pencere açık çekilişi düzenliyor mu
  const [duzenleniyor, setDuzenleniyor] = useState(false);

  const [title, setTitle] = useState('');
  const [keyword, setKeyword] = useState('!katil');
  const [subMultiplier, setSubMultiplier] = useState(1);
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

  const yeniPencere = async () => {
    // Katılım kelimesi Çekiliş ayarlarından gelir
    const ayar = await fetch('/api/widgets/giveaways/settings').then((r) => r.json()).catch(() => null);
    if (ayar?.keyword) setKeyword(ayar.keyword);
    setDuzenleniyor(false);
    setTitle('');
    setIsCreating(true);
  };

  const duzenlemeyiAc = () => {
    if (!active) return;
    const a = active as any;
    setTitle(a.title);
    setKeyword(a.keyword);
    setSubMultiplier(Number(a.sub_bonus_multiplier) || 1);
    setCostPoints(Number(a.cost_points) || 0);
    setDurationMinutes(Number(a.duration_minutes) || 0);
    setWinnerCount(Number(a.winner_count) || 1);
    setMaxEntries(Number(a.max_entries) || 0);
    setSubOnly(!!a.sub_only);
    setMinWatch(Number(a.min_watch_minutes) || 0);
    setDuzenleniyor(true);
    setIsCreating(true);
  };

  const yenidenCek = async () => {
    const res = await fetch('/api/giveaways/reroll', { method: 'POST' });
    const data = await res.json();
    if (data.winner) setWinner(data.winner);
    else setUyari(data.error || 'Yeniden çekilemedi.');
    loadGiveaways();
  };

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
    const res = await fetch(duzenleniyor ? '/api/giveaways/update' : '/api/giveaways/create', {
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
    if (veri?.uyari) setUyari(veri.uyari);
    setIsCreating(false);
    setTitle('');
    loadGiveaways();
  };

  const handleDraw = async () => {
    setUyari('');
    // Gömülü panelde alert() sessizce yutulur: katılımcı yokken düğme hiçbir şey yapmıyor gibi görünüyordu
    const data = await fetch('/api/giveaways/draw', { method: 'POST' }).then((r) => r.json()).catch(() => null);
    if (!data) {
      setUyari('Sunucuya ulaşılamadı, kazanan çekilmedi.');
    } else if (data.winner) {
      setWinner(data.winner);
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.5 }
      });
      loadGiveaways();
    } else {
      setUyari('Henüz katılan yok, kazanan çekilemez. Sohbette katılım kelimesini yazan olunca tekrar dene.');
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
            onClick={() => void yeniPencere()}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
          >
            <Plus className="w-4 h-4" /> Yeni Çekiliş Başlat
          </button>
        )}
      </div>

      {/* Kazanan: çekiliş kapandıktan sonra da görünür (eskiden yalnız açık çekilişin içindeydi, hiç görünmüyordu) */}
      {winner && (
        <div className="border border-yellow-500/40 bg-yellow-500/10 p-4 rounded-xl text-center space-y-2">
          <div className="text-yellow-400 font-extrabold text-xs axt-etiket">Kazanan</div>
          <div className="text-3xl font-black text-white">@{(winner.winners?.length ? winner.winners : [winner.winner]).join(', @')}</div>
          <div className="text-xs text-gray-300">
            {winner.participantsCount} katılımcı ve {winner.totalTickets} bilet arasından rastgele seçildi.
          </div>
          <button onClick={() => void yenidenCek()} className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-white inline-flex items-center gap-1.5">
            <RotateCw className="w-3.5 h-3.5" /> Kazanan gelmedi, yeniden çek
          </button>
        </div>
      )}

      {/* Active Giveaway Section */}
      {active ? (
        <Panel className="p-6 rounded-2xl border border-purple-500/40 glow-purple space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="bg-purple-500/20 text-purple-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-purple-500/40">
                AKTİF ÇEKİLİŞ
              </span>
              <h2 className="text-2xl font-black text-white mt-1">{active.title}</h2>
              <div className="flex flex-wrap gap-1.5 text-xs text-gray-400 mt-2">
                <span className="px-2 py-1 rounded-lg bg-white/5">Katılım: <b className="text-purple-400">{active.keyword}</b></span>
                <span className="px-2 py-1 rounded-lg bg-white/5">Katılımcı: <b className="text-emerald-400">{entries.length}</b></span>
                <span className="px-2 py-1 rounded-lg bg-white/5">Süre: <b className="text-white">{(active as any).duration_minutes ? `${(active as any).duration_minutes} dk` : 'süresiz'}</b></span>
                <span className="px-2 py-1 rounded-lg bg-white/5">Kazanan: <b className="text-white">{(active as any).winner_count || 1}</b></span>
                <span className="px-2 py-1 rounded-lg bg-white/5">Abone: <b className="text-pink-400">{active.sub_bonus_multiplier}x bilet</b></span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button onClick={duzenlemeyiAc} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs flex items-center gap-1.5">
              <Settings2 className="w-4 h-4" /> Ayarları düzenle
            </button>
            <button
              onClick={handleDraw}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-extrabold text-sm flex items-center gap-2 shadow-xl shadow-pink-600/30 transition-all transform hover:scale-105"
            >
              <Trophy className="w-5 h-5 text-yellow-300" /> KAZANANI ÇEK
            </button>
            </div>
          </div>

          {uyari && <div role="alert" className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-bold">{uyari}</div>}

          {/* Entrants List */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-gray-400 axt-etiket flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-400" /> Katılımcı Listesi ({entries.length})
            </h3>

            <div className="max-h-60 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pr-1">
              {entries.map(e => (
                <div key={e.id} className="bg-black/40 border border-white/5 p-2.5 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-bold text-white truncate">@{e.username}</span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-xs font-bold">
                    {e.tickets} bilet · %{Math.round((e.tickets / Math.max(1, entries.reduce((t, x) => t + Math.max(1, Number(x.tickets) || 1), 0))) * 1000) / 10}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : (
        <Panel className="p-8 rounded-2xl text-center space-y-4">
          <Gift className="w-12 h-12 text-gray-600 mx-auto" />
          <div>
            <h3 className="text-lg font-bold text-white">Şu Anda Aktif Çekiliş Yok</h3>
            <p className="text-xs text-gray-400 mt-1">
              Yayın sırasında anında çekiliş başlatmak için yukarıdaki "Yeni Çekiliş Başlat" butonuna tıklayın.
            </p>
          </div>
        </Panel>
      )}

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Panel className="w-full max-w-md max-h-[90vh] overflow-y-auto p-6 rounded-2xl border border-white/20 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-400" />
              {duzenleniyor ? 'Çekilişi düzenle' : 'Yeni Çekiliş Başlat'}
            </h2>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Çekiliş Başlığı / Ödül
                </label>
                <input aria-label="Çekiliş Başlığı / Ödül"
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
                  <input aria-label="Katılım Kelimesi"
                    type="text"
                    required
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    placeholder="!katil"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <label className="block text-xs font-bold text-gray-300 space-y-1">Katılım süresi (dk, 0 = süresiz)<input type="number" min={0} value={durationMinutes} onChange={e => setDurationMinutes(+e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 mt-1" /></label>
                <label className="block text-xs font-bold text-gray-300 space-y-1">Kazanan sayısı<input type="number" value={winnerCount} onChange={e => setWinnerCount(+e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 mt-1" /></label>
              </div>

              <Katlanir baslik="Katılım şartları" aciklama="İsteğe bağlı" acik={subOnly || minWatch > 0 || maxEntries > 0 || costPoints > 0 || subMultiplier !== 1}>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-300"><Anahtar acik={subOnly} onChange={(v) => setSubOnly(v)} /> Yalnız aboneler katılabilsin</label>
                <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Abone Bilet Çarpanı
                  </label>
                  <Secim aria-label="Abone Bilet Çarpanı"
                    value={subMultiplier}
                    onChange={e => setSubMultiplier(parseFloat(e.target.value))}
 className="w-full"
                  >
                    <option value="1">Eşit şans (önerilen)</option>
                    <option value="2">2x Bilet</option>
                    <option value="3">3x Bilet</option>
                    <option value="5">5x Bilet</option>
                  </Secim>
                </div>
                  <label className="block text-xs font-bold text-gray-300 space-y-1">Katılım bedeli (puan, 0 = ücretsiz)<input type="number" disabled={duzenleniyor} title={duzenleniyor ? 'Katılanlar eski bedeli ödedi; açık çekilişte değişmez' : undefined} value={costPoints} onChange={e => setCostPoints(+e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 mt-1 disabled:opacity-50" /></label>
                  <label className="block text-xs font-bold text-gray-300 space-y-1">En fazla katılımcı (0 = sınırsız)<input type="number" value={maxEntries} onChange={e => setMaxEntries(+e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 mt-1" /></label>
                  <label className="block text-xs font-bold text-gray-300 space-y-1">En az izleme süresi (dk)<input type="number" value={minWatch} onChange={e => setMinWatch(+e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 mt-1" /></label>
                </div>
              </Katlanir>

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
                  {duzenleniyor ? 'Kaydet' : 'Çekilişi Başlat'}
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-bold text-white">OBS'teki görünüm</h2>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
          <WidgetSettingsForm widgetId="giveaways" baseUrl={baseUrl} />
          <div className="lg:sticky lg:top-0">
            <WidgetOnizleme url={`${baseUrl}/widgets/giveaways`} testAdi="giveaways" boyut={{ w: 600, h: 300 }} />
          </div>
        </div>
      </div>

      {/* Geçmiş çekilişler — sunucu son 10'u döndürüyordu ama sayfa hiç göstermiyordu */}
      {pastGiveaways.length > 0 && (
        <Katlanir baslik="Geçmiş çekilişler" sayi={pastGiveaways.length}>
          <div className="divide-y divide-white/5">
            {pastGiveaways.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{g.title}</div>
                  <div className="text-xs text-gray-500">
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
        </Katlanir>
      )}
    </div>
  );
}

export default Giveaways;
