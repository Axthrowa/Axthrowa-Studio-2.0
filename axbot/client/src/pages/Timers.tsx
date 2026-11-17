import { useState, useEffect } from 'react';
import { TimerConfig } from '../types.js';
import { BosDurum } from '../ui/index.js';
import { Clock, Plus, Trash2, Edit2, Check, MessageSquare } from 'lucide-react';

export function Timers() {
  const [timers, setTimers] = useState<TimerConfig[]>([]);
  const [editingTimer, setEditingTimer] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [durumlar, setDurumlar] = useState<Record<string, { kalanSn: number; satir: number; minSatir: number }>>({});
  const [hata, setHata] = useState('');

  useEffect(() => {
    loadTimers();
    // Sıradaki mesaja kalan süre (sunucudaki gerçek sayaçtan)
    const oku = () =>
      fetch('/api/timers/durum')
        .then((r) => r.json())
        .then((l: any[]) => setDurumlar(Object.fromEntries((Array.isArray(l) ? l : []).map((d) => [d.id, d]))))
        .catch(() => {});
    oku();
    const t = setInterval(oku, 5000);
    return () => clearInterval(t);
  }, []);

  const loadTimers = () => {
    fetch('/api/timers')
      .then(r => r.json())
      .then(d => setTimers(d))
      .catch(() => {});
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTimer) return;

    const messagesArray = Array.isArray(editingTimer.messages)
      ? editingTimer.messages
      : editingTimer.messagesText.split('\n').filter((l: string) => l.trim().length > 0);

    const payload = {
      name: editingTimer.name,
      messages: messagesArray,
      intervalMinutes: editingTimer.interval_minutes,
      minChatLines: editingTimer.min_chat_lines,
      isEnabled: editingTimer.is_enabled !== 0,
      onlyLive: Number(editingTimer.only_live) === 1
    };

    const r = await fetch(isNew ? '/api/timers' : `/api/timers/${editingTimer.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => null);
    if (!r?.ok) {
      const d = await r?.json().catch(() => null);
      setHata(d?.error || 'Kaydedilemedi.');
      return;
    }
    setHata('');
    setEditingTimer(null);
    loadTimers();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bu zamanlayıcıyı silmek istediğinize emin misiniz?')) {
      await fetch(`/api/timers/${id}`, { method: 'DELETE' });
      loadTimers();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Duyuru Zamanlayıcıları</h1>
          <p className="text-sm text-gray-400">
            Belirli zaman aralıklarıyla sohbete otomatik duyuru ve bağlantı mesajları gönderin.
          </p>
        </div>

        <button
          onClick={() => {
            setIsNew(true);
            setEditingTimer({
              id: '',
              name: '',
              messagesText: '',
              interval_minutes: 15,
              min_chat_lines: 5,
              is_enabled: 1,
              only_live: 0
            });
          }}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
        >
          <Plus className="w-4 h-4" /> Yeni Zamanlayıcı Ekle
        </button>
      </div>

      {timers.length === 0 && (
        <BosDurum baslik="Henüz zamanlayıcı yok" aciklama="Zamanlayıcı belirli aralıkla sohbete duyuru yazar. Yukarıdaki düğmeyle ilkini ekleyin." />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {timers.map(t => {
          let messagesList: string[] = [];
          try {
            messagesList = JSON.parse(t.messages);
          } catch {
            messagesList = [t.messages];
          }

          return (
            <div key={t.id} className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-purple-400" />
                    <h3 className="font-bold text-white text-base">{t.name}</h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    t.is_enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {t.is_enabled ? 'Aktif' : 'Devre Dışı'}
                  </span>
                </div>

                <div className="space-y-2 mt-3">
                  <div className="flex items-center space-x-4 text-xs text-gray-400">
                    <span>Aralık: <b className="text-white">{t.interval_minutes} dakika</b></span>
                    <span>Asgari Sohbet: <b className="text-white">{t.min_chat_lines} satır</b></span>
                    {Number((t as any).only_live) === 1 && <span className="text-amber-300">Yalnız yayındayken</span>}
                  </div>
                  {t.is_enabled && durumlar[t.id] && (
                    <div className="text-[11px] text-gray-400">
                      {durumlar[t.id].kalanSn > 0
                        ? `Sıradaki mesaj: ${Math.floor(durumlar[t.id].kalanSn / 60)} dk ${durumlar[t.id].kalanSn % 60} sn sonra`
                        : `Süre doldu — ${Math.max(0, durumlar[t.id].minSatir - durumlar[t.id].satir)} sohbet satırı daha bekleniyor`}
                      {` · son mesajdan beri ${durumlar[t.id].satir} satır`}
                    </div>
                  )}

                  <div className="mt-3 bg-black/40 border border-white/5 p-3 rounded-xl space-y-1 text-xs text-gray-300">
                    <span className="font-semibold text-gray-400 flex items-center gap-1 mb-1">
                      <MessageSquare className="w-3 h-3 text-purple-400" /> Döngüsel Mesajlar:
                    </span>
                    {messagesList.map((m, idx) => (
                      <div key={idx} className="truncate text-gray-300">
                        • {m}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setIsNew(false);
                    setEditingTimer({
                      ...t,
                      messagesText: messagesList.join('\n')
                    });
                  }}
                  aria-label="Düzenle" title="Düzenle" className="p-1.5 hover:bg-white/10 rounded-lg text-gray-300 hover:text-white transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  aria-label="Sil" title="Sil" className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {editingTimer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-white/20 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" />
              {isNew ? 'Yeni Zamanlayıcı' : 'Zamanlayıcıyı Düzenle'}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Zamanlayıcı İsmi
                </label>
                <input aria-label="Zamanlayıcı İsmi"
                  type="text"
                  required
                  value={editingTimer.name}
                  onChange={e => setEditingTimer({ ...editingTimer, name: e.target.value })}
                  placeholder="Örn: Discord & Sosyal Medya"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Mesajlar (Her satıra bir mesaj yazın, sırayla gönderilir)
                </label>
                <textarea aria-label="Mesajlar (Her satıra bir mesaj yazın, sırayla gönderilir)"
                  required
                  rows={4}
                  value={editingTimer.messagesText}
                  onChange={e => setEditingTimer({ ...editingTimer, messagesText: e.target.value })}
                  placeholder="Discord sunucumuza gelmeyi unutmayın! 👉 !discord&#10;Yayınları kaçırmamak için takip edin! 👉 !sosyal"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Aralık (Dakika)
                  </label>
                  <input aria-label="Aralık (Dakika)"
                    type="number"
                    min="1"
                    max="1440"
                    value={editingTimer.interval_minutes}
                    onChange={e => setEditingTimer({ ...editingTimer, interval_minutes: parseInt(e.target.value, 10) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">
                    Gereken Asgari Chat Satırı
                  </label>
                  <input aria-label="Gereken Asgari Chat Satırı"
                    type="number"
                    min="0"
                    max="100"
                    value={editingTimer.min_chat_lines}
                    onChange={e => setEditingTimer({ ...editingTimer, min_chat_lines: parseInt(e.target.value, 10) })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-2 text-xs font-bold text-gray-300">
                <label className="flex items-center justify-between">
                  Açık
                  <input type="checkbox" checked={editingTimer.is_enabled !== 0} onChange={e => setEditingTimer({ ...editingTimer, is_enabled: e.target.checked ? 1 : 0 })} />
                </label>
                <label className="flex items-center justify-between">
                  Yalnız yayın açıkken gönder
                  <input type="checkbox" checked={Number(editingTimer.only_live) === 1} onChange={e => setEditingTimer({ ...editingTimer, only_live: e.target.checked ? 1 : 0 })} />
                </label>
                <p className="text-[11px] font-normal text-gray-500">
                  Süre dolduğunda son mesajdan beri en az bu kadar sohbet satırı gelmişse hemen gönderilir; gelmemişse satır sayısı tamamlandığı anda gönderilir. Mesajlarda <code>$(...)</code> değişkenleri kullanılabilir.
                </p>
                {hata && <p className="text-red-300 font-normal">{hata}</p>}
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingTimer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
                >
                  <Check className="w-4 h-4" /> Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Timers;
