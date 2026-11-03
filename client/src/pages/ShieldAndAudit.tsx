import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserX,
  History,
  RefreshCw,
  Lock,
  Plus
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
  karaListeEylemi?: KaraListeEylemi;
  platformdaSil?: boolean;
  /** Sunucu: bu etkinleştirmeden beri engellenen mesaj */
  engellenenMesaj?: number;
  /** Sunucu: uygulanamayan ayar → gerekçe */
  desteklenmeyen?: Partial<Record<'followerOnly' | 'minAccountAgeDays', string>>;
}

type KalkanKurali = 'subOnly' | 'blockLinks' | 'blockCaps' | 'blockEmotes' | 'platformdaSil' | 'autoClearRaidMessages';

const KALKAN_KURALLARI: Array<{ id: KalkanKurali; ad: string; aciklama: string }> = [
  { id: 'blockLinks', ad: 'Link engeli', aciklama: 'Adres içeren her mesaj (normal moddaki izinli alan adları kalkanda geçmez).' },
  { id: 'blockCaps', ad: 'Büyük harf engeli', aciklama: "En az 8 harfin %70'i büyük harfse." },
  { id: 'blockEmotes', ad: 'Emoji seli engeli', aciklama: "3'ten fazla emoji ya da emote." },
  { id: 'subOnly', ad: 'Yalnız aboneler', aciklama: 'Abone, VIP, moderatör ve yayıncı dışındaki herkesin mesajı.' },
  { id: 'platformdaSil', ad: 'Platformda da sil', aciklama: "Takılan mesaj platformda da silinir (Kick, Twitch, YouTube, Trovo, Discord). Kapalıyken yalnız bot yok sayar ve OBS'te gizlenir." },
  { id: 'autoClearRaidMessages', ad: 'Açarken OBS sohbetini temizle', aciklama: 'Kalkan açılınca OBS sohbet katmanı boşaltılır (platform sohbetine dokunulmaz).' }
];

const DESTEKLENMEYEN_AD: Record<'followerOnly' | 'minAccountAgeDays', string> = {
  followerOnly: 'Yalnız takipçiler',
  minAccountAgeDays: 'En az hesap yaşı'
};

type KaraListeEylemi = 'yoksay' | 'sil' | 'ban';

const KARA_LISTE_EYLEMLERI: Array<{ id: KaraListeEylemi; ad: string; aciklama: string }> = [
  { id: 'yoksay', ad: 'Yalnız yok say', aciklama: 'Bot komut/puan/TTS işlemez; mesaj OBS sohbetinde gösterilmez. Platformda bir şey yapılmaz.' },
  { id: 'sil', ad: 'Mesajını sil', aciklama: 'Ayrıca mesaj platformda silinir (Kick, Twitch, YouTube, Trovo, Discord).' },
  { id: 'ban', ad: 'Kalıcı banla', aciklama: 'Ayrıca kişi o platformda KALICI banlanır (Kick, Twitch, YouTube, Trovo, Discord). Desteklemeyen platformda (TikTok) yalnız yok sayılır.' }
];

