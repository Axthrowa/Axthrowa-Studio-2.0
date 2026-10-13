import { useState, useEffect } from 'react';
import {
  Coins,
  Trophy,
  Sparkles,
  Search,
  Clock,
  ShoppingBag,
  Sliders,
  Plus,
  CheckCircle2,
  Check,
  RotateCcw,
  Bell
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket.js';

interface LoyaltyUser {
  id: string;
  platform: string;
  username: string;
  display_name: string;
  points: number;
  watch_time_minutes: number;
  messages_count?: number;
  subs_count?: number;
  gifted_subs_count?: number;
  tips_amount?: number;
  loyalty_tier?: string;
  last_active: number;
}

interface LoyaltyRewardItem {
  id: string;
  title: string;
  cost: number;
  reward_type: string;
  payload?: string;
  is_enabled: number;
}

interface LoyaltyRedemption {
  id: string;
  platform: string;
  username: string;
  display_name: string;
  reward_id: string;
  reward_title: string;
  cost: number;
  custom_input?: string;
  status: 'pending' | 'completed' | 'refunded';
  created_at: number;
}

interface LoyaltyRates {
  pointsPerMessage: number;
  pointsPerInterval: number;
  intervalMinutes: number;
  pointsPerSub: number;
  pointsPerGiftedSub: number;
  pointsPerTipUnit: number;
}

export function Economy() {
  const [activeTab, setActiveTab] = useState<'queue' | 'leaderboard' | 'store' | 'settings'>('queue');
  const [users, setUsers] = useState<LoyaltyUser[]>([]);
  const [rewards, setRewards] = useState<LoyaltyRewardItem[]>([]);
  const [redemptions, setRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [rates, setRates] = useState<LoyaltyRates>({
    pointsPerMessage: 2,
    pointsPerInterval: 15,
    intervalMinutes: 5,
    pointsPerSub: 500,
    pointsPerGiftedSub: 1000,
    pointsPerTipUnit: 50
  });
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [showAddRewardModal, setShowAddRewardModal] = useState(false);
  const [newReward, setNewReward] = useState({
    title: '',
    cost: 200,
    rewardType: 'sound',
    payload: 'airhorn'
  });

  const { lastMessage } = useWebSocket();

  const fetchRedemptions = () => {
    fetch('/api/economy/redemptions')
      .then(r => r.json())
      .then(d => setRedemptions(d || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/economy/leaderboard')
      .then(r => r.json())
      .then(d => setUsers(d || []))
      .catch(() => {});

    fetch('/api/economy/rewards')
      .then(r => r.json())
      .then(d => setRewards(d || []))
      .catch(() => {});

    fetch('/api/economy/loyalty-settings')
      .then(r => r.json())
      .then(d => {
        if (d) setRates(d);
      })
      .catch(() => {});

    fetchRedemptions();
  }, []);

  // Listen to live WebSocket events
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'loyalty_redeemed' || lastMessage.type === 'loyalty_redemption_updated') {
      fetchRedemptions();
    }
  }, [lastMessage]);

  const handleUpdateRedemptionStatus = async (id: string, status: 'completed' | 'refunded') => {
    try {
      await fetch(`/api/economy/redemptions/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchRedemptions();
      setNotification(status === 'completed' ? '✅ Talep tamamlandı olarak işaretlendi!' : '↩️ Talep iptal edildi ve puan izleyiciye iade edildi!');
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setNotification('❌ İşlem başarısız');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleCreateReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReward.title) return;

    const id = `reward-${Date.now()}`;
    await fetch('/api/economy/rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        title: newReward.title,
        cost: Number(newReward.cost) || 100,
        rewardType: newReward.rewardType,
        payload: newReward.payload
      })
    });

    setShowAddRewardModal(false);
    setNewReward({ title: '', cost: 200, rewardType: 'sound', payload: 'airhorn' });
    fetch('/api/economy/rewards').then(r => r.json()).then(d => setRewards(d || []));
    setNotification('🎉 Yeni ödül mağazaya eklendi!');
    setTimeout(() => setNotification(null), 3500);
  };

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/economy/loyalty-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rates)
    });
    setNotification('💾 Sadakat puan oranları başarıyla güncellendi!');
    setTimeout(() => setNotification(null), 3500);
  };

  const formatWatchTime = (totalMinutes: number = 0) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m} dk`;
    return `${h} sa ${m} dk`;
  };

  const pendingCount = redemptions.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Coins className="w-6 h-6 text-purple-400" />
            Sadakat Sistemi & Puan Ekonomisi
          </h1>
          <p className="text-sm text-gray-400">
            İzleyicilerin izleme süresi, mesajları, abonelikleri ve bağışlarıyla puan kazandığı çok katmanlı sadakat motoru.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'queue'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Gelen Talepler</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'leaderboard'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Sıralama & Profil</span>
          </button>

          <button
            onClick={() => setActiveTab('store')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'store'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Ödül Mağazası</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Puan Oranları</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="flex items-center gap-2 p-3.5 bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-200 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* TAB 0: REDEMPTIONS QUEUE */}
      {activeTab === 'queue' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                Gelen Ödül Talepleri (Canlı Kuyruk)
              </h2>
              <p className="text-xs text-gray-400">
                İzleyicilerin chatten (!al) veya marketten satın aldığı ödüller burada listelenir.
              </p>
            </div>
            <button
              onClick={fetchRedemptions}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all"
            >
              Yenile
            </button>
          </div>

          {redemptions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">
              Henüz mağazadan talep edilen bir ödül bulunmuyor. Chat'te izleyiciler <code className="text-purple-300">!al &lt;ürün&gt;</code> yazdığında anında burada belirecektir.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 text-[11px] uppercase">
                    <th className="py-2.5 px-3">İzleyici</th>
                    <th className="py-2.5 px-3">Ödül</th>
                    <th className="py-2.5 px-3">Puan</th>
                    <th className="py-2.5 px-3">Mesaj / Girdi</th>
                    <th className="py-2.5 px-3">Zaman</th>
                    <th className="py-2.5 px-3">Durum</th>
                    <th className="py-2.5 px-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {redemptions.map(r => (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-1.5">
                        <span>@{r.display_name || r.username}</span>
                        <span className="text-[10px] text-gray-500 uppercase font-mono">({r.platform})</span>
                      </td>
                      <td className="py-3 px-3 text-purple-300 font-extrabold">{r.reward_title}</td>
                      <td className="py-3 px-3 text-amber-400 font-mono font-bold">-{r.cost}</td>
                      <td className="py-3 px-3 text-gray-300 italic">{r.custom_input || '—'}</td>
                      <td className="py-3 px-3 text-gray-400 font-mono text-[11px]">
                        {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          r.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : r.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          {r.status === 'pending' ? 'Bekliyor' : r.status === 'completed' ? 'Tamamlandı' : 'İade Edildi'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleUpdateRedemptionStatus(r.id, 'completed')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                              title="Tamamla"
                            >
                              <Check className="w-3 h-3" />
                              <span>Onayla</span>
                            </button>
                            <button
                              onClick={() => handleUpdateRedemptionStatus(r.id, 'refunded')}
                              className="px-2.5 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                              title="Reddet & Puanı İade Et"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>İade Et</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-500 font-mono">İşlendi</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: LEADERBOARD & STATS */}
      {activeTab === 'leaderboard' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                İzleyici Sadakat Sıralaması
              </h2>
              <p className="text-xs text-gray-400">İzleme süresi, mesaj sayısı ve aboneliklerle puan toplayan izleyiciler.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="İzleyici ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#12141a] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-[11px] uppercase">
                  <th className="py-2 px-3"># Sıra</th>
                  <th className="py-2 px-3">Kullanıcı</th>
                  <th className="py-2 px-3">Rütbe (Tier)</th>
                  <th className="py-2 px-3">İzleme Süresi</th>
                  <th className="py-2 px-3">Mesajlar</th>
                  <th className="py-2 px-3">Abonelikler</th>
                  <th className="py-2 px-3 text-right">Mevcut Puan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {users
                  .filter(u => u.display_name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase()))
                  .map((user, idx) => (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-gray-400">
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `${idx + 1}`}
                      </td>
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <span>@{user.display_name || user.username}</span>
                        <span className="text-[10px] text-gray-500 uppercase font-mono">({user.platform})</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600/20 text-purple-300 border border-purple-500/30">
                          {user.loyalty_tier || '🥉 Çaylak'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-400" />
                        <span>{formatWatchTime(user.watch_time_minutes)}</span>
                      </td>
                      <td className="py-3 px-3 text-gray-300 font-mono">
                        {user.messages_count || 0} 💬
                      </td>
                      <td className="py-3 px-3 text-gray-300 font-mono">
                        ⭐ {user.subs_count || 0} {user.gifted_subs_count ? `(🎁 ${user.gifted_subs_count})` : ''}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-amber-400 font-mono text-sm">
                        {user.points.toLocaleString()} 💰
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: STORE MANAGEMENT */}
      {activeTab === 'store' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-purple-400" />
                Sadakat Ödül Mağazası Kataloğu
              </h2>
              <p className="text-xs text-gray-400">İzleyicilerin puanlarıyla satın alabileceği ödüller ve ses/TTS tetikleyicileri.</p>
            </div>
            <button
              onClick={() => setShowAddRewardModal(true)}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-purple-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Ödül Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map(item => (
              <div key={item.id} className="p-4 bg-[#12141a] rounded-xl border border-white/5 space-y-2 relative">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-black text-white">{item.title}</h4>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg">
                    {item.cost} Puan
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 font-mono">
                  Komut: <code className="text-purple-300">!al {item.id.replace('reward-', '')}</code>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-[11px] text-gray-500">
                  <span>Tür: <b className="text-gray-300">{item.reward_type}</b></span>
                  {item.payload && <span className="truncate">({item.payload})</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LOYALTY SETTINGS & RATES */}
      {activeTab === 'settings' && (
        <div className="max-w-xl glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              Puan Kazanma Oranları & Formülü
            </h2>
            <p className="text-xs text-gray-400">İzleyicilerin hangi eylem karşılığında kaç puan kazanacağını belirleyin.</p>
          </div>

          <form onSubmit={handleSaveRates} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                İzleme Süresi Puanı (Her aralıkta verilen puan)
              </label>
              <input
                type="number"
                value={rates.pointsPerInterval}
                onChange={e => setRates({ ...rates, pointsPerInterval: parseInt(e.target.value, 10) || 15 })}
                className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                İzleme Kontrol Aralığı (Dakika)
              </label>
              <input
                type="number"
                value={rates.intervalMinutes}
                onChange={e => setRates({ ...rates, intervalMinutes: parseInt(e.target.value, 10) || 5 })}
                className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Mesaj Başına Puan
              </label>
              <input
                type="number"
                value={rates.pointsPerMessage}
                onChange={e => setRates({ ...rates, pointsPerMessage: parseInt(e.target.value, 10) || 2 })}
                className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Kanal Aboneliği Başına Puan
              </label>
              <input
                type="number"
                value={rates.pointsPerSub}
                onChange={e => setRates({ ...rates, pointsPerSub: parseInt(e.target.value, 10) || 500 })}
                className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Hediye Abonelik Başına Puan
              </label>
              <input
                type="number"
                value={rates.pointsPerGiftedSub}
                onChange={e => setRates({ ...rates, pointsPerGiftedSub: parseInt(e.target.value, 10) || 1000 })}
                className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Oranları Kaydet</span>
            </button>
          </form>
        </div>
      )}

      {/* Modal: Yeni Ödül Ekle */}
      {showAddRewardModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161f] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-extrabold text-white">Yeni Sadakat Ödülü Ekle</h3>
            <form onSubmit={handleCreateReward} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ödül Başlığı</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: 24 Saat VIP Rolü"
                  value={newReward.title}
                  onChange={e => setNewReward({ ...newReward, title: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Gereken Puan</label>
                <input
                  type="number"
                  required
                  min="10"
                  value={newReward.cost}
                  onChange={e => setNewReward({ ...newReward, cost: parseInt(e.target.value, 10) || 100 })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Ödül Türü (Aksiyon)</label>
                <select
                  value={newReward.rewardType}
                  onChange={e => setNewReward({ ...newReward, rewardType: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="sound">Ses Efekti Çal (Sound)</option>
                  <option value="tts">TTS Sesli Okuma</option>
                  <option value="vip">Geçici VIP Rolü</option>
                  <option value="gif">Ekranda GIF / Kutlama</option>
                  <option value="custom">Özel Talep (Yayıncı Onaylı)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddRewardModal(false)}
                  className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-bold"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                >
                  Ödülü Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Economy;
