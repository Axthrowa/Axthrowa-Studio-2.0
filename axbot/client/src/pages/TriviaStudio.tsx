
import {
  Trophy,
  RefreshCw,
} from 'lucide-react';
import { useBilgiYarismasi } from './useBilgiYarismasi';
import { KontrolSekmesi, SorularSekmesi, SiralamaSekmesi, SoruEkleModali, YapayZekaModali } from './BilgiYarismasiBolumleri';

export interface TriviaQuestionItem {
  id: string;
  category: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  points: number;
  explanation: string;
  difficulty: string;
  createdAt: number;
}

export interface LeaderboardUser {
  username: string;
  displayName: string;
  platform: string;
  totalScore: number;
  correctCount: number;
  wrongCount: number;
  fastestMs: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayed: number;
}

export function TriviaStudio() {
  const y = useBilgiYarismasi({  });
  const { activeTab, bankStats, fetchLeaderboard, fetchQuestions, setActiveTab, setBankStats, setStatusMessage, setSyncingBank, showAIModal, showAddModal, showNotification, statusMessage, syncingBank, totalQuestions } = y;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-gray-200">
      
      {/* 1. TOP HEADER & BRANDING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-600/30 text-white font-black text-xl">
            🧠
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Bil Bakalım Stüdyosu
              </h1>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                CANLI YARIŞMA
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              OBS Overlay ve Çoklu Platform Chat (Kick, Twitch, YouTube) için çoktan seçmeli yarışma motoru
              {bankStats ? ` · ${bankStats.total} soru / ${bankStats.categories.length} kategori` : ''}
            </p>
          </div>
        </div>

        <button
          onClick={async () => {
            setSyncingBank(true);
            try {
              const res = await fetch('/api/trivia/resync', { method: 'POST' });
              const data = await res.json();
              if (data.success) {
                showNotification(`Soru bankası senkron: +${data.added} yeni (toplam ${data.total})`);
                setBankStats({ total: data.total, categories: (data.categories || []).map((c: any) => ({ category: c.category, cnt: c.count })) });
                fetchQuestions();
              } else {
                showNotification(data.error || 'Senkron başarısız', 'error');
              }
            } catch {
              showNotification('Senkron başarısız', 'error');
            }
            setSyncingBank(false);
          }}
          disabled={syncingBank}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-200 hover:bg-white/10 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncingBank ? 'animate-spin' : ''}`} />
          Masaüstü DB Senkron
        </button>

        {/* Tab Selector */}
        <div className="flex items-center bg-[#131722] p-1.5 rounded-2xl border border-white/10 shadow-inner">
          <button
            onClick={() => setActiveTab('control')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'control'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Yarışma Kontrol Masası
          </button>
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'questions'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>Soru Bankası</span>
            <span className="text-xs bg-white/10 px-1.5 py-0.2 rounded-full font-mono">{totalQuestions}</span>
          </button>
          <button
            onClick={() => { setActiveTab('leaderboard'); fetchLeaderboard(); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'leaderboard'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Liderlik Sıralaması</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between transition-all ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-gray-400 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* 2. TAB CONTENT 1: CONTROL CENTER */}
      {activeTab === 'control' && (
        <KontrolSekmesi {...y} />
      )}

      {/* 3. TAB CONTENT 2: QUESTIONS POOL */}
      {activeTab === 'questions' && (
        <SorularSekmesi {...y} />
      )}

      {/* 4. TAB CONTENT 3: LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <SiralamaSekmesi {...y} />
      )}

      {/* 5. MODAL: MANUEL YENİ SORU EKLE */}
      {showAddModal && (
        <SoruEkleModali {...y} />
      )}

      {/* 6. MODAL: GEMINI AI İLE SORU ÜRET */}
      {showAIModal && (
        <YapayZekaModali {...y} />
      )}
    </div>
  );
}

export default TriviaStudio;
