import React, { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { Send, Trash2, User, Smile, Frown, Meh, Save, X, ShieldAlert, Sparkles } from 'lucide-react';
import { PlatformLogo } from '../components/PlatformLogo.js';
import { SohbetAvatari } from '../components/SohbetAvatari.js';
import { PlatformBadges } from '../components/PlatformBadge.js';
import { ChatMessageContent } from '../components/ChatMessageContent.js';
import { yetenekleriGetir, type YetenekHaritasi } from '../lib/capabilities.js';

const KALKAN_ETIKETI: Record<'abone' | 'link' | 'caps' | 'emoji', string> = {
  abone: 'yalnız abone',
  link: 'link',
  caps: 'büyük harf',
  emoji: 'emoji seli'
};

type ElleEylem = 'timeout' | 'ban' | 'unban';

const GECMIS_ACIK = { gecmis: true };

/** Canlı Sohbet ayarı sunucuda durur: uygulama yeniden açılınca ve Studio içinde de korunur */
const PANEL_SOHBET_AYARI = '/api/widgets/panel-sohbet/settings';
const AVATAR_VARSAYILAN = { avatarGoster: true, avatarBoyut: 28, avatarBicim: 'circle' };
const PLATFORM_ADI: Record<string, string> = { kick: 'Kick', twitch: 'Twitch', youtube: 'YouTube', trovo: 'Trovo' };

type TemizlikSonucu = { ok: boolean; yontem?: string; silinen?: number; kalan?: number; hata?: string };

interface ViewerModalData {
  username: string;
  displayName: string;
  platform: string;
  /** Botun kendi mesajı: moderasyon düğmeleri gösterilmez. */
  kendiBotu?: boolean;
  avatarUrl?: string;
  roles?: string[];
  note: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentDetails?: { positives?: number; negatives?: number; messageCount?: number; summary?: string; source?: string; recent?: string[] };
}

// AxthrowA Studio sayfayı `?embed=1` ile gömer (App.tsx ile aynı ölçüt)
const gomulu = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('embed');

export function MultiChat() {
  // 'dashboard': gönderim hataları yalnız bu türe gelir (OBS'teki 'chatbox' katmanı görmesin)
  const { connected, chatMessages, sendChat, clearChat, lastMessage } = useWebSocket('dashboard', GECMIS_ACIK);
  const [filter, setFilter] = useState<'all' | 'kick' | 'twitch' | 'youtube' | 'trovo' | 'tiktok' | 'discord'>('all');
  const [inputMessage, setInputMessage] = useState('');
  const [avatarAyar, setAvatarAyar] = useState(AVATAR_VARSAYILAN);
  useEffect(() => {
    fetch(PANEL_SOHBET_AYARI).then((r) => r.json()).then((d) => setAvatarAyar((a) => ({ ...a, ...d }))).catch(() => {});
  }, []);
  const avatarYaz = (p: Partial<typeof AVATAR_VARSAYILAN>) => {
    setAvatarAyar((a) => ({ ...a, ...p }));
    void fetch(PANEL_SOHBET_AYARI, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }).catch(() => {});
  };
  const [targetPlatform, setTargetPlatform] = useState<string>('all');
  // Temizleme penceresi: null kapalı; platform listesi sunucudan gelir
  const [temizleListe, setTemizleListe] = useState<Array<{ id: string; bagli: boolean }> | null>(null);
  const [temizleSecili, setTemizleSecili] = useState<Record<string, boolean>>({});
  const [temizleniyor, setTemizleniyor] = useState(false);
  const [bildirim, setBildirim] = useState('');
  const [sabit, setSabit] = useState<{ message: string; displayName?: string; display_name?: string; platform?: string } | null>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const altta = useRef(true);

  // Viewer Profile & Notes Modal State
  const [selectedViewer, setSelectedViewer] = useState<ViewerModalData | null>(null);
  const [loadingViewer, setLoadingViewer] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSavedMsg, setNoteSavedMsg] = useState('');
  // Elle moderasyon (4. tur): gerçek platform eylemi; sonuç kartta yazılır
  const [yetenekler, setYetenekler] = useState<YetenekHaritasi>({});
  const [modBusy, setModBusy] = useState<ElleEylem | 'karaliste' | null>(null);
  const [modMesaj, setModMesaj] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void yetenekleriGetir().then(setYetenekler);
  }, []);

  useEffect(() => {
    fetch('/api/pinned').then((r) => r.json()).then((d) => setSabit(d?.message ? d : null)).catch(() => {});
  }, []);

  useEffect(() => {
    if (lastMessage?.type === 'pinned_message' && !String(lastMessage.data?.id || '').startsWith('test-')) setSabit(lastMessage.data || null);
  }, [lastMessage]);

  // Yalnız en alttayken kaydırılır: yukarıdaki iletiyi okurken liste kaçmaz
  useEffect(() => {
    const el = listeRef.current;
    if (el && altta.current) el.scrollTop = el.scrollHeight;
  }, [chatMessages, filter]);

  const bildir = (metin: string) => {
    setBildirim(metin);
    setTimeout(() => setBildirim(''), 7000);
  };

  const mesajiSabitle = async (msg: any) => {
    const res = await fetch('/api/pinned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: msg.platform,
        username: msg.user.username,
        displayName: msg.user.displayName || msg.user.username,
        message: msg.message,
        color: msg.user.color
      })
    }).catch(() => null);
    bildir(res?.ok ? "Mesaj sabitlendi: OBS'te ve burada görünüyor." : 'Mesaj sabitlenemedi.');
  };

  const sabitiKaldir = async () => {
    await fetch('/api/pinned', { method: 'DELETE' }).catch(() => {});
    setSabit(null);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !connected) return;
    sendChat(targetPlatform, inputMessage.trim());
    setInputMessage('');
  };

  const temizlemeyiAc = async () => {
    setTemizleSecili({});
    try {
      const d = await (await fetch('/api/chat/clear-platforms')).json();
      setTemizleListe(d.platformlar || []);
    } catch {
      setTemizleListe([]);
    }
  };

  const seciliPlatformlar = (temizleListe || []).filter((p) => p.bagli && temizleSecili[p.id]).map((p) => p.id);

  const platformlardaTemizle = async () => {
    setTemizleniyor(true);
    try {
      const res = await fetch('/api/chat/clear-platforms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: seciliPlatformlar })
      });
      const d = await res.json();
      const sonuclar = Object.entries((d.sonuclar || {}) as Record<string, TemizlikSonucu>).map(([p, s]) =>
        s.ok ? `${PLATFORM_ADI[p] || p}: ${s.yontem === 'tek-tek' ? `${s.silinen} ileti silindi${s.kalan ? `, ${s.kalan} ileti kaldı` : ''}` : 'temizlendi'}` : `${PLATFORM_ADI[p] || p}: ${s.hata || 'temizlenemedi'}`
      );
      bildir(sonuclar.join(' · ') || d.hata || 'Sonuç alınamadı.');
    } catch {
      bildir('Sunucuya ulaşılamadı.');
    } finally {
      setTemizleniyor(false);
      setTemizleListe(null);
    }
  };

  const handleUserClick = async (user: any, platform: string) => {
    const username = user.username || user.displayName;
    setSelectedViewer({
      username,
      displayName: user.displayName || username,
      platform,
      kendiBotu: user.id === 'streamaxt_bot' || user.isSelf === true,
      avatarUrl: user.avatarUrl,
      roles: user.roles || [],
      note: '',
      sentiment: 'neutral'
    });
    setLoadingViewer(true);
    setNoteSavedMsg('');
    setModMesaj(null);

    try {
      const ad = encodeURIComponent(username);
      const [notesRes, sentimentRes] = await Promise.all([
        fetch(`/api/viewers/${ad}/notes`).then(r => r.json()),
        fetch(`/api/viewers/${ad}/sentiment`).then(r => r.json())
      ]);

      const note = notesRes?.note || '';
      const sentiment = sentimentRes?.sentiment || 'neutral';

      setNoteText(note);
      setSelectedViewer(prev => prev ? {
        ...prev,
        note,
        sentiment,
        sentimentDetails: sentimentRes
      } : null);
    } catch {} finally {
      setLoadingViewer(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedViewer) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/viewers/${encodeURIComponent(selectedViewer.username)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText })
      });
      if (res.ok) {
        setNoteSavedMsg('✅ Yayıncı notu kaydedildi!');
        setTimeout(() => setNoteSavedMsg(''), 3000);
      }
    } catch {} finally {
      setSavingNote(false);
    }
  };

  // Kara liste kaydı yalnız BU platform için tutulur: başka platformdaki aynı
  // adlı (büyük olasılıkla başka) kişi etkilenmesin.
  const handleAddToSharedBan = async () => {
    if (!selectedViewer) return;
    const { username, platform } = selectedViewer;
    if (!confirm(`@${username} (${platform}) ortak kara listeye eklensin mi?\nBot bu kişiyi yok sayar, mesajları OBS sohbetinde gösterilmez; Kalkan ekranındaki kara liste eylemi uygulanır.`)) return;
    setModBusy('karaliste');
    try {
      const res = await fetch('/api/moderation/shared-bans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, platform, reason: 'Sohbetten moderatör kararı', addedBy: 'Yayıncı' })
      });
      setModMesaj(res.ok ? { ok: true, text: `@${username} kara listeye eklendi (${platform}).` } : { ok: false, text: `Eklenemedi (HTTP ${res.status})` });
    } catch {
      setModMesaj({ ok: false, text: 'Sunucuya ulaşılamadı' });
    } finally {
      setModBusy(null);
    }
  };

  const moderasyonYap = async (eylem: ElleEylem) => {
    if (!selectedViewer) return;
    const { username, platform } = selectedViewer;
    if (eylem === 'ban' && !confirm(`@${username} ${platform} platformunda KALICI olarak banlanacak. Emin misiniz?`)) return;
    setModBusy(eylem);
    setModMesaj(null);
    try {
      const res = await fetch(`/api/moderation/${eylem}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, username, saniye: 600, sebep: 'Panelden moderatör kararı' })
      });
      const d = await res.json().catch(() => ({}));
      const ne = eylem === 'timeout' ? '10 dakika susturuldu' : eylem === 'ban' ? 'kalıcı olarak banlandı' : 'banı kaldırıldı';
      setModMesaj(d?.ok ? { ok: true, text: `@${username} ${ne}.` } : { ok: false, text: d?.hata || `HTTP ${res.status}` });
    } catch {
      setModMesaj({ ok: false, text: 'Sunucuya ulaşılamadı' });
    } finally {
      setModBusy(null);
    }
  };

  /** Platform eylemi desteklemiyorsa düğme kapalı, sebebi ipucunda. */
  const destek = (eylem: ElleEylem): string | null => {
    const y = selectedViewer ? yetenekler[selectedViewer.platform] : undefined;
    if (!y) return null; // yetenek listesi gelmediyse sunucu karar versin
    const var_ = eylem === 'timeout' ? y.moderasyon.timeout : y.moderasyon.ban;
    return var_ ? null : `${selectedViewer?.platform} bu eylemi desteklemiyor`;
  };

  const filteredMessages = chatMessages.filter(m =>
    filter === 'all' ? true : m.platform === filter
  );

  const getBadge = (platform: string) => {
    return <PlatformLogo platform={platform} size={13} variant="badge" showLabel={false} />;
  };

  const getUserColor = (username: string, customColor?: string) => {
    if (customColor) return customColor;
    const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f97316'];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    // Studio'da gömülüyken (dar yan sütun) başlık gizlenir, araçlar sarar, yükseklik iframe'i doldurur
    <div className={`flex flex-col relative ${gomulu ? 'space-y-2 h-[calc(100vh-2rem)]' : 'space-y-4 h-[calc(100vh-140px)]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={gomulu ? 'hidden' : undefined}>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            Birleşik Canlı Sohbet (Multi-Chat Dock)
          </h1>
          <p className="text-xs text-gray-400">
            Kick, Twitch, YouTube, Trovo, Discord ve TikTok yayın sohbetlerinizi tek ekranda toplayın ve yönetin.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* One-Click Clear Chat Button */}
          <button
            onClick={() => void temizlemeyiAc()}
            className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm cursor-pointer bg-white/5 hover:bg-red-500/20 border-white/10 hover:border-red-500/30 text-gray-300 hover:text-red-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Sohbeti Temizle</span>
          </button>

          <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 px-2 py-1 rounded-xl text-[11px] text-gray-200">
            <label className="flex items-center gap-1.5 cursor-pointer font-bold">
              <input type="checkbox" checked={avatarAyar.avatarGoster} onChange={(e) => avatarYaz({ avatarGoster: e.target.checked })} />
              Avatarlar
            </label>
            {avatarAyar.avatarGoster && (
              <>
                <select aria-label="Avatar boyutu" value={avatarAyar.avatarBoyut} onChange={(e) => avatarYaz({ avatarBoyut: Number(e.target.value) })} className="bg-black/60 border border-white/10 rounded-lg px-1 py-0.5 text-white">
                  <option value={20}>Küçük</option>
                  <option value={28}>Orta</option>
                  <option value={40}>Büyük</option>
                </select>
                <select aria-label="Avatar biçimi" value={avatarAyar.avatarBicim} onChange={(e) => avatarYaz({ avatarBicim: e.target.value })} className="bg-black/60 border border-white/10 rounded-lg px-1 py-0.5 text-white">
                  <option value="circle">Daire</option>
                  <option value="rounded">Yuvarlak köşe</option>
                  <option value="square">Kare</option>
                </select>
              </>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-black/40 border border-white/10 p-1 rounded-xl text-xs font-bold">
            {(['all', 'kick', 'twitch', 'youtube', 'trovo', 'tiktok', 'discord'] as const).map(p => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={`px-2.5 py-1 rounded-lg uppercase text-[11px] transition-all flex items-center gap-1.5 cursor-pointer ${
                  filter === p
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {p !== 'all' && <PlatformLogo platform={p} size={12} />}
                <span>{p === 'all' ? 'tümü' : p}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {bildirim && <div className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-gray-200">{bildirim}</div>}

      {sabit && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-purple-500/30 bg-purple-500/10 text-sm">
          <span aria-hidden>📌</span>
          <b className="text-white shrink-0">{sabit.displayName || sabit.display_name}:</b>
          <span className="text-gray-200 truncate">{sabit.message}</span>
          <button onClick={() => void sabitiKaldir()} className="ml-auto shrink-0 text-xs font-bold text-gray-300 hover:text-white cursor-pointer">Kaldır</button>
        </div>
      )}

      {/* Chat Messages Box */}
      <div className="flex-1 min-h-0 glass-panel p-4 rounded-2xl border border-white/10 flex flex-col">
        <div
          ref={listeRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            altta.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
          }}
          className="flex-1 min-h-0 space-y-2 overflow-y-auto"
        >
          {filteredMessages.length === 0 ? (
            <div className="text-center py-24 text-gray-500 text-sm">
              Sohbet akışı bekleniyor... Yayın başladığında veya platformlar bağlandığında tüm mesajlar anlık olarak burada akacaktır.
            </div>
          ) : (
            filteredMessages.map(msg => (
              <div
                key={msg.id}
                className={`p-2.5 rounded-xl hover:bg-white/[0.05] transition-all flex items-center space-x-2.5 text-sm ${
                  msg.karaListede || msg.kalkanda ? 'bg-red-500/[0.06] opacity-60' : 'bg-white/[0.02]'
                }`}
                // Görünmeyen satırlar çizilmez: 500 iletide liste akıcı kalsın
                style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 64px' }}
                title={
                  msg.karaListede
                    ? 'Ortak kara listede: bot yok sayar, OBS sohbetinde gösterilmez'
                    : msg.kalkanda
                      ? `Kalkan kuralına takıldı (${KALKAN_ETIKETI[msg.kalkanda]}): bot yok sayar, OBS sohbetinde gösterilmez`
                      : undefined
                }
              >
                {avatarAyar.avatarGoster && (
                  <SohbetAvatari
                    platform={msg.platform}
                    kullanici={msg.user.username}
                    ad={msg.user.displayName || msg.user.username}
                    url={msg.user.avatarUrl}
                    boyut={avatarAyar.avatarBoyut}
                    bicim={avatarAyar.avatarBicim}
                    renk={getUserColor(msg.user.username, msg.user.color)}
                    className="self-center"
                    onClick={() => handleUserClick(msg.user, msg.platform)}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 mb-1">
                    {getBadge(msg.platform)}
                    <PlatformBadges platform={msg.platform} user={msg.user} size={16} />
                    <button
                      onClick={() => handleUserClick(msg.user, msg.platform)}
                      className="font-bold text-xs hover:underline cursor-pointer"
                      style={{ color: getUserColor(msg.user.username, msg.user.color) }}
                    >
                      {msg.user.displayName || msg.user.username}:
                    </button>
                    {msg.karaListede && (
                      <span className="text-[9px] font-bold uppercase text-red-300 bg-red-500/15 border border-red-500/30 rounded px-1.5 py-0.5">
                        kara liste
                      </span>
                    )}
                    {msg.kalkanda && (
                      <span className="text-[9px] font-bold uppercase text-amber-200 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5">
                        kalkan · {KALKAN_ETIKETI[msg.kalkanda]}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-500">
                      {new Date(msg.timestamp).toLocaleTimeString('tr-TR')}
                    </span>
                    {/* OBS "Sabitlenmiş Mesajlar" widget'ına gönder (eskiden panelde bunu yapan bir düğme yoktu) */}
                    <button
                      type="button"
                      title="Sabitle (OBS'te ve burada görünür)"
                      onClick={() => void mesajiSabitle(msg)}
                      className="text-[11px] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      📌
                    </button>
                  </div>

                  <div className="text-gray-200 text-sm font-medium break-words leading-relaxed">
                    <ChatMessageContent message={msg.message} platform={msg.platform} size={22} twitchEmotes={msg.emotes} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Input Sender Bar */}
      <form onSubmit={handleSend} className="glass-panel p-2.5 rounded-2xl flex items-center gap-2 border border-white/10">
        <select aria-label="Mesajın gideceği platform"
          value={targetPlatform}
          onChange={e => setTargetPlatform(e.target.value)}
          className="min-w-0 max-w-[45%] shrink bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-purple-300 focus:outline-none"
        >
          <option value="all">Tüm Platformlara Gönder</option>
          <option value="kick">Sadece Kick</option>
          <option value="twitch">Sadece Twitch</option>
          <option value="youtube">Sadece YouTube</option>
          <option value="trovo">Sadece Trovo</option>
          <option value="discord">Sadece Discord</option>
        </select>

        <input
          type="text"
          value={inputMessage}
          onChange={e => setInputMessage(e.target.value)}
          placeholder={connected ? 'Yayın sohbetine bir mesaj yazın...' : 'Bot bağlantısı yok, yeniden bağlanıyor...'}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white focus:outline-none placeholder-gray-500"
        />

        <button
          type="submit"
          disabled={!connected}
          className="shrink-0 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" /> Gönder
        </button>
      </form>

      {/* Sohbeti nerede temizlemeli? */}
      {temizleListe && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-sm w-full p-5 space-y-3">
            <h3 className="text-base font-bold text-white">Sohbet nerede temizlensin?</h3>
            <p className="text-xs text-gray-400">Seçilen platformda sohbet herkes için temizlenir.</p>
            <div className="space-y-1">
              {temizleListe.map((p) => (
                <label key={p.id} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm ${p.bagli ? 'text-white cursor-pointer hover:bg-white/5' : 'text-gray-500'}`}>
                  <input
                    type="checkbox"
                    disabled={!p.bagli}
                    checked={!!temizleSecili[p.id]}
                    onChange={(e) => setTemizleSecili((s) => ({ ...s, [p.id]: e.target.checked }))}
                  />
                  <PlatformLogo platform={p.id} size={14} />
                  {PLATFORM_ADI[p.id] || p.id}
                  {!p.bagli && <span className="ml-auto text-[11px]">bağlı değil</span>}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  clearChat();
                  setTemizleListe(null);
                }}
                className="mr-auto text-xs font-bold text-gray-300 hover:text-white cursor-pointer"
              >
                Yalnız bu ekran ve OBS
              </button>
              <button onClick={() => setTemizleListe(null)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-300 hover:text-white cursor-pointer">Vazgeç</button>
              <button
                disabled={temizleniyor || !seciliPlatformlar.length}
                onClick={() => void platformlardaTemizle()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                {temizleniyor ? 'Temizleniyor…' : 'Temizle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer Profile & Streamer Notes Modal */}
      {selectedViewer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setSelectedViewer(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Viewer Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              {selectedViewer.avatarUrl ? (
                <img
                  src={selectedViewer.avatarUrl}
                  alt=""
                  className="w-12 h-12 rounded-full border-2 border-purple-500 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-purple-600/30 border border-purple-500 flex items-center justify-center text-purple-300">
                  <User className="w-6 h-6" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{selectedViewer.displayName}</h3>
                  <PlatformLogo platform={selectedViewer.platform} size={14} />
                </div>
                <div className="text-xs text-gray-400">@{selectedViewer.username}</div>
              </div>
            </div>

            {/* AI Sentiment Analysis Badge */}
            <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Yapay Zeka Duygudurum Analizi
                </span>

                {selectedViewer.sentiment === 'positive' && (
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/30">
                    <Smile className="w-3.5 h-3.5" /> Pozitif & Dostça
                  </span>
                )}
                {selectedViewer.sentiment === 'neutral' && (
                  <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-500/30">
                    <Meh className="w-3.5 h-3.5" /> Nötr / Normal
                  </span>
                )}
                {selectedViewer.sentiment === 'negative' && (
                  <span className="bg-red-500/20 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-500/30 animate-pulse">
                    <Frown className="w-3.5 h-3.5" /> Riskli / Toksik
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                {loadingViewer ? 'Mesajlar inceleniyor…' : selectedViewer.sentimentDetails?.summary ||
                  (selectedViewer.sentiment === 'positive'
                    ? 'İzleyici son mesajlarında yayıncıyı öven, pozitif bir ton kullandı.'
                    : selectedViewer.sentiment === 'negative'
                      ? 'Son mesajlarında sert/öfkeli bir ton var, dikkatli olun.'
                      : 'İzleyicinin genel sohbet tonu dengeli ve sakin.')}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span>
                  {selectedViewer.sentimentDetails?.messageCount ?? 0} mesaj incelendi
                </span>
                {selectedViewer.sentimentDetails?.source === 'ai' && (
                  <span className="text-purple-300">· Gemini ile bağlamlı analiz</span>
                )}
                {selectedViewer.sentimentDetails?.source === 'kelime' && (
                  <span className="text-amber-300/80">· kelime tabanlı (Gemini anahtarı yok)</span>
                )}
              </div>
              {!!selectedViewer.sentimentDetails?.recent?.length && (
                <details className="pt-1">
                  <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-300">
                    İncelenen son mesajlar
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {selectedViewer.sentimentDetails.recent.map((m: string, i: number) => (
                      <li key={i} className="text-[10px] text-gray-400 truncate">· {m}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {/* Private Streamer Note */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-300">
                🔒 Gizli Yayıncı Notu (Sadece Siz Görebilirsiniz):
              </label>
              <textarea aria-label="Gizli Yayıncı Notu (Sadece Siz Görebilirsiniz)"
                rows={3}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Bu izleyici hakkında hatırlatıcı notlar yazın (Örn: Eski moderatör, Valorant sever)..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            {noteSavedMsg && (
              <div className="text-xs text-emerald-400 font-semibold">{noteSavedMsg}</div>
            )}

            {/* Moderasyon — GERÇEK platform eylemi, yalnız bu platformda */}
            {!selectedViewer.kendiBotu && (
            <div className="space-y-2 p-3 bg-slate-950/70 rounded-xl border border-slate-800">
              <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                Moderasyon ({selectedViewer.platform})
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  ['timeout', '10 dk sustur'],
                  ['ban', 'Kalıcı banla'],
                  ['unban', 'Banı kaldır']
                ] as Array<[ElleEylem, string]>).map(([eylem, etiket]) => {
                  const sebep = destek(eylem);
                  return (
                    <button
                      key={eylem}
                      type="button"
                      onClick={() => void moderasyonYap(eylem)}
                      disabled={!!sebep || modBusy !== null}
                      title={sebep || undefined}
                      className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        eylem === 'ban'
                          ? 'bg-red-600/20 border-red-500/40 text-red-200 hover:bg-red-600/30'
                          : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                      }`}
                    >
                      {modBusy === eylem ? '…' : etiket}
                    </button>
                  );
                })}
              </div>
              {modMesaj && (
                <div className={`text-[11px] font-semibold ${modMesaj.ok ? 'text-emerald-400' : 'text-red-300'}`}>
                  {modMesaj.ok ? '✅ ' : '⚠️ '}
                  {modMesaj.text}
                </div>
              )}
            </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              {selectedViewer.kendiBotu ? (
                <span />
              ) : (
                <button
                  onClick={handleAddToSharedBan}
                  disabled={modBusy !== null}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer disabled:opacity-50"
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> Kara Listeye Ekle
                </button>
              )}

              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md shadow-purple-600/30"
              >
                <Save className="w-3.5 h-3.5" />
                {savingNote ? 'Kaydediliyor...' : 'Notu Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiChat;
