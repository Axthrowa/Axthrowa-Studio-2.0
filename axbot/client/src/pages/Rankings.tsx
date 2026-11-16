/**
 * AxBoT Rankings — points / watchtime / messages leaderboards
 * Developed by AxthrowA
 */
import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket.js';

export function Rankings() {
  const [sort, setSort] = useState<'points' | 'watch_time_minutes' | 'messages_count'>('points');
  const [users, setUsers] = useState<any[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  // Puan değişince (oyun, sohbet, yayıncı komutu) tabloyu hemen tazelemek için
  // sohbet akışını dinleriz; ayrıca 5 sn'de bir düzenli yenileme yapılır.
  const { lastMessage } = useWebSocket('dashboard');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(`/api/economy/leaderboard?sort=${sort}`)
        .then(r => r.json())
        .then(d => {
          if (!alive) return;
          setUsers(Array.isArray(d) ? d : []);
          setUpdatedAt(Date.now());
        })
        .catch(() => {});
    };
    load();
    timer.current = window.setInterval(load, 5000);
    return () => {
      alive = false;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [sort]);

  // Sohbet/puan olayı geldiğinde kısa bir gecikmeyle tazele (sunucu yazsın diye).
  useEffect(() => {
    if (!lastMessage) return;
    const id = window.setTimeout(() => {
      fetch(`/api/economy/leaderboard?sort=${sort}`)
        .then(r => r.json())
        .then(d => {
          setUsers(Array.isArray(d) ? d : []);
          setUpdatedAt(Date.now());
        })
        .catch(() => {});
    }, 700);
    return () => window.clearTimeout(id);
  }, [lastMessage, sort]);

  const label = sort === 'points' ? 'Puan' : sort === 'watch_time_minutes' ? 'İzleme (dk)' : 'Mesaj';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2"><Trophy className="w-6 h-6 text-amber-400" /> Sıralamalar</h1>
        <p className="text-sm text-gray-400">
          İzleme süresi, puan ve mesaj sıralamaları. OBS adresi: /widgets/rankings
          {updatedAt > 0 && (
            <span className="ml-2 text-emerald-400">
              · canlı ({new Date(updatedAt).toLocaleTimeString('tr-TR')})
            </span>
          )}
        </p>
      </div>
      <div className="flex gap-1 bg-black/30 p-1 rounded-xl w-fit">
        <button onClick={() => setSort('points')} className={`px-3 py-2 rounded-lg text-xs font-bold ${sort === 'points' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Puan</button>
        <button onClick={() => setSort('watch_time_minutes')} className={`px-3 py-2 rounded-lg text-xs font-bold ${sort === 'watch_time_minutes' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>İzleme süresi</button>
        <button onClick={() => setSort('messages_count')} className={`px-3 py-2 rounded-lg text-xs font-bold ${sort === 'messages_count' ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>Mesaj</button>
      </div>
      <div className="glass-panel rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-xs text-gray-400 uppercase"><tr><th className="p-3">#</th><th className="p-3 text-left">Kullanıcı</th><th className="p-3">{label}</th><th className="p-3">Seviye</th></tr></thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u, i) => (
              <tr key={u.id || u.username}>
                <td className="p-3 text-center font-black text-purple-300">{i + 1}</td>
                <td className="p-3">{u.display_name || u.username}</td>
                <td className="p-3 text-center">{u[sort] ?? 0}</td>
                <td className="p-3 text-center text-xs">{u.loyalty_tier || Math.floor(Math.sqrt((u.points || 0) / 50) + 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Rankings;
