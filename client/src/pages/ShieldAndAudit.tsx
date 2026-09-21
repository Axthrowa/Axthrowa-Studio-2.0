import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Trash2, 
  UserX, 
  History, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Lock,
  Plus,
  Sliders,
  Radio
} from 'lucide-react';

interface ShieldSettings {
  isActive: boolean;
  activatedAt?: number;
  autoClearRaidMessages: boolean;
  minAccountAgeDays: number;
  blockLinks: boolean;
  blockCaps: boolean;
  blockEmotes: boolean;
  followerOnly: boolean;
  subOnly: boolean;
}

interface AuditLog {
  id: string;
  timestamp: number;
  action: string;
  moderator: string;
  target?: string;
  details?: string;
  severity?: 'info' | 'warn' | 'danger';
}

interface SharedBan {
  username: string;
  reason: string;
  added_by: string;
  added_at: number;
}

export default function ShieldAndAudit() {
  const [shield, setShield] = useState<ShieldSettings>({
    isActive: false,
    autoClearRaidMessages: true,
    minAccountAgeDays: 3,
    blockLinks: true,
    blockCaps: true,
    blockEmotes: true,
    followerOnly: true,
    subOnly: false
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [sharedBans, setSharedBans] = useState<SharedBan[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBanUser, setNewBanUser] = useState('');
  const [newBanReason, setNewBanReason] = useState('Spam/Bot Saldırısı');
  const [actionFilter, setActionFilter] = useState('');

  const fetchData = async () => {
    try {
      const [shieldRes, logsRes, bansRes] = await Promise.all([
        fetch('/api/moderation/shield').then(r => r.json()),
        fetch(`/api/moderation/audit-logs${actionFilter ? `?action=${actionFilter}` : ''}`).then(r => r.json()),
        fetch('/api/moderation/shared-bans').then(r => r.json())
      ]);

      if (shieldRes) setShield(shieldRes);
      if (Array.isArray(logsRes)) setAuditLogs(logsRes);
      if (Array.isArray(bansRes)) setSharedBans(bansRes);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [actionFilter]);

  const toggleShield = async () => {
    const endpoint = shield.isActive ? '/api/moderation/shield/deactivate' : '/api/moderation/shield/activate';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderator: 'Yayıncı' })
      });
      const data = await res.json();
      if (data.success && data.settings) {
        setShield(data.settings);
        fetchData();
      }
    } catch {}
  };

  const handleAddBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanUser.trim()) return;

    try {
      const res = await fetch('/api/moderation/shared-bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newBanUser, reason: newBanReason, addedBy: 'Yayıncı' })
      });
      if (res.ok) {
        setNewBanUser('');
        fetchData();
      }
    } catch {}
  };

  const handleRemoveBan = async (username: string) => {
    try {
      await fetch(`/api/moderation/shared-bans/${username}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removedBy: 'Yayıncı' })
      });
      fetchData();
    } catch {}
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString('tr-TR')} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Güvenlik ve denetim kayıtları yükleniyor...</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* 1. Shield Mode Emergency Center */}
      <div className={`p-6 rounded-2xl border transition-all duration-500 shadow-2xl relative overflow-hidden ${
        shield.isActive 
          ? 'bg-gradient-to-r from-red-950 via-red-900/60 to-slate-950 border-red-500/80 shadow-[0_0_35px_rgba(239,68,68,0.35)]' 
          : 'bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 border-slate-800'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                shield.isActive 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {shield.isActive ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                {shield.isActive ? 'KALKAN MODU AKTİF (ACİL DURUM)' : 'SİSTEM GÜVENLİ (NORMAL MOD)'}
              </span>
              <span className="text-xs text-gray-400">StreamAxT Shield Standardı</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white">
              Tek Tıkla Raid & Bot Saldırı Kalkanı
            </h1>
            <p className="text-gray-300 text-sm max-w-2xl">
              Raid, spam veya kötü niyetli bot saldırısı başladığında tek tıkla kalkanı kaldırın. Sohbet anında temizlenir, katı link/caps kısıtlamaları devreye girer ve kanal korumaya alınır.
            </p>
          </div>

          <button
            onClick={toggleShield}
            className={`px-8 py-4 rounded-2xl font-black text-base transition-all duration-300 shadow-xl cursor-pointer flex items-center gap-3 whitespace-nowrap ${
              shield.isActive
                ? 'bg-gradient-to-r from-gray-700 to-slate-800 hover:from-gray-600 hover:to-slate-700 text-white border border-gray-600'
                : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/40 transform hover:scale-105'
            }`}
          >
            {shield.isActive ? <Lock className="w-6 h-6 text-emerald-400" /> : <ShieldAlert className="w-6 h-6 animate-bounce" />}
            {shield.isActive ? 'Kalkanı Kapat (Normale Dön)' : '🛡️ Kalkanı Aktif Et!'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Kick Shared Global Ban List (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-400" />
              Kick Ortak Kara Listesi (Shared Bans)
            </h2>
            <p className="text-xs text-gray-400">
              Bu listedeki kullanıcılar chate geldiklerinde mesajları bot tarafından otomatik filtrelenir ve engellenir.
            </p>

            <form onSubmit={handleAddBan} className="space-y-3">
              <input
                type="text"
                placeholder="Kick Kullanıcı Adı"
                value={newBanUser}
                onChange={e => setNewBanUser(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-red-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Engelleme Sebebi"
                value={newBanReason}
                onChange={e => setNewBanReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-red-500 focus:outline-none"
              />
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-red-600/30"
              >
                <Plus className="w-4 h-4" /> Kara Listeye Ekle
              </button>
            </form>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {sharedBans.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-6">
                  Henüz kara listeye eklenmiş hesap yok.
                </div>
              ) : (
                sharedBans.map(b => (
                  <div key={b.username} className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span className="text-red-400">@{b.username}</span>
                      </div>
                      <div className="text-xs text-gray-400 line-clamp-1">{b.reason}</div>
                    </div>
                    <button
                      onClick={() => handleRemoveBan(b.username)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Yasağı Kaldır"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Audit Logs Table (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" />
              Denetim Günlüğü (Audit Logs)
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-xs text-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="">Tüm Olaylar</option>
                <option value="SHIELD_MODE_ACTIVATED">Kalkan Açıldı</option>
                <option value="SHIELD_MODE_DEACTIVATED">Kalkan Kapandı</option>
                <option value="SHARED_BAN_ADDED">Kara Liste Ekleme</option>
                <option value="KING_CROWNED">Kral Değişimi</option>
                <option value="VIEWER_NOTE_SAVED">Yayıncı Notu</option>
                <option value="TTS_SETTINGS_UPDATED">TTS Değişikliği</option>
              </select>
              <button
                onClick={fetchData}
                className="p-1.5 rounded-lg bg-slate-800 text-gray-300 hover:text-white transition-colors"
                title="Yenile"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-800/80">
              {auditLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  Kayıtlı denetim olayı bulunamadı.
                </div>
              ) : (
                auditLogs.map(log => {
                  const isDanger = log.severity === 'danger';
                  const isWarn = log.severity === 'warn';

                  return (
                    <div key={log.id} className="p-4 hover:bg-slate-800/40 transition-colors flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            isDanger 
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                              : isWarn 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}>
                            {log.action}
                          </span>
                          <span className="text-xs font-semibold text-gray-300">
                            Moderatör: <strong className="text-white">{log.moderator}</strong>
                          </span>
                          {log.target && (
                            <span className="text-xs text-indigo-300">
                              (Hedef: @{log.target})
                            </span>
                          )}
                        </div>

                        {log.details && (
                          <p className="text-xs text-gray-300">{log.details}</p>
                        )}
                      </div>

                      <div className="text-[11px] text-gray-500 whitespace-nowrap pt-0.5">
                        {formatTime(log.timestamp)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
