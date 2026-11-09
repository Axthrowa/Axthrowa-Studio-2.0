import { kokOzellik } from '../lib/kabuklar.js';
import { ortakHareket } from '../lib/animations.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { useState, useEffect, useRef } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { TRIVIA_DEFAULTS } from '../lib/widget-defaults.js';
import { wsAdresi } from '../lib/widget-style.js';
import {
  Trophy,
  Clock,
  Sparkles,
  CheckCircle2,
  XCircle,
  Zap,
  Flame,
  Lightbulb,
  Compass,
  Gamepad2,
  Film,
  Atom,
  BookOpen,
  HelpCircle,
  Users,
  Activity,
  HeartPulse,
  Languages,
  Newspaper,
  TrendingUp,
  Utensils,
  Cpu,
  Award,
  History,
  Calculator,
  PenTool,
  Quote
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TriviaOptionDist {
  count: number;
  percent: number;
}

interface TriviaState {
  status: 'idle' | 'question_active' | 'revealing_answer' | 'round_ended' | 'podium';
  mode: 'single' | 'tournament';
  durationSeconds: number;
  remainingSeconds: number;
  progressPercent: number;
  question: {
    id: string;
    category: string;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    points: number;
    difficulty: string;
    correctOption: 'A' | 'B' | 'C' | 'D' | null;
    explanation: string | null;
  } | null;
  tournament: {
    currentIndex: number;
    totalQuestions: number;
    category: string;
    leaderboard: Array<{
      username: string;
      displayName: string;
      platform: string;
      score: number;
      correctAnswers: number;
      fastestMs: number;
    }>;
  } | null;
  votes: {
    total: number;
    distribution: {
      A: TriviaOptionDist;
      B: TriviaOptionDist;
      C: TriviaOptionDist;
      D: TriviaOptionDist;
      total: number;
    };
  };
  lastWinners: Array<{
    username: string;
    displayName: string;
    platform: string;
    answerMs: number;
    earnedPoints: number;
    streak: number;
  }>;
}

const SAMPLE_QUESTION: TriviaState = {
  status: 'question_active',
  mode: 'tournament',
  durationSeconds: 20,
  remainingSeconds: 14,
  progressPercent: 70,
  question: {
    id: 'sample-1',
    category: 'Coğrafya',
    question: "Türkiye'nin yüzölçümü bakımından en büyük tatlı su gölü hangisidir?",
    optionA: 'Van Gölü',
    optionB: 'Beyşehir Gölü',
    optionC: 'Tuz Gölü',
    optionD: 'Eğirdir Gölü',
    points: 120,
    difficulty: 'medium',
    correctOption: null,
    explanation: "Van Gölü sodalıdır. Türkiye'nin en büyük tatlı su gölü Beyşehir Gölü'dür."
  },
  tournament: {
    currentIndex: 3,
    totalQuestions: 5,
    category: 'Coğrafya',
    leaderboard: [
      { username: 'ahmet', displayName: 'Ahmet', platform: 'kick', score: 380, correctAnswers: 2, fastestMs: 1800 },
      { username: 'ayse', displayName: 'Ayşe', platform: 'twitch', score: 310, correctAnswers: 2, fastestMs: 2400 },
      { username: 'can', displayName: 'Can', platform: 'youtube', score: 190, correctAnswers: 1, fastestMs: 3100 }
    ]
  },
  votes: {
    total: 18,
    distribution: {
      A: { count: 4, percent: 22 },
      B: { count: 11, percent: 61 },
      C: { count: 2, percent: 11 },
      D: { count: 1, percent: 6 },
      total: 18
    }
  },
  lastWinners: []
};

/** Hex renk + opaklık → rgba(). Ayar formu `<input type="color">` kullandığı
 * için renkler HEX tutulur; saydamlık ayrı alanda gelir. */
function rgbaYap(hex: string, opaklik: number | string | undefined): string {
  const h = String(hex || '#000000').replace('#', '');
  const t = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(t.slice(0, 2), 16) || 0;
  const g = parseInt(t.slice(2, 4), 16) || 0;
  const b = parseInt(t.slice(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(1, Number(opaklik ?? 1)));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export interface TriviaWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

export function TriviaWidget({ embedded = false, previewMode = false }: TriviaWidgetProps) {
  // `?preview=1` de tam önizleme sayılır: yoksa sunucudan gelen BOŞ durum örnek
  // soruyu eziyor, katman bomboş görünüyordu (OBS kurarken hiçbir şey çıkmıyor).
  const onizleme =
    previewMode ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1');
  // Panelden ayarlanabilir görünüm (renk, genişlik, kontur, ses).
  const ayar = useWidgetSettings('trivia', TRIVIA_DEFAULTS);
  const [state, setState] = useState<TriviaState | null>(previewMode ? SAMPLE_QUESTION : null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Check URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('sound') === '0' || params.get('mute') === '1') {
      setSoundEnabled(false);
    }
    if (params.get('preview') === '1') {
      setState(SAMPLE_QUESTION);
    }
  }, []);

  // Web Audio Sound FX Synthesizer
  const playSound = (type: 'tick' | 'urgent_tick' | 'correct' | 'reveal' | 'podium') => {
    if (!soundEnabled || ayar.soundEnabled === false) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'urgent_tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(950, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'correct' || type === 'reveal') {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.15, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.35);
        });
      } else if (type === 'podium') {
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
          gain.gain.setValueAtTime(0.2, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.6);
        });
      }
    } catch {}
  };

  // WebSocket Connection
  useEffect(() => {
    if (onizleme) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      const wsUrl = wsAdresi('trivia');

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          // Fetch initial state via REST
          fetch('/api/trivia/state')
            .then(r => r.json())
            .then(d => {
              if (d) setState(d);
            })
            .catch(() => {});
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'trivia_state' || msg.type === 'trivia_question_start') {
              setState(msg.data);
              if (msg.type === 'trivia_question_start') {
                playSound('tick');
              }
            } else if (msg.type === 'trivia_tick') {
              setState(prev => {
                if (!prev) return null;
                const rem = msg.data.remainingSeconds;
                if (rem <= 5 && rem > 0) {
                  playSound('urgent_tick');
                } else if (rem > 5) {
                  playSound('tick');
                }
                return {
                  ...prev,
                  remainingSeconds: rem,
                  durationSeconds: msg.data.durationSeconds,
                  progressPercent: msg.data.progressPercent
                };
              });
            } else if (msg.type === 'trivia_vote_update') {
              setState(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  votes: {
                    total: msg.data.distribution.total,
                    distribution: msg.data.distribution
                  }
                };
              });
            } else if (msg.type === 'trivia_answer_reveal') {
              setState(msg.data);
              playSound('reveal');
              confetti({
                particleCount: 50,
                spread: 70,
                origin: { y: 0.7 }
              });
            } else if (msg.type === 'trivia_podium') {
              setState(prev => prev ? { ...prev, status: 'podium' } : null);
              playSound('podium');
              confetti({
                particleCount: 100,
                spread: 100,
                origin: { y: 0.6 }
              });
            }
          } catch {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connect, 2500);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        reconnectTimeout = setTimeout(connect, 2500);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [onizleme]);

  // Initial fetch
  useEffect(() => {
    if (!onizleme) {
      fetch('/api/trivia/state')
        .then(r => r.json())
        .then(d => {
          if (d) setState(d);
        })
        .catch(() => {});
    }
  }, [onizleme]);

  // Görünürlük: soru açılınca belirir; doğru cevap gösterildikten `hideDelaySec`
  // (kürsüden `podiumHideSec`) saniye sonra kaybolur, yeni soruyla yeniden gelir.
  const [gizli, setGizli] = useState(false);
  const durumAnahtari = state ? `${state.status}:${state.question?.id ?? state.question?.question ?? ''}` : '';
  useEffect(() => {
    if (!state || onizleme) return;
    if (state.status === 'question_active') {
      setGizli(false);
      return;
    }
    const bitti = state.status === 'revealing_answer' || state.status === 'round_ended' || state.status === 'podium';
    if (!bitti) return;
    setGizli(false);
    const sn = state.status === 'podium' ? Number(ayar.podiumHideSec) : Number(ayar.hideDelaySec);
    if (!(sn > 0)) return; // 0 = kendiliğinden kaybolma
    const t = setTimeout(() => setGizli(true), sn * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durumAnahtari, ayar.hideDelaySec, ayar.podiumHideSec, onizleme]);

  if (!state || (state.status === 'idle' && !previewMode) || (gizli && !onizleme)) {
    return null;
  }

  const { question, remainingSeconds, durationSeconds, progressPercent, status, votes, lastWinners, tournament } = state;
  const isRevealing = status === 'revealing_answer';
  const isPodium = status === 'podium';

  // Category styles & icons
  const getCategoryDetails = (cat: string = 'Genel Kültür') => {
    switch (cat) {
      case 'Genel Kültür':
        return { icon: Lightbulb, color: 'from-amber-500 to-yellow-600', text: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' };
      case 'Bilgi':
      case 'Bilim':
        return { icon: Atom, color: 'from-cyan-500 to-blue-600', text: 'text-cyan-400', border: 'border-cyan-500/40', bg: 'bg-cyan-500/10' };
      case 'Oyun':
      case 'Oyunlar':
        return { icon: Gamepad2, color: 'from-purple-500 to-indigo-600', text: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/10' };
      case 'Film ve Dizi':
      case 'Sinema TV':
        return { icon: Film, color: 'from-rose-500 to-pink-600', text: 'text-rose-400', border: 'border-rose-500/40', bg: 'bg-rose-500/10' };
      case 'Coğrafya':
        return { icon: Compass, color: 'from-emerald-500 to-teal-600', text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' };
      case 'Tarih':
        return { icon: BookOpen, color: 'from-orange-500 to-amber-700', text: 'text-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-500/10' };
      case 'Osmanlı Tarihi':
        return { icon: BookOpen, color: 'from-yellow-600 to-amber-800', text: 'text-amber-300', border: 'border-amber-500/40', bg: 'bg-amber-500/10' };
      case 'Spor':
        return { icon: Trophy, color: 'from-green-500 to-emerald-600', text: 'text-green-400', border: 'border-green-500/40', bg: 'bg-green-500/10' };
      case 'Basketbol':
        return { icon: Activity, color: 'from-orange-500 to-red-600', text: 'text-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-500/10' };
      case 'Sanat':
        return { icon: Sparkles, color: 'from-fuchsia-500 to-pink-600', text: 'text-fuchsia-400', border: 'border-fuchsia-500/40', bg: 'bg-fuchsia-500/10' };
      case 'Tıbbi Terimler':
        return { icon: HeartPulse, color: 'from-red-500 to-rose-600', text: 'text-red-400', border: 'border-red-500/40', bg: 'bg-red-500/10' };
      case 'Azerbaycan Türkçesi':
        return { icon: Languages, color: 'from-sky-500 to-cyan-600', text: 'text-sky-400', border: 'border-sky-500/40', bg: 'bg-sky-500/10' };
      case 'Gündem 2000/26':
        return { icon: Newspaper, color: 'from-violet-500 to-purple-600', text: 'text-violet-400', border: 'border-violet-500/40', bg: 'bg-violet-500/10' };
      case 'Ekonomi':
        return { icon: TrendingUp, color: 'from-emerald-500 to-green-600', text: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' };
      case 'Türk Mutfağı':
        return { icon: Utensils, color: 'from-amber-600 to-orange-600', text: 'text-amber-400', border: 'border-amber-500/40', bg: 'bg-amber-500/10' };
      case 'Teknoloji':
        return { icon: Cpu, color: 'from-blue-500 to-indigo-600', text: 'text-blue-400', border: 'border-blue-500/40', bg: 'bg-blue-500/10' };
      case 'İz Bırakanlar':
        return { icon: Award, color: 'from-yellow-400 to-amber-600', text: 'text-yellow-400', border: 'border-yellow-500/40', bg: 'bg-yellow-500/10' };
      case 'Geçmişten Günümüze':
        return { icon: History, color: 'from-zinc-400 to-slate-600', text: 'text-zinc-300', border: 'border-zinc-500/40', bg: 'bg-zinc-500/10' };
      case '4 İşlem':
        return { icon: Calculator, color: 'from-indigo-500 to-purple-600', text: 'text-indigo-400', border: 'border-indigo-500/40', bg: 'bg-indigo-500/10' };
      case 'Yazım Yanlışları':
        return { icon: PenTool, color: 'from-teal-500 to-emerald-600', text: 'text-teal-400', border: 'border-teal-500/40', bg: 'bg-teal-500/10' };
      case 'Söz ve Deyiş':
        return { icon: Quote, color: 'from-pink-500 to-purple-600', text: 'text-pink-400', border: 'border-pink-500/40', bg: 'bg-pink-500/10' };
      default:
        return { icon: HelpCircle, color: 'from-blue-500 to-indigo-600', text: 'text-blue-400', border: 'border-blue-500/40', bg: 'bg-blue-500/10' };
    }
  };

  const catMeta = getCategoryDetails(question?.category);
  const CatIcon = catMeta.icon;

  // Timer Color calculation
  const getTimerColor = (sec: number, max: number) => {
    const ratio = max > 0 ? sec / max : 0;
    if (ratio > 0.45) return 'from-emerald-400 to-teal-500 text-emerald-400';
    if (ratio > 0.20) return 'from-amber-400 to-yellow-500 text-amber-400';
    return 'from-rose-500 to-red-600 text-rose-500 animate-pulse';
  };

  const timerColor = getTimerColor(remainingSeconds, durationSeconds);

  // Options Array
  const optionsList: Array<{ letter: 'A' | 'B' | 'C' | 'D'; text: string }> = question ? [
    { letter: 'A', text: question.optionA },
    { letter: 'B', text: question.optionB },
    { letter: 'C', text: question.optionC },
    { letter: 'D', text: question.optionD }
  ] : [];

  return (
    // Kart dikeyde ORTALANMIYOR: cevap açılınca yükseklik artıyordu ve kutu hem
    // yukarı hem aşağı büyüyüp OBS'te yerinden oynuyordu. Üste hizalı duruyor,
    // büyüme yalnız aşağı doğru oluyor.
    <div className={embedded ? "w-full h-full bg-transparent p-0 flex items-start justify-center select-none font-sans" : "w-screen h-screen bg-transparent p-6 flex items-start justify-center select-none font-sans"}>
      <div {...kokOzellik(ayar)}
        className="w-full backdrop-blur-2xl border-2 overflow-hidden relative transition-all duration-300 p-5 md:p-6"
        style={{
          maxWidth: Number(ayar.maxWidth) || 672,
          background: rgbaYap(ayar.cardColor, ayar.cardOpacity),
          borderColor: rgbaYap(ayar.borderColor, ayar.borderOpacity),
          borderRadius: Number(ayar.radius) || 24,
          boxShadow: `0 20px 60px ${rgbaYap(ayar.shadowColor, ayar.shadowOpacity)}`,
          ...kutuTasarimi(ayar), ...ortakHareket(ayar)
        }}
      >
        
        {/* Glow Effects in Background */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* 1. TOURNAMENT PODIUM CELEBRATION MODAL */}
        {isPodium ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-5 axt-anim-zoom">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Trophy className="w-10 h-10 text-white animate-bounce" />
              </div>
              <Sparkles className="w-6 h-6 text-yellow-300 absolute -top-2 -right-2 animate-spin" />
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-amber-400 font-black">
                BİL BAKALIM ŞAMPİYONLARI
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white mt-1">
                Tebrikler Yarışmacılar!
              </h1>
            </div>

            {/* Podium Ranks */}
            <div className="w-full grid grid-cols-3 gap-3 pt-3">
              {/* 2nd Place */}
              {tournament?.leaderboard[1] && (
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-end mt-4">
                  <span className="text-2xl">🥈</span>
                  <div className="font-extrabold text-sm text-gray-200 mt-1 truncate max-w-full">
                    {tournament.leaderboard[1].displayName}
                  </div>
                  <div className="text-xs font-mono font-bold text-gray-400">
                    {tournament.leaderboard[1].score} Puan
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1">2. Sıra</span>
                </div>
              )}

              {/* 1st Place (Champion) */}
              {tournament?.leaderboard[0] && (
                <div className="bg-gradient-to-b from-amber-500/20 to-yellow-600/10 border-2 border-amber-400/50 rounded-2xl p-4 flex flex-col items-center justify-end shadow-lg shadow-amber-500/20">
                  <span className="text-4xl animate-bounce">🥇</span>
                  <div className="font-black text-base text-amber-300 mt-1 truncate max-w-full">
                    {tournament.leaderboard[0].displayName}
                  </div>
                  <div className="text-sm font-mono font-extrabold text-white">
                    {tournament.leaderboard[0].score} Puan
                  </div>
                  <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-bold mt-1">
                    BÜYÜK ŞAMPİYON
                  </span>
                </div>
              )}

              {/* 3rd Place */}
              {tournament?.leaderboard[2] && (
                <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-end mt-6">
                  <span className="text-2xl">🥉</span>
                  <div className="font-extrabold text-sm text-gray-200 mt-1 truncate max-w-full">
                    {tournament.leaderboard[2].displayName}
                  </div>
                  <div className="text-xs font-mono font-bold text-gray-400">
                    {tournament.leaderboard[2].score} Puan
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1">3. Sıra</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 2. HEADER: Category Badge, Round Indicator & Points */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
              {/* Category Pill */}
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${catMeta.color} flex items-center justify-center shadow-md`}>
                  <CatIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-black uppercase tracking-wider ${catMeta.text}`}>
                      {question?.category}
                    </span>
                    {tournament && (
                      <span className="text-[10px] font-bold bg-white/10 text-gray-300 px-2 py-0.5 rounded-full">
                        {tournament.currentIndex} / {tournament.totalQuestions}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 font-semibold">
                    BİL BAKALIM CANLI
                  </div>
                </div>
              </div>

              {/* Points & Timer Display */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-1.5 bg-white/[0.05] border border-white/10 px-3 py-1.5 rounded-xl">
                  <Zap className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs font-mono font-black text-white">
                    +{question?.points || 100} PUAN
                  </span>
                </div>

                {/* Circular or Digital Countdown */}
                <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 px-3 py-1.5 rounded-xl">
                  <Clock className={`w-4 h-4 ${timerColor}`} />
                  <span className={`text-base font-mono font-black ${timerColor} tabular-nums`}>
                    {remainingSeconds}s
                  </span>
                </div>
              </div>
            </div>

            {/* 3. DYNAMIC COUNTDOWN PROGRESS BAR */}
            <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/10 p-0.5 mb-5">
              <div
                style={{ width: `${progressPercent}%` }}
                className={`h-full rounded-full bg-gradient-to-r ${timerColor} transition-all duration-300`}
              />
            </div>

            {/* 4. QUESTION CARD */}
            <div className="mb-5 bg-white/[0.03] border border-white/10 rounded-2xl p-4 md:p-5 relative shadow-inner">
              <h2 className="text-base md:text-lg font-black text-white leading-relaxed tracking-tight">
                {question?.question}
              </h2>
            </div>

            {/* 5. 4-OPTION CHOICES (A, B, C, D) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {optionsList.map(({ letter, text }) => {
                const optDist = votes.distribution[letter] || { count: 0, percent: 0 };
                const isCorrect = isRevealing && question?.correctOption === letter;
                const isWrong = isRevealing && question?.correctOption !== letter;

                let cardStyle = "bg-white/[0.04] border-white/10 text-gray-200 hover:border-white/20";
                let badgeStyle = "bg-white/10 text-gray-300";

                if (isCorrect) {
                  cardStyle = "bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_25px_rgba(16,185,129,0.4)] animate-pulse";
                  badgeStyle = "bg-emerald-500 text-white shadow-lg";
                } else if (isWrong) {
                  cardStyle = "bg-red-950/20 border-red-500/30 text-gray-500 opacity-60";
                  badgeStyle = "bg-red-900/30 text-red-400";
                }

                return (
                  <div
                    key={letter}
                    className={`relative overflow-hidden border-2 rounded-2xl p-3 md:p-3.5 transition-all duration-300 flex flex-col justify-between ${cardStyle}`}
                  >
                    {/* Live Vote Progress Fill */}
                    <div
                      style={{ width: `${optDist.percent}%` }}
                      className={`absolute inset-y-0 left-0 transition-all duration-500 pointer-events-none ${
                        isCorrect
                          ? 'bg-emerald-500/30'
                          : isWrong
                          ? 'bg-red-500/10'
                          : 'bg-white/[0.06]'
                      }`}
                    />

                    <div className="relative z-10 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0 ${badgeStyle}`}>
                          {letter}
                        </span>
                        <span className="font-extrabold text-sm tracking-tight text-white leading-snug">
                          {text}
                        </span>
                      </div>

                      {/* Vote Count & Percent */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCorrect && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        )}
                        {isWrong && (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <span className="text-xs font-mono font-bold text-gray-300">
                          %{optDist.percent}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 6. REVEAL PHASE: EXPLANATION NOTE & WINNERS PODIUM */}
            {isRevealing && (
              <div className="space-y-3 pt-1 axt-anim-fadeUp">
                {/* Explanation Card ("Bunu Biliyor muydunuz?") */}
                {question?.explanation && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                        BUNU BİLİYOR MUYDUNUZ?
                      </div>
                      <div className="text-xs text-amber-100 font-medium leading-relaxed mt-0.5">
                        {question.explanation}
                      </div>
                    </div>
                  </div>
                )}

                {/* Fastest Winners Row */}
                {lastWinners && lastWinners.length > 0 ? (
                  <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs font-bold text-gray-300">
                        En Hızlı:
                      </span>
                      <span className="text-xs font-extrabold text-white">
                        @{lastWinners[0].displayName}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {(lastWinners[0].answerMs / 1000).toFixed(1)}s
                      </span>
                      {lastWinners[0].streak >= 2 && (
                        <span className="text-[10px] font-bold text-orange-400 flex items-center gap-0.5">
                          <Flame className="w-3 h-3 fill-orange-400" /> {lastWinners[0].streak}x Seri
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-yellow-400">
                      +{lastWinners[0].earnedPoints} Puan
                    </span>
                  </div>
                ) : (
                  <div className="text-center text-xs font-semibold text-gray-400 py-1">
                    Bu soruyu kimse doğru yanıtlayamadı.
                  </div>
                )}
              </div>
            )}

            {/* 7. FOOTER CHAT INSTRUCTION */}
            <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-4 text-[11px] text-gray-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <span>Toplam Katılım: <b>{votes.total}</b> kişi</span>
              </span>
              <span className="text-emerald-400 font-bold">
                Chat'e sadece A, B, C veya D yazın!
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TriviaWidget;