const KARA_LISTE_PLATFORMLARI: Array<{ id: string; ad: string }> = [
  { id: 'kick', ad: 'Kick' },
  { id: 'twitch', ad: 'Twitch' },
  { id: 'youtube', ad: 'YouTube' },
  { id: 'trovo', ad: 'Trovo' },
  { id: 'tiktok', ad: 'TikTok' },
  { id: 'discord', ad: 'Discord' },
  { id: 'tum', ad: 'Tüm platformlar' }
];

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
  platform?: string;
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
  const [newBanPlatform, setNewBanPlatform] = useState('kick');
  const [actionFilter, setActionFilter] = useState('');
  const [eylemNotu, setEylemNotu] = useState<{ ok: boolean; text: string } | null>(null);
  const [kuralNotu, setKuralNotu] = useState<{ ok: boolean; text: string } | null>(null);

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
        body: JSON.stringify({ username: newBanUser, reason: newBanReason, addedBy: 'Yayıncı', platform: newBanPlatform })
      });
      if (res.ok) {
        setNewBanUser('');
        fetchData();
      }
    } catch {}
  };

  // Kalkan kuralları anında kaydedilir (4. tur: eskiden bu ayarlar hiçbir yerde uygulanmıyordu)
  const kuralKaydet = async (id: KalkanKurali, deger: boolean) => {
    if (id === 'platformdaSil' && deger && !confirm('Kalkan açıkken kurallara takılan mesajlar platformda SİLİNECEK. Emin misiniz?')) return;
    setKuralNotu(null);
    try {
      const res = await fetch('/api/moderation/shield/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [id]: deger })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.settings) {
        setShield((s) => ({ ...s, ...d.settings }));
        setKuralNotu({ ok: true, text: 'Kaydedildi.' });
      } else {
        setKuralNotu({ ok: false, text: d?.error || `Kaydedilemedi (HTTP ${res.status})` });
      }
    } catch {
      setKuralNotu({ ok: false, text: 'Sunucuya ulaşılamadı' });
    }
  };

  const karaListeEylemiKaydet = async (eylem: KaraListeEylemi) => {
    if (eylem === 'ban' && !confirm('Kara listedeki kişi yazınca o platformda KALICI banlanacak. Emin misiniz?')) return;
    setEylemNotu(null);
    try {
      const res = await fetch('/api/moderation/shield/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ karaListeEylemi: eylem })
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.settings) {
        setShield(d.settings);
        setEylemNotu({ ok: true, text: 'Kara liste eylemi kaydedildi.' });
      } else {
        setEylemNotu({ ok: false, text: d?.error || `Kaydedilemedi (HTTP ${res.status})` });
      }
    } catch {
      setEylemNotu({ ok: false, text: 'Sunucuya ulaşılamadı' });
    }
  };

  const handleRemoveBan = async (username: string) => {
    try {
      await fetch(`/api/moderation/shared-bans/${encodeURIComponent(username)}`, {
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
              <span className="text-xs text-gray-400">AxBoT Shield Standardı</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white">
              Tek Tıkla Raid & Bot Saldırı Kalkanı
            </h1>
            <p className="text-gray-300 text-sm max-w-2xl">
              Raid, spam ya da bot saldırısında tek tıkla açın: aşağıdaki kurallara takılan mesajları bot yok sayar ve
              OBS sohbetinde gösterilmez; isterseniz platformda da silinir. Platformun kendi sohbet modları (yalnız
              takipçi, yavaş mod) buradan değiştirilmez.
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

      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-md font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Kalkan kuralları
          </h2>
          {shield.isActive && (
            <span className="text-xs font-bold text-amber-200">
              Açıldığından beri {shield.engellenenMesaj ?? 0} mesaj engellendi
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400">
          Yalnız kalkan açıkken uygulanır; yayıncı ve moderatörler muaftır. Değişiklik anında kaydedilir.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {KALKAN_KURALLARI.map((k) => (
            <label
              key={k.id}
              className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3 cursor-pointer hover:border-slate-600"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={!!shield[k.id]}
                onChange={(e) => void kuralKaydet(k.id, e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-white">{k.ad}</span>
                <span className="block text-[11px] text-gray-400 leading-snug">{k.aciklama}</span>
              </span>
            </label>
          ))}
        </div>
        {shield.desteklenmeyen && Object.keys(shield.desteklenmeyen).length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-1">
            {(Object.entries(shield.desteklenmeyen) as Array<['followerOnly' | 'minAccountAgeDays', string]>).map(([id, neden]) => (
              <p key={id} className="text-[11px] text-gray-400">
                <span className="font-bold text-gray-300">{DESTEKLENMEYEN_AD[id] ?? id}</span> — desteklenmiyor: {neden}
              </p>
            ))}
          </div>
        )}
        {kuralNotu && (
          <p className={`text-[11px] font-semibold ${kuralNotu.ok ? 'text-emerald-400' : 'text-red-300'}`}>{kuralNotu.text}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Kick Shared Global Ban List (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-md font-bold text-white flex items-center gap-2">
              <UserX className="w-5 h-5 text-red-400" />
              Ortak Kara Liste
            </h2>
            <p className="text-xs text-gray-400">
              Listedeki kişi seçilen platformda yazınca bot onu yok sayar (komut, puan, TTS yok) ve mesajı OBS
              sohbetinde gösterilmez. Aşağıda seçilen eylem ayrıca platformda uygulanır.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-300">Listedeki kişi yazınca</label>
              <div className="grid grid-cols-3 gap-1.5">
                {KARA_LISTE_EYLEMLERI.map((e) => {
                  const secili = (shield.karaListeEylemi || 'yoksay') === e.id;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      title={e.aciklama}
                      onClick={() => !secili && void karaListeEylemiKaydet(e.id)}
                      className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        secili
                          ? e.id === 'ban'
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-950 border-slate-700 text-gray-300 hover:border-slate-500'
                      }`}
                    >
                      {e.ad}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-500">
                {KARA_LISTE_EYLEMLERI.find((e) => e.id === (shield.karaListeEylemi || 'yoksay'))?.aciklama}
              </p>
              {eylemNotu && (
                <p className={`text-[11px] font-semibold ${eylemNotu.ok ? 'text-emerald-400' : 'text-red-300'}`}>{eylemNotu.text}</p>
              )}
            </div>

            <form onSubmit={handleAddBan} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Kullanıcı adı"
                  value={newBanUser}
                  onChange={e => setNewBanUser(e.target.value)}
                  className="min-w-0 flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-red-500 focus:outline-none"
                />
                <select
                  value={newBanPlatform}
                  onChange={e => setNewBanPlatform(e.target.value)}
                  title="Kayıt yalnız bu platformda geçerli olur: başka platformdaki aynı adlı kişi etkilenmez"
                  className="bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-white text-xs focus:border-red-500 focus:outline-none"
                >
                  {KARA_LISTE_PLATFORMLARI.map((p) => (
                    <option key={p.id} value={p.id}>{p.ad}</option>
                  ))}
                </select>
              </div>
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
                        <span className="text-[10px] font-semibold text-gray-400 bg-slate-800 rounded px-1.5 py-0.5">
                          {KARA_LISTE_PLATFORMLARI.find((p) => p.id === (b.platform || 'kick'))?.ad || b.platform}
                        </span>
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
                <option value="SHARED_BAN_REMOVED">Kara Listeden Çıkarma</option>
                <option value="SHARED_BAN_ENFORCED">Kara Liste Banı</option>
                <option value="SHARED_BAN_FAILED">Kara Liste Banı (başarısız)</option>
                <option value="MANUAL_TIMEOUT">Elle Zaman Aşımı</option>
                <option value="MANUAL_BAN">Elle Kalıcı Ban</option>
                <option value="MANUAL_UNBAN">Ban Kaldırma</option>
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
