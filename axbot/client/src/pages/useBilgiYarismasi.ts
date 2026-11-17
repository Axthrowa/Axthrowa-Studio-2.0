/** Bil Bakalım stüdyosu durumu: soru bankası, yarışma kontrolü, liderlik, modallar */
import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { TriviaQuestionItem, LeaderboardUser } from './TriviaStudio';

export type UseBilgiYarismasiGirdisi = {

};

export function useBilgiYarismasi({  }: UseBilgiYarismasiGirdisi) {
  const [activeTab, setActiveTab] = useState<'control' | 'questions' | 'leaderboard'>('control');
  const [gameState, setGameState] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [questionDuration, setQuestionDuration] = useState<number>(20);
  const [tournamentCount, setTournamentCount] = useState<number>(5);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Question bank state
  const [questions, setQuestions] = useState<TriviaQuestionItem[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [filterCat, setFilterCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Modal State for New Question
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestionForm, setNewQuestionForm] = useState({
    category: 'Genel Kültür',
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A' as 'A' | 'B' | 'C' | 'D',
    points: 100,
    explanation: '',
    difficulty: 'medium'
  });

  // AI Modal State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    category: 'Coğrafya',
    count: 5,
    difficulty: 'orta'
  });

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);

  const overlayUrl = `${window.location.origin}/widgets/trivia`;
  const [bankStats, setBankStats] = useState<{ total: number; categories: Array<{ category: string; cnt: number }> } | null>(null);
  const [syncingBank, setSyncingBank] = useState(false);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Poll active game state
  const fetchState = async () => {
    try {
      const res = await fetch('/api/trivia/state');
      const data = await res.json();
      setGameState(data);
    } catch {}
  };

  // Fetch questions
  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const url = `/api/trivia/questions?category=${encodeURIComponent(filterCat)}&search=${encodeURIComponent(searchQuery)}&limit=100`;
      const res = await fetch(url);
      const data = await res.json();
      setQuestions(data.questions || []);
      setTotalQuestions(data.total || 0);
    } catch {}
    setLoadingQuestions(false);
  };

  // Fetch Leaderboard
  const skorlariSil = async () => {
    if (!confirm('Bil Bakalım skorları silinsin mi? Sıralama, doğru/yanlış sayıları ve seriler sıfırlanır. Bu işlem geri alınamaz.')) return;
    const r = await fetch('/api/istatistikler/sil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grup: 'trivia' })
    }).catch(() => null);
    if (r?.ok) setLeaderboard([]);
    else alert('Skorlar silinemedi: bot yanıt vermedi.');
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/trivia/leaderboard?limit=25');
      const data = await res.json();
      if (Array.isArray(data)) {
        setLeaderboard(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchState();
    fetchQuestions();
    fetchLeaderboard();
    fetch('/api/trivia/stats').then(r => r.json()).then(setBankStats).catch(() => {});

    const interval = setInterval(fetchState, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchQuestions();
  }, [filterCat, searchQuery]);

  // Actions
  const handleStartQuestion = async () => {
    try {
      const res = await fetch('/api/trivia/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          category: selectedCategory,
          durationSec: questionDuration
        })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('🚀 Yeni soru başlatıldı! OBS Overlay ve Chat güncellendi.');
        fetchState();
      }
    } catch {
      showNotification('Soru başlatılamadı.', 'error');
    }
  };

  const handleStartTournament = async () => {
    try {
      const res = await fetch('/api/trivia/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'tournament',
          category: selectedCategory,
          durationSec: questionDuration,
          questionCount: tournamentCount
        })
      });
      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 50, spread: 80 });
        showNotification(`🏆 ${tournamentCount} soruluk Bil Bakalım yarışması başlatıldı!`);
        fetchState();
      }
    } catch {
      showNotification('Turnuva başlatılamadı.', 'error');
    }
  };

  const handleSkipQuestion = async () => {
    try {
      await fetch('/api/trivia/skip', { method: 'POST' });
      showNotification('⏭️ Aktif soru atlandı.');
      fetchState();
    } catch {}
  };

  const handleStopGame = async () => {
    try {
      await fetch('/api/trivia/stop', { method: 'POST' });
      showNotification('⏹️ Yarışma durduruldu.');
      fetchState();
    } catch {}
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(overlayUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/trivia/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuestionForm)
      });
      const data = await res.json();
      if (data.success) {
        showNotification('✅ Soru başarıyla havuza eklendi!');
        setShowAddModal(false);
        setNewQuestionForm({
          category: 'Genel Kültür',
          question: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correctOption: 'A',
          points: 100,
          explanation: '',
          difficulty: 'medium'
        });
        fetchQuestions();
      } else {
        showNotification(data.error || 'Hata oluştu.', 'error');
      }
    } catch {
      showNotification('Soru eklenirken hata oluştu.', 'error');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Bu soruyu silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`/api/trivia/questions/${id}`, { method: 'DELETE' });
      showNotification('🗑️ Soru silindi.');
      fetchQuestions();
    } catch {
      showNotification('Silme başarısız.', 'error');
    }
  };

  const handleGenerateAI = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch('/api/trivia/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig)
      });
      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 60, spread: 70 });
        showNotification(`✨ Gemini ${data.count} adet yeni soru üretti ve veritabanına ekledi!`);
        setShowAIModal(false);
        fetchQuestions();
      } else {
        showNotification(data.error || 'Yapay zeka hatası oluştu.', 'error');
      }
    } catch {
      showNotification('AI soru üretimi başarısız oldu.', 'error');
    }
    setAiGenerating(false);
  };

  const isQuestionActive = gameState?.status === 'question_active';
  return { activeTab, aiConfig, aiGenerating, bankStats, copiedUrl, fetchLeaderboard, fetchQuestions, filterCat, gameState, handleAddQuestion, handleCopyUrl, handleDeleteQuestion, handleGenerateAI, handleSkipQuestion, handleStartQuestion, handleStartTournament, handleStopGame, isQuestionActive, leaderboard, loadingQuestions, newQuestionForm, overlayUrl, questionDuration, questions, searchQuery, selectedCategory, setActiveTab, setAiConfig, setBankStats, setFilterCat, setNewQuestionForm, setQuestionDuration, setSearchQuery, setSelectedCategory, setShowAIModal, setShowAddModal, setStatusMessage, setSyncingBank, setTournamentCount, showAIModal, showAddModal, showNotification, skorlariSil, statusMessage, syncingBank, totalQuestions, tournamentCount };
}
export type BilgiYarismasiSonucu = ReturnType<typeof useBilgiYarismasi>;
