/** Bilgi yarışması sayfasının sekmeleri ve pencereleri (TEK-4, davranış aynı). */
import {
  Trophy,
  Play,
  Square,
  FastForward,
  Sparkles,
  Plus,
  Trash2,
  Search,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Flame,
  HelpCircle,
  RefreshCw,
  Layers,
  Zap,
} from 'lucide-react';
import { TriviaWidget } from '../widgets/TriviaWidget.js';
import type { BilgiYarismasiSonucu } from './useBilgiYarismasi';
import { CATEGORIES } from './bilgiYarismasiKategorileri';
import { Secim } from '../ui/index.js';

export function KontrolSekmesi(p: BilgiYarismasiSonucu) {
  const { copiedUrl, gameState, handleCopyUrl, handleSkipQuestion, handleStartQuestion, handleStartTournament, handleStopGame, isQuestionActive, overlayUrl, questionDuration, selectedCategory, setQuestionDuration, setSelectedCategory, setTournamentCount, tournamentCount } = p;
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Live Control Console (7 cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* OBS Browser Source Card */}
          <div className="bg-[#0f131c] border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-200">
                  OBS Tarayıcı Kaynağı (Browser Source) Linki
                </h3>
              </div>
              <span className="text-[11px] text-gray-400 font-mono">Önerilen Boyut: 800 x 600</span>
            </div>

            <div className="flex items-center gap-2">
              <input aria-label="Oyun overlay adresi"
                type="text"
                readOnly
                value={overlayUrl}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-purple-300 select-all focus:outline-none"
              />
              <button
                onClick={handleCopyUrl}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-purple-600/30"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedUrl ? 'Kopyalandı' : 'Kopyala'}</span>
              </button>
              <a
                href={overlayUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-white/5 hover:bg-white/10 border border-white/10 p-2.5 rounded-xl text-gray-300 hover:text-white transition-all"
                title="Yeni sekmede aç"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Match / Question Launcher */}
          <div className="bg-[#0f131c] border border-white/10 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="text-base font-black text-white">
                  Canlı Soru & Turnuva Başlatıcı
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  İstediğiniz kategoriyi seçip tek soru veya 5-10 soruluk TV turnuva seansı başlatın
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${isQuestionActive ? 'bg-emerald-400 animate-ping' : 'bg-gray-600'}`} />
                <span className="text-xs font-mono font-bold text-gray-300 uppercase">
                  {gameState?.status || 'Boşta'}
                </span>
              </div>
            </div>

            {/* Category Selection Grid */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-gray-300 flex items-center justify-between">
                <span>Yarışma Kategorisi Seçin:</span>
                <span className="text-[11px] text-purple-400 font-mono font-normal">
                  {selectedCategory === 'all' ? 'Tüm Kategorilerden Karışık' : selectedCategory}
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto pr-1">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-1.5 ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-500 shadow-md shadow-purple-600/20'
                          : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${cat.color}`} />
                      <span className={`text-xs font-extrabold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Settings: Duration & Question Count */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="bg-black/30 border border-white/5 p-3.5 rounded-2xl space-y-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                  <span>Soru Süresi:</span>
                  <span className="text-xs font-mono text-purple-400 font-bold">{questionDuration} Saniye</span>
                </label>
                <input aria-label="Soru süresi"
                  type="range"
                  min={10}
                  max={45}
                  step={5}
                  value={questionDuration}
                  onChange={(e) => setQuestionDuration(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>10 sn (Hızlı)</span>
                  <span>20 sn (Önerilen)</span>
                  <span>45 sn</span>
                </div>
              </div>

              <div className="bg-black/30 border border-white/5 p-3.5 rounded-2xl space-y-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                  <span>Turnuva Soru Sayısı:</span>
                  <span className="text-xs font-mono text-pink-400 font-bold">{tournamentCount} Soru</span>
                </label>
                <input aria-label="Turnuva soru sayısı"
                  type="range"
                  min={3}
                  max={15}
                  step={1}
                  value={tournamentCount}
                  onChange={(e) => setTournamentCount(parseInt(e.target.value, 10))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>3 Soru</span>
                  <span>5 Soru (Standart)</span>
                  <span>15 Soru</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleStartQuestion}
                disabled={isQuestionActive}
                className={`w-full py-3.5 px-4 rounded-2xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                  isQuestionActive
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
                }`}
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Tek Soru Başlat (Hızlı)</span>
              </button>

              <button
                onClick={handleStartTournament}
                disabled={isQuestionActive}
                className={`w-full py-3.5 px-4 rounded-2xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                  isQuestionActive
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-pink-600/30'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>Bil Bakalım Turnuvası ({tournamentCount} Soru)</span>
              </button>
            </div>

            {/* Mid-Game Controls */}
            {isQuestionActive && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                  <Clock className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Soru yayında! Kalan süre: {gameState?.remainingSeconds} sn</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSkipQuestion}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>Soruyu Atla</span>
                  </button>
                  <button
                    onClick={handleStopGame}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Square className="w-3.5 h-3.5 fill-white" />
                    <span>Durdur</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chat Commands Quick Cheat Sheet */}
          <div className="bg-[#0f131c] border border-white/10 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-gray-300 uppercase tracking-wider">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span>Chat Botu Bilgi Yarışması Komutları</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                <span className="text-purple-400 font-bold">!soru [kategori]</span>
                <p className="text-[11px] text-gray-400 mt-0.5">Tek soru başlatır (Örn: !soru cografya)</p>
              </div>
              <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                <span className="text-pink-400 font-bold">!yarisma baslat [kat] [adet]</span>
                <p className="text-[11px] text-gray-400 mt-0.5">Turnuva başlatır (Örn: !yarisma baslat tarih 5)</p>
              </div>
              <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                <span className="text-emerald-400 font-bold">A, B, C veya D</span>
                <p className="text-[11px] text-gray-400 mt-0.5">İzleyiciler sadece şıkkı yazarak oy verir</p>
              </div>
              <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                <span className="text-cyan-400 font-bold">!skor & !triviatop</span>
                <p className="text-[11px] text-gray-400 mt-0.5">Kişisel puan & genel Top 5 sıralaması</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Overlay Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#0f131c] border border-white/10 rounded-3xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  Canlı OBS Overlay Önizlemesi
                </h3>
              </div>
              <span className="text-[10px] text-purple-400 font-bold font-mono">1:1 Canlı Ekran</span>
            </div>

            {/* Embedded Trivia Widget Preview */}
            <div className="axt-onizleme w-full bg-neutral-950/80 rounded-2xl border border-white/10 p-3 min-h-[460px] flex items-center justify-center overflow-hidden">
              <TriviaWidget embedded={true} previewMode={!gameState?.question} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function SorularSekmesi(p: BilgiYarismasiSonucu) {
  const { filterCat, handleDeleteQuestion, loadingQuestions, questions, searchQuery, setFilterCat, setSearchQuery, setShowAIModal, setShowAddModal, totalQuestions } = p;
  return (
    <>
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="bg-[#0f131c] border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <Secim aria-label="Kategori filtresi"
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}

            >
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id} className="bg-gray-900">{c.label}</option>
              ))}
            </Secim>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Soru metni ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-200 w-64 focus:outline-none focus:border-purple-500"
              />
            </div>

            <span className="text-xs text-gray-400 font-mono">
              {totalQuestions} Soru Kayıtlı
            </span>
          </div>

          {/* Actions: Add & AI Generate */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAIModal(true)}
              className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-purple-600/20"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>Gemini AI ile Soru Üret</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-purple-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Manuel Soru Ekle</span>
            </button>
          </div>
        </div>

        {/* Questions Table */}
        <div className="bg-[#0f131c] border border-white/10 rounded-3xl overflow-hidden shadow-xl">
          {loadingQuestions ? (
            <div className="p-12 text-center text-gray-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
              <span>Sorular yükleniyor...</span>
            </div>
          ) : questions.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <HelpCircle className="w-8 h-8 mx-auto text-gray-600" />
              <p>Bu filtrede soru bulunamadı.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5 overflow-x-auto">
              {questions.map((q) => (
                <div key={q.id} className="p-4 hover:bg-white/[0.02] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {q.category}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">
                        +{q.points} PUAN
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white leading-snug">
                      {q.question}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono pt-1">
                      <span className={`p-1.5 rounded-lg border ${q.correctOption === 'A' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold' : 'bg-black/30 border-white/5 text-gray-400'}`}>
                        A) {q.optionA}
                      </span>
                      <span className={`p-1.5 rounded-lg border ${q.correctOption === 'B' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold' : 'bg-black/30 border-white/5 text-gray-400'}`}>
                        B) {q.optionB}
                      </span>
                      <span className={`p-1.5 rounded-lg border ${q.correctOption === 'C' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold' : 'bg-black/30 border-white/5 text-gray-400'}`}>
                        C) {q.optionC}
                      </span>
                      <span className={`p-1.5 rounded-lg border ${q.correctOption === 'D' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold' : 'bg-black/30 border-white/5 text-gray-400'}`}>
                        D) {q.optionD}
                      </span>
                    </div>
                    {q.explanation && (
                      <p className="text-[11px] text-gray-400 italic pt-0.5">
                        💡 Bilgi Notu: {q.explanation}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                      title="Soruyu Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function SiralamaSekmesi(p: BilgiYarismasiSonucu) {
  const { fetchLeaderboard, leaderboard, skorlariSil } = p;
  return (
    <>
      <div className="bg-[#0f131c] border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <span>Bil Bakalım Genel Sıralaması (Leaderboard)</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Canlı yayında bilgi yarışması sorularına en hızlı ve en çok doğru cevap veren izleyiciler
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={skorlariSil}
              disabled={leaderboard.length === 0}
              className="px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-300 text-xs font-bold flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>İstatistikleri sil</span>
            </button>
            <button
              onClick={fetchLeaderboard}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300"
              title="Yenile"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            Henüz kayıtlı trivia skoru bulunmuyor. Yayında soru başlatıp ilk puanları dağıtın!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 font-mono">
                  <th className="py-3 px-4">Sıra</th>
                  <th className="py-3 px-4">Yarışmacı</th>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Toplam Puan</th>
                  <th className="py-3 px-4">Doğru / Yanlış</th>
                  <th className="py-3 px-4">En Hızlı Cevap</th>
                  <th className="py-3 px-4">En İyi Seri</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((user, idx) => {
                  const fastestSec = user.fastestMs < 900000 ? (user.fastestMs / 1000).toFixed(1) + ' sn' : '-';
                  return (
                    <tr key={user.username} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono font-bold">
                        {idx === 0 && <span className="text-lg">🥇</span>}
                        {idx === 1 && <span className="text-lg">🥈</span>}
                        {idx === 2 && <span className="text-lg">🥉</span>}
                        {idx > 2 && <span className="text-gray-400">#{idx + 1}</span>}
                      </td>
                      <td className="py-3 px-4 font-extrabold text-white">
                        @{user.displayName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-mono font-bold uppercase bg-white/5 px-2 py-0.5 rounded text-gray-300">
                          {user.platform}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-extrabold text-amber-400">
                        {user.totalScore.toLocaleString()} Puan
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <span className="text-emerald-400 font-bold">{user.correctCount} D</span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className="text-red-400 font-bold">{user.wrongCount} Y</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-purple-300">
                        {fastestSec}
                      </td>
                      <td className="py-3 px-4">
                        {user.bestStreak >= 2 ? (
                          <span className="text-orange-400 font-bold flex items-center gap-1 font-mono">
                            <Flame className="w-3.5 h-3.5 fill-orange-400" /> {user.bestStreak}x
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export function SoruEkleModali(p: BilgiYarismasiSonucu) {
  const { handleAddQuestion, newQuestionForm, setNewQuestionForm, setShowAddModal } = p;
  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="bg-[#121622] border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-base font-black text-white">Yeni Trivia Sorusu Ekle</h3>
            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">✕</button>
          </div>

          <form onSubmit={handleAddQuestion} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-300 font-bold block mb-1">Kategori:</label>
                <Secim aria-label="Kategori"
                  value={newQuestionForm.category}
                  onChange={(e) => setNewQuestionForm({ ...newQuestionForm, category: e.target.value })}
 className="w-full"
                >
                  {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                    <option key={c.id} value={c.id} className="bg-gray-900">{c.label}</option>
                  ))}
                </Secim>
              </div>
              <div>
                <label className="text-gray-300 font-bold block mb-1">Ödül Puanı:</label>
                <input aria-label="Ödül Puanı"
                  type="number"
                  value={newQuestionForm.points}
                  onChange={(e) => setNewQuestionForm({ ...newQuestionForm, points: parseInt(e.target.value, 10) || 100 })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-300 font-bold block mb-1">Soru Metni:</label>
              <textarea aria-label="Soru Metni"
                rows={3}
                required
                placeholder="Soruyu buraya yazın..."
                value={newQuestionForm.question}
                onChange={(e) => setNewQuestionForm({ ...newQuestionForm, question: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-300 font-bold block mb-0.5">A Şıkkı:</label>
                <input aria-label="A Şıkkı"
                  type="text"
                  required
                  value={newQuestionForm.optionA}
                  onChange={(e) => setNewQuestionForm({ ...newQuestionForm, optionA: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-white"
                />
              </div>
              <div>
                <label className="text-gray-300 font-bold block mb-0.5">B Şıkkı:</label>
                <input aria-label="B Şıkkı"
                  type="text"
                  required
                  value={newQuestionForm.optionB}
                  onChange={(e) => setNewQuestionForm({ ...newQuestionForm, optionB: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-white"
                />
              </div>
              <div>
                <label className="text-gray-300 font-bold block mb-0.5">C Şıkkı:</label>
                <input aria-label="C Şıkkı"
                  type="text"
                  required
                  value={newQuestionForm.optionC}
                  onChange={(e) => setNewQuestionForm({ ...newQuestionForm, optionC: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-white"
                />
              </div>
              <div>
                <label className="text-gray-300 font-bold block mb-0.5">D Şıkkı:</label>
                <input aria-label="D Şıkkı"
                  type="text"
                  required
                  value={newQuestionForm.optionD}
                  onChange={(e) => setNewQuestionForm({ ...newQuestionForm, optionD: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-300 font-bold block mb-1">Doğru Şık:</label>
              <div className="flex gap-2">
                {(['A', 'B', 'C', 'D'] as const).map(letter => (
                  <button
                    type="button"
                    key={letter}
                    onClick={() => setNewQuestionForm({ ...newQuestionForm, correctOption: letter })}
                    className={`flex-1 py-2 rounded-xl font-bold font-mono transition-all ${
                      newQuestionForm.correctOption === letter
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-white/5 text-gray-400 border border-white/10'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-gray-300 font-bold block mb-1">Bunu Biliyor muydunuz? (Bilgi Notu):</label>
              <input aria-label="Bunu Biliyor muydunuz? (Bilgi Notu)"
                type="text"
                placeholder="Cevapla ilgili kısa ilginç bilgi..."
                value={newQuestionForm.explanation}
                onChange={(e) => setNewQuestionForm({ ...newQuestionForm, explanation: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg shadow-purple-600/30"
              >
                Soruyu Kaydet
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export function YapayZekaModali(p: BilgiYarismasiSonucu) {
  const { aiConfig, aiGenerating, handleGenerateAI, setAiConfig, setShowAIModal } = p;
  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div className="bg-[#121622] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-400" />
              <h3 className="text-base font-black text-white">Gemini AI Soru Üretici</h3>
            </div>
            <button onClick={() => setShowAIModal(false)} className="text-gray-400 hover:text-white">✕</button>
          </div>

          <p className="text-xs text-gray-400">
            Google Gemini yapay zekası, seçtiğiniz kategoriye özel 4 şıklı ve doğrulanmış Bil Bakalım sorularını saniyeler içinde otomatik üretir.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-gray-300 font-bold block mb-1">Kategori:</label>
              <Secim aria-label="Kategori"
                value={aiConfig.category}
                onChange={(e) => setAiConfig({ ...aiConfig, category: e.target.value })}
 className="w-full"
              >
                {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id} className="bg-gray-900">{c.label}</option>
                ))}
              </Secim>
            </div>

            <div>
              <label className="text-gray-300 font-bold block mb-1">Üretilecek Soru Sayısı:</label>
              <Secim aria-label="Üretilecek Soru Sayısı"
                value={aiConfig.count}
                onChange={(e) => setAiConfig({ ...aiConfig, count: parseInt(e.target.value, 10) })}
 className="w-full"
              >
                <option value={3}>3 Adet Soru</option>
                <option value={5}>5 Adet Soru</option>
                <option value={10}>10 Adet Soru</option>
              </Secim>
            </div>

            <div>
              <label className="text-gray-300 font-bold block mb-1">Zorluk Derecesi:</label>
              <Secim aria-label="Zorluk Derecesi"
                value={aiConfig.difficulty}
                onChange={(e) => setAiConfig({ ...aiConfig, difficulty: e.target.value })}
 className="w-full"
              >
                <option value="kolay">Kolay (Herkes bilsin)</option>
                <option value="orta">Orta (Dengeli yarışma)</option>
                <option value="zor">Zor (Zorlayıcı sorular)</option>
              </Secim>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowAIModal(false)}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold"
              >
                Vazgeç
              </button>
              <button
                onClick={handleGenerateAI}
                disabled={aiGenerating}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2"
              >
                {aiGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sorular Üretiliyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Soruları Üret ve Ekle</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
