import { useState, useEffect } from 'react';
import {
  Gamepad2,
  Trophy,
  Coins,
  Check,
  Sparkles,
  Play,
  HelpCircle,
  Flame,
  ShieldAlert,
  Zap,
  Dice5,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GameSettings {
  soygun: { enabled: boolean; minBet: number; maxBet: number; cooldownSec: number; winMultiplier: number };
  yaris: { enabled: boolean; minBet: number; maxBet: number; cooldownSec: number; winMultiplier: number };
  trivia: { enabled: boolean; cooldownSec: number; rewardPoints: number; timeoutSec: number };
  kelime: { enabled: boolean; cooldownSec: number; rewardPoints: number; timeoutSec: number };
  balik: { enabled: boolean; cooldownSec: number; minPoints: number; maxPoints: number };
  kasa: { enabled: boolean; cost: number; cooldownSec: number };
  bomba: { enabled: boolean; minBet: number; maxBet: number; cooldownSec: number };
  zar: { enabled: boolean; minBet: number; maxBet: number; cooldownSec: number };
  yazi_tura: { enabled: boolean; minBet: number; maxBet: number; cooldownSec: number };
  duello: { enabled: boolean; minBet: number; maxBet: number; cooldownSec: number };
}

const DEFAULT_GAME_SETTINGS: GameSettings = {
  soygun: { enabled: true, minBet: 10, maxBet: 500, cooldownSec: 45, winMultiplier: 2.2 },
  yaris: { enabled: true, minBet: 10, maxBet: 500, cooldownSec: 45, winMultiplier: 2.5 },
  trivia: { enabled: true, cooldownSec: 60, rewardPoints: 100, timeoutSec: 30 },
  kelime: { enabled: true, cooldownSec: 60, rewardPoints: 75, timeoutSec: 35 },
  balik: { enabled: true, cooldownSec: 30, minPoints: 10, maxPoints: 200 },
  kasa: { enabled: true, cost: 100, cooldownSec: 20 },
  bomba: { enabled: true, minBet: 10, maxBet: 300, cooldownSec: 30 },
  zar: { enabled: true, minBet: 5, maxBet: 250, cooldownSec: 15 },
  yazi_tura: { enabled: true, minBet: 5, maxBet: 250, cooldownSec: 15 },
  duello: { enabled: true, minBet: 20, maxBet: 1000, cooldownSec: 60 }
};

export function MiniGames() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeLobbies, setActiveLobbies] = useState<any[]>([]);
  const [selectedGameTab, setSelectedGameTab] = useState<string>('all');

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/games/settings');
      const data = await res.json();
      if (data && typeof data === 'object') {
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch {}
    setLoading(false);
  };

  const fetchLobbies = async () => {
    try {
      const res = await fetch('/api/games/active-lobbies');
      const data = await res.json();
      if (Array.isArray(data)) {
        setActiveLobbies(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchSettings();
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/games/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      setStatusMessage('✅ Tüm chat oyun ayarları başarıyla kaydedildi!');
      setTimeout(() => setStatusMessage(null), 3500);
    } catch {
      setStatusMessage('❌ Ayarlar kaydedilirken hata oluştu');
      setTimeout(() => setStatusMessage(null), 3500);
    }
    setSaving(false);
  };

  const handleTriggerGame = async (game: string) => {
    try {
      const res = await fetch('/api/games/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game })
      });
      const data = await res.json();
      setStatusMessage(`🚀 ${data.message || 'Oyun tetiklendi!'}`);
      setTimeout(() => setStatusMessage(null), 3000);
      fetchLobbies();
    } catch {
      setStatusMessage('❌ Oyun tetiklenirken hata oluştu');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleCancelLobby = async (game: string) => {
    try {
      const res = await fetch('/api/games/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game })
      });
      const data = await res.json();
      setStatusMessage(`🛑 ${data.message || 'Lobi iptal edildi'}`);
      setTimeout(() => setStatusMessage(null), 3000);
      fetchLobbies();
    } catch {}
  };

  const updateGameField = (gameKey: keyof GameSettings, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [gameKey]: {
        ...prev[gameKey],
        [field]: value
      }
    }));
  };

  const gameDefinitions = [
    {
      id: 'soygun',
      title: 'Banka Soygunu',
      command: '!soygun <miktar>',
      desc: 'İzleyiciler ortak soygun havuzuna puan yatırır. Süre bitince polis baskınından kaçabilenler çarpanla ödüllendirilir.',
      icon: Flame,
      color: 'from-amber-600 to-red-600',
      borderColor: 'border-amber-500/30'
    },
    {
      id: 'yaris',
      title: 'Büyük Yarış',
      command: '!yaris <miktar>',
      desc: 'İzleyiciler araçlarıyla yarış lobisine katılır. Rastgele virajlar ve olaylar sonrası kazanan büyük ödülü alır.',
      icon: Zap,
      color: 'from-blue-600 to-indigo-600',
      borderColor: 'border-blue-500/30'
    },
    {
      id: 'trivia',
      title: 'Bilgi Yarışması (Trivia)',
      command: '!trivia & !cevap <1-4>',
      desc: 'Chatte 4 şıklı genel kültür veya yayıncı soruları sorulur. Doğru şıkkı ilk yazan puanı kapar.',
      icon: HelpCircle,
      color: 'from-purple-600 to-pink-600',
      borderColor: 'border-purple-500/30'
    },
    {
      id: 'kelime',
      title: 'Kelime Bulmaca (Anagram)',
      command: '!kelime <tahmin>',
      desc: 'Harfleri karıştırılmış bir Türkçe kelime sorulur. Anagramı doğru çözen ilk izleyici ödüllendirilir.',
      icon: Sparkles,
      color: 'from-emerald-600 to-teal-600',
      borderColor: 'border-emerald-500/30'
    },
    {
      id: 'balik',
      title: 'Balık Tutma',
      command: '!balik',
      desc: 'Olta atılır! Eski bot veya Hamsi tutulabilir, bazen de Efsanevi Köpekbalığı çıkıp dev puan verir.',
      icon: Coins,
      color: 'from-cyan-600 to-blue-600',
      borderColor: 'border-cyan-500/30'
    },
    {
      id: 'kasa',
      title: 'Kasa Açma',
      command: '!kasa',
      desc: 'Puan karşılığı gizemli kasa açılır. Çöp, Sıradan, Nadir veya Efsanevi seviye ödül kazanılır.',
      icon: Trophy,
      color: 'from-yellow-600 to-amber-600',
      borderColor: 'border-yellow-500/30'
    },
    {
      id: 'bomba',
      title: 'Bomba İmha',
      command: '!bomba <miktar>',
      desc: 'Saatli bomba masada! Kırmızı mı mavi mi? Doğru kabloyu kesen bahsi 2 katına çıkarır, yanlış kabloda bomba patlar.',
      icon: ShieldAlert,
      color: 'from-red-600 to-rose-600',
      borderColor: 'border-red-500/30'
    },
    {
      id: 'zar',
      title: 'Zar Atma',
      command: '!zar <miktar>',
      desc: 'İzleyici zarları sallar. 7 ve üzeri gelirse bahsi kazanır, düşük gelirse puan kasaya geçer.',
      icon: Dice5,
      color: 'from-violet-600 to-purple-600',
      borderColor: 'border-violet-500/30'
    },
    {
      id: 'yazi_tura',
      title: 'Yazı Tura',
      command: '!yazitura <yazi/tura> <miktar>',
      desc: 'Klasik yazı tura atışı. Tahmini doğru çıkan izleyici parasını ikiye katlar.',
      icon: Coins,
      color: 'from-emerald-600 to-green-600',
      borderColor: 'border-emerald-500/30'
    },
    {
      id: 'duello',
      title: '1v1 Düello',
      command: '!duello @kullanici <miktar>',
      desc: 'İki izleyici chatte kozlarını paylaşır. Hedeflenen kullanıcı !kabul yazınca düello başlar, kazanan tüm bahsi alır.',
      icon: Gamepad2,
      color: 'from-fuchsia-600 to-pink-600',
      borderColor: 'border-fuchsia-500/30'
    }
  ];

  const filteredGames = selectedGameTab === 'all' 
    ? gameDefinitions 
    : gameDefinitions.filter(g => g.id === selectedGameTab);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Gamepad2 className="w-7 h-7 text-purple-400" />
            Chat Oyunları & İnteraktif Etkinlikler
          </h1>
          <p className="text-xs text-gray-400">
            İzleyicilerin canlı yayında komutlarla etkileşime gireceği 10 profesyonel chat mini oyunu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLobbies}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
            title="Lobileri Yenile"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleSave}
            // Ayarlar sunucudan gelmeden kaydedilirse varsayılanlar gerçek
            // ayarların üzerine yazılırdı (`loading` tutuluyor ama kullanılmıyordu)
            disabled={saving || loading}
            title={loading ? 'Ayarlar yükleniyor…' : undefined}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-purple-600/30 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Tüm Oyun Ayarlarını Kaydet</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div className="flex items-center gap-2 p-3.5 bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-200 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Top Controls & Manual Triggers Banner */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
        <div>
          <h3 className="text-sm font-extrabold text-white">Yayıncı Hızlı Tetikleyicileri</h3>
          <p className="text-xs text-gray-400">Chati hareketlendirmek için tek tıkla oyun başlatın.</p>
        </div>

        <div className="md:col-span-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleTriggerGame('trivia')}
            className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
            <span>🧠 Trivia Sorusu Gönder</span>
          </button>

          <button
            onClick={() => handleTriggerGame('kelime')}
            className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>🔤 Kelime Anagramı Başlat</span>
          </button>

          <button
            onClick={() => handleTriggerGame('soygun')}
            className="px-3.5 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>🏦 Soygun Çağrısı Yap</span>
          </button>

          <button
            onClick={() => handleTriggerGame('yaris')}
            className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span>🏎️ Yarış Çağrısı Yap</span>
          </button>
        </div>
      </div>

      {/* Active Lobbies Live Tracker */}
      {activeLobbies.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 bg-amber-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <h3 className="text-sm font-extrabold text-white">Canlı Bekleyen Oyun Lobileri</h3>
            </div>
            <span className="text-[10px] font-mono text-amber-300 font-bold">
              {activeLobbies.length} Aktif Lobi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {activeLobbies.map((lobby, i) => (
              <div key={i} className="p-3 bg-black/60 border border-amber-500/30 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-black text-amber-300 capitalize flex items-center gap-1">
                    <span>🎮 {lobby.game}</span>
                    <span className="text-[10px] text-gray-400 font-normal">({lobby.participants?.length || 0} Oyuncu)</span>
                  </div>
                  <div className="text-[10px] text-gray-300 font-mono mt-0.5">
                    Toplam Havuz: <b>{lobby.totalPot || 0} Puan</b>
                  </div>
                </div>

                <button
                  onClick={() => handleCancelLobby(lobby.game)}
                  className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30 rounded-lg text-[10px] font-bold"
                >
                  İptal Et
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedGameTab('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            selectedGameTab === 'all'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-[#12141a] text-gray-400 hover:text-white border border-white/5'
          }`}
        >
          Tüm Oyunlar (10)
        </button>

        {gameDefinitions.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGameTab(g.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              selectedGameTab === g.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-[#12141a] text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            {g.title}
          </button>
        ))}
      </div>

      {/* 10 Games Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredGames.map(game => {
          const Icon = game.icon;
          const conf = (settings as any)[game.id] || {};

          return (
            <div
              key={game.id}
              className={`glass-panel p-5 rounded-2xl border ${game.borderColor} bg-[#11131a]/90 space-y-4 relative flex flex-col justify-between`}
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${game.color} flex items-center justify-center text-white shadow-lg`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                        {game.title}
                        {conf.enabled ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-gray-500" />
                        )}
                      </h3>
                      <span className="text-[11px] font-mono text-purple-300 font-bold">
                        {game.command}
                      </span>
                    </div>
                  </div>

                  {/* Enable Switch */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(conf.enabled)}
                      onChange={e => updateGameField(game.id as any, 'enabled', e.target.checked)}
                      className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-300">
                      {conf.enabled ? 'Aktif' : 'Pasif'}
                    </span>
                  </label>
                </div>

                <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                  {game.desc}
                </p>

                {/* Specific Game Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4 text-xs">
                  {/* Min Bet */}
                  {conf.minBet !== undefined && (
                    <div className="bg-black/50 p-2.5 rounded-xl border border-white/5">
                      <label className="text-[10px] text-gray-400 block mb-1">Min Bahis</label>
                      <input
                        type="number"
                        min="1"
                        value={conf.minBet}
                        onChange={e => updateGameField(game.id as any, 'minBet', parseInt(e.target.value, 10) || 1)}
                        className="w-full bg-[#12141a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  )}

                  {/* Max Bet */}
                  {conf.maxBet !== undefined && (
                    <div className="bg-black/50 p-2.5 rounded-xl border border-white/5">
                      <label className="text-[10px] text-gray-400 block mb-1">Maks Bahis</label>
                      <input
                        type="number"
                        min="1"
                        value={conf.maxBet}
                        onChange={e => updateGameField(game.id as any, 'maxBet', parseInt(e.target.value, 10) || 100)}
                        className="w-full bg-[#12141a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  )}

                  {/* Win Multiplier */}
                  {conf.winMultiplier !== undefined && (
                    <div className="bg-black/50 p-2.5 rounded-xl border border-white/5">
                      <label className="text-[10px] text-gray-400 block mb-1">Ödül Çarpanı</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={conf.winMultiplier}
                        onChange={e => updateGameField(game.id as any, 'winMultiplier', parseFloat(e.target.value) || 2)}
                        className="w-full bg-[#12141a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  )}

                  {/* Reward Points (Trivia & Kelime) */}
                  {conf.rewardPoints !== undefined && (
                    <div className="bg-black/50 p-2.5 rounded-xl border border-white/5">
                      <label className="text-[10px] text-gray-400 block mb-1">Doğru Cevap Ödülü</label>
                      <input
                        type="number"
                        min="1"
                        value={conf.rewardPoints}
                        onChange={e => updateGameField(game.id as any, 'rewardPoints', parseInt(e.target.value, 10) || 50)}
                        className="w-full bg-[#12141a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  )}

                  {/* Timeout Sec */}
                  {conf.timeoutSec !== undefined && (
                    <div className="bg-black/50 p-2.5 rounded-xl border border-white/5">
                      <label className="text-[10px] text-gray-400 block mb-1">Cevaplama Süresi</label>
                      <input
                        type="number"
                        min="10"
                        max="120"
                        value={conf.timeoutSec}
                        onChange={e => updateGameField(game.id as any, 'timeoutSec', parseInt(e.target.value, 10) || 30)}
                        className="w-full bg-[#12141a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  )}

                  {/* Kasa Cost */}
                  {conf.cost !== undefined && (
                    <div className="bg-black/50 p-2.5 rounded-xl border border-white/5">
                      <label className="text-[10px] text-gray-400 block mb-1">Kasa Ücreti (Puan)</label>
                      <input
                        type="number"
                        min="10"
                        value={conf.cost}
                        onChange={e => updateGameField(game.id as any, 'cost', parseInt(e.target.value, 10) || 100)}
                        className="w-full bg-[#12141a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  )}

                  {/* Balik min/max */}
                  {conf.minPoints !== undefined && (
                    <div className="bg-black/50 p-2.5 rounded-xl border border-white/5">
                      <label className="text-[10px] text-gray-400 block mb-1">Min Balık Puanı</label>
                      <input
                        type="number"
                        min="1"
                        value={conf.minPoints}
                        onChange={e => updateGameField(game.id as any, 'minPoints', parseInt(e.target.value, 10) || 5)}
                        className="w-full bg-[#12141a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  )}
                  {conf.maxPoints !== undefined && (
                    <div className="bg-black/50 p-2.5 rounded-xl border border-white/5">
                      <label className="text-[10px] text-gray-400 block mb-1">Maks Balık Puanı</label>
                      <input
                        type="number"
                        min="10"
                        value={conf.maxPoints}
                        onChange={e => updateGameField(game.id as any, 'maxPoints', parseInt(e.target.value, 10) || 100)}
                        className="w-full bg-[#12141a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  )}

                  {/* Cooldown Sec */}
                  {conf.cooldownSec !== undefined && (
                    <div className="bg-black/50 p-2.5 rounded-xl border border-white/5">
                      <label className="text-[10px] text-gray-400 block mb-1">Bekleme Süresi (sn)</label>
                      <input
                        type="number"
                        min="5"
                        value={conf.cooldownSec}
                        onChange={e => updateGameField(game.id as any, 'cooldownSec', parseInt(e.target.value, 10) || 30)}
                        className="w-full bg-[#12141a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Quick Test Button */}
              <div className="pt-4 mt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-mono">Chat Komutu: {game.command.split(' ')[0]}</span>
                <button
                  onClick={() => handleTriggerGame(game.id)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3 text-purple-400" />
                  <span>Chate Gönder</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MiniGames;
