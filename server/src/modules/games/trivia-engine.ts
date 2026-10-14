import { EventEmitter } from 'events';
import { db } from '../../db/index.js';
import { TriviaQuestion, TriviaCategory, TriviaScore } from '../../db/schema.js';
import { eventBus } from '../../core/event-bus.js';
import { economy } from '../economy/economy.js';
import { wsHub } from '../../ws/server.js';
import { hataMetni } from '../../core/logger.js';
import { sikCoz } from './cevap-eslestir.js';

export interface VoteDistribution {
  A: { count: number; percent: number };
  B: { count: number; percent: number };
  C: { count: number; percent: number };
  D: { count: number; percent: number };
  total: number;
}

export interface TriviaWinnerInfo {
  username: string;
  displayName: string;
  platform: string;
  answerMs: number;
  earnedPoints: number;
  streak: number;
}

export interface TournamentPlayerScore {
  username: string;
  displayName: string;
  platform: string;
  score: number;
  correctAnswers: number;
  fastestMs: number;
}

export type TriviaEngineStatus = 'idle' | 'question_active' | 'revealing_answer' | 'round_ended' | 'podium';

export class TriviaEngine extends EventEmitter {
  private status: TriviaEngineStatus = 'idle';
  private currentQuestion: TriviaQuestion | null = null;
  private questionStartedAt: number = 0;
  private durationSeconds: number = 20;
  private remainingSeconds: number = 20;
  private timer: NodeJS.Timeout | null = null;
  private tickInterval: NodeJS.Timeout | null = null;
  private autoNextTimer: NodeJS.Timeout | null = null;

  // Mode settings
  private mode: 'single' | 'tournament' = 'single';
  private tournamentTotalQuestions: number = 5;
  private tournamentCurrentIndex: number = 0;
  private selectedCategory: string = 'all';

  // State maps
  private votes: Map<string, { option: 'A' | 'B' | 'C' | 'D'; timestamp: number; platform: string; displayName: string; answerMs: number }> = new Map();
  private tournamentScores: Map<string, TournamentPlayerScore> = new Map();
  private lastQuestionWinners: TriviaWinnerInfo[] = [];
  private usedQuestionIds: Set<string> = new Set();

  constructor() {
    super();
  }

  // Get current state snapshot for API and Overlays
  getState() {
    const distribution = this.calculateDistribution();
    return {
      status: this.status,
      mode: this.mode,
      durationSeconds: this.durationSeconds,
      remainingSeconds: this.remainingSeconds,
      progressPercent: this.durationSeconds > 0 ? Math.max(0, Math.min(100, (this.remainingSeconds / this.durationSeconds) * 100)) : 0,
      question: this.currentQuestion ? {
        id: this.currentQuestion.id,
        category: this.currentQuestion.category,
        question: this.currentQuestion.question,
        optionA: this.currentQuestion.optionA,
        optionB: this.currentQuestion.optionB,
        optionC: this.currentQuestion.optionC,
        optionD: this.currentQuestion.optionD,
        points: this.currentQuestion.points,
        difficulty: this.currentQuestion.difficulty,
        // Only reveal correctOption and explanation when revealing
        correctOption: this.status === 'revealing_answer' || this.status === 'podium' ? this.currentQuestion.correctOption : null,
        explanation: this.status === 'revealing_answer' || this.status === 'podium' ? this.currentQuestion.explanation : null
      } : null,
      tournament: this.mode === 'tournament' ? {
        currentIndex: this.tournamentCurrentIndex,
        totalQuestions: this.tournamentTotalQuestions,
        category: this.selectedCategory,
        leaderboard: Array.from(this.tournamentScores.values()).sort((a, b) => b.score - a.score).slice(0, 10)
      } : null,
      votes: {
        total: distribution.total,
        distribution: distribution
      },
      lastWinners: this.lastQuestionWinners
    };
  }

  // 1. START A SINGLE QUESTION
  startQuestion(options?: { category?: string; durationSec?: number; questionId?: string }): TriviaQuestion | null {
    this.cleanupTimers();

    const cat = options?.category || 'all';
    const dur = options?.durationSec || 20;

    let questionRow: any = null;

    if (options?.questionId) {
      questionRow = db.prepare('SELECT * FROM trivia_questions WHERE id = ?').get(options.questionId);
    } else {
      let query = 'SELECT * FROM trivia_questions';
      const params: any[] = [];

      if (cat && cat !== 'all') {
        query += ' WHERE category = ?';
        params.push(cat);
      }

      // Avoid recently used questions
      if (this.usedQuestionIds.size > 0) {
        const placeholders = Array.from(this.usedQuestionIds).map(() => '?').join(',');
        query += (params.length > 0 ? ' AND' : ' WHERE') + ` id NOT IN (${placeholders})`;
        params.push(...Array.from(this.usedQuestionIds));
      }

      query += ' ORDER BY RANDOM() LIMIT 1';
      questionRow = db.prepare(query).get(...params);

      // Reset pool if exhausted
      if (!questionRow) {
        this.usedQuestionIds.clear();
        let fallbackQuery = 'SELECT * FROM trivia_questions';
        const fallbackParams: any[] = [];
        if (cat && cat !== 'all') {
          fallbackQuery += ' WHERE category = ?';
          fallbackParams.push(cat);
        }
        fallbackQuery += ' ORDER BY RANDOM() LIMIT 1';
        questionRow = db.prepare(fallbackQuery).get(...fallbackParams);
      }
    }

    if (!questionRow) {
      console.warn('[TriviaEngine] No questions found in database!');
      return null;
    }

    this.currentQuestion = {
      id: questionRow.id,
      category: questionRow.category as TriviaCategory,
      question: questionRow.question,
      optionA: questionRow.option_a,
      optionB: questionRow.option_b,
      optionC: questionRow.option_c,
      optionD: questionRow.option_d,
      correctOption: questionRow.correct_option as any,
      points: questionRow.points,
      explanation: questionRow.explanation,
      difficulty: questionRow.difficulty as any,
      createdAt: questionRow.created_at
    };

    this.usedQuestionIds.add(this.currentQuestion.id);
    this.status = 'question_active';
    this.durationSeconds = dur;
    this.remainingSeconds = dur;
    this.questionStartedAt = Date.now();
    this.votes.clear();
    this.lastQuestionWinners = [];

    // Announce to Chat
    this.broadcastQuestionToChat();

    // Broadcast to WebSocket clients (Overlays & Dashboard)
    this.broadcastWs('trivia_question_start', this.getState());

    // Start 1-second countdown ticks
    this.tickInterval = setInterval(() => {
      this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
      this.broadcastWs('trivia_tick', {
        remainingSeconds: this.remainingSeconds,
        durationSeconds: this.durationSeconds,
        progressPercent: (this.remainingSeconds / this.durationSeconds) * 100
      });

      if (this.remainingSeconds <= 0) {
        this.revealAnswer();
      }
    }, 1000);

    return this.currentQuestion;
  }

  // 2. START A TOURNAMENT (Bil Bakalım Show Mode)
  startTournament(category: string = 'all', totalQuestions: number = 5, durationSec: number = 20) {
    this.cleanupTimers();
    this.mode = 'tournament';
    this.selectedCategory = category;
    this.tournamentTotalQuestions = totalQuestions;
    this.tournamentCurrentIndex = 1;
    this.tournamentScores.clear();
    this.usedQuestionIds.clear();

    const catName = category === 'all' ? 'Karışık Kategoriler' : category;
    eventBus.emitBotMessage({
      platform: 'all',
      message: `🏆 BİL BAKALIM YARIŞMASI BAŞLIYOR! 🏆\nKategori: ${catName} | Toplam: ${totalQuestions} Soru | Soru Süresi: ${durationSec} sn\nHazır olun, ilk soru geliyor! 🚀`
    });

    setTimeout(() => {
      this.startQuestion({ category, durationSec });
    }, 2000);
  }

  // 3. SUBMIT A VOTE FROM CHAT
  submitVote(
    user: { username: string; displayName: string; platform: string },
    rawText: string
  ): { accepted: boolean; option?: 'A' | 'B' | 'C' | 'D'; reason?: string } {
    if (this.status !== 'question_active' || !this.currentQuestion) {
      return { accepted: false, reason: 'Aktif bir soru yok veya süre doldu.' };
    }

    const username = user.username.toLowerCase();

    // Check if already voted
    if (this.votes.has(username)) {
      return { accepted: false, reason: 'Zaten oy kullandınız!' };
    }

    const parsed = this.parseOption(rawText);
    if (!parsed) {
      return { accepted: false, reason: 'Geçersiz şık. Lütfen A, B, C veya D yazın.' };
    }

    const answerMs = Date.now() - this.questionStartedAt;

    this.votes.set(username, {
      option: parsed,
      timestamp: Date.now(),
      platform: user.platform,
      displayName: user.displayName,
      answerMs
    });

    // Broadcast updated vote counts to overlay
    this.broadcastWs('trivia_vote_update', {
      distribution: this.calculateDistribution(),
      voter: {
        displayName: user.displayName,
        platform: user.platform,
        option: parsed
      }
    });

    return { accepted: true, option: parsed };
  }

  // 4. REVEAL ANSWER & CALCULATE WINNERS
  revealAnswer() {
    if (this.status !== 'question_active' || !this.currentQuestion) return;

    this.cleanupTimers();
    this.status = 'revealing_answer';

    const q = this.currentQuestion;
    const correctOpt = q.correctOption;
    const correctVoters: Array<{
      username: string;
      displayName: string;
      platform: string;
      answerMs: number;
    }> = [];

    const wrongVoters: Array<{ username: string; displayName: string; platform: string }> = [];

    for (const [uname, vote] of this.votes.entries()) {
      if (vote.option === correctOpt) {
        correctVoters.push({
          username: uname,
          displayName: vote.displayName,
          platform: vote.platform,
          answerMs: vote.answerMs
        });
      } else {
        wrongVoters.push({ username: uname, displayName: vote.displayName, platform: vote.platform });
      }
    }

    // Sort correct voters by fastest response time
    correctVoters.sort((a, b) => a.answerMs - b.answerMs);

    this.lastQuestionWinners = [];

    // Process winners
    for (let i = 0; i < correctVoters.length; i++) {
      const v = correctVoters[i];
      const basePoints = q.points || 100;

      // Speed bonus: up to +100 bonus points for ultra-fast answers
      const speedRatio = Math.max(0, (this.durationSeconds * 1000 - v.answerMs) / (this.durationSeconds * 1000));
      const speedBonus = Math.round(speedRatio * 80);

      // Fast podium bonus: 1st (+50), 2nd (+30), 3rd (+15)
      const rankBonus = i === 0 ? 50 : i === 1 ? 30 : i === 2 ? 15 : 0;

      // Fetch / update streak from DB
      const userScore = this.getOrCreateScore(v.username, v.displayName, v.platform);
      const newStreak = userScore.currentStreak + 1;
      const bestStreak = Math.max(userScore.bestStreak, newStreak);

      // Streak multiplier: 2 in a row = 1.2x, 3 in a row = 1.5x, 5+ = 2.0x
      let streakMultiplier = 1.0;
      if (newStreak === 2) streakMultiplier = 1.2;
      else if (newStreak >= 3 && newStreak < 5) streakMultiplier = 1.5;
      else if (newStreak >= 5) streakMultiplier = 2.0;

      const totalEarned = Math.round((basePoints + speedBonus + rankBonus) * streakMultiplier);

      // Award points in StreamAxT economy
      try {
        economy.addPoints(v.username, totalEarned);
      } catch (e) {
        console.warn(`[Trivia] ${v.username} için ${totalEarned} puan eklenemedi:`, hataMetni(e));
      }

      // Update DB score
      this.updateScoreInDb(v.username, v.displayName, v.platform, {
        addPoints: totalEarned,
        isCorrect: true,
        answerMs: v.answerMs,
        newStreak,
        bestStreak
      });

      // Update tournament scores if in tournament mode
      if (this.mode === 'tournament') {
        const currentT = this.tournamentScores.get(v.username) || {
          username: v.username,
          displayName: v.displayName,
          platform: v.platform,
          score: 0,
          correctAnswers: 0,
          fastestMs: 999999
        };
        currentT.score += totalEarned;
        currentT.correctAnswers += 1;
        currentT.fastestMs = Math.min(currentT.fastestMs, v.answerMs);
        this.tournamentScores.set(v.username, currentT);
      }

      this.lastQuestionWinners.push({
        username: v.username,
        displayName: v.displayName,
        platform: v.platform,
        answerMs: v.answerMs,
        earnedPoints: totalEarned,
        streak: newStreak
      });
    }

    // Process wrong voters: reset streak (görünen ad ve platform korunur;
    // eskiden ad yerine kullanıcı adı, platform yerine 'stream' yazılıyordu)
    for (const w of wrongVoters) {
      this.updateScoreInDb(w.username, w.displayName, w.platform, {
        addPoints: 0,
        isCorrect: false,
        answerMs: 0,
        newStreak: 0,
        bestStreak: 0
      });
    }

    // Broadcast Chat Result
    this.broadcastAnswerToChat();

    // Broadcast WebSocket Reveal Event
    this.broadcastWs('trivia_answer_reveal', {
      ...this.getState(),
      correctOption: correctOpt,
      explanation: q.explanation,
      winners: this.lastQuestionWinners,
      totalVotes: this.votes.size,
      correctCount: correctVoters.length,
      wrongCount: wrongVoters.length
    });

    // Schedule next question or end tournament
    if (this.mode === 'tournament') {
      if (this.tournamentCurrentIndex < this.tournamentTotalQuestions) {
        this.tournamentCurrentIndex++;
        this.autoNextTimer = setTimeout(() => {
          this.startQuestion({ category: this.selectedCategory, durationSec: this.durationSeconds });
        }, 7000);
      } else {
        this.autoNextTimer = setTimeout(() => {
          this.endTournament();
        }, 7000);
      }
    } else {
      // Single question ends back to idle after 8 seconds
      this.autoNextTimer = setTimeout(() => {
        this.status = 'idle';
        this.currentQuestion = null;
        this.broadcastWs('trivia_state', this.getState());
      }, 8000);
    }
  }

  // 5. END TOURNAMENT & PODIUM CELEBRATION
  endTournament() {
    this.cleanupTimers();
    this.status = 'podium';

    const sortedPlayers = Array.from(this.tournamentScores.values()).sort((a, b) => b.score - a.score);
    const podiumWinners = sortedPlayers.slice(0, 3);

    // Podium extra bonus prizes
    const bonusPrizes = [500, 300, 150];
    podiumWinners.forEach((player, idx) => {
      const bonus = bonusPrizes[idx] || 50;
      try {
        economy.addPoints(player.username, bonus);
      } catch (e) {
        console.warn(`[Trivia] ${player.username} için ${bonus} kürsü puanı eklenemedi:`, hataMetni(e));
      }
      player.score += bonus;
    });

    // Broadcast Podium to Chat
    if (podiumWinners.length > 0) {
      let chatMsg = `🏆 BİL BAKALIM TURNUVASI ŞAMPİYONLARI! 🏆\n`;
      if (podiumWinners[0]) chatMsg += `🥇 1. @${podiumWinners[0].displayName} - ${podiumWinners[0].score} Puan (+500 Şampiyonluk Bonusu!)\n`;
      if (podiumWinners[1]) chatMsg += `🥈 2. @${podiumWinners[1].displayName} - ${podiumWinners[1].score} Puan (+300 İkincilik Bonusu!)\n`;
      if (podiumWinners[2]) chatMsg += `🥉 3. @${podiumWinners[2].displayName} - ${podiumWinners[2].score} Puan (+150 Üçüncülük Bonusu!)\n`;
      chatMsg += `👏 Katılan tüm izleyicilere tebrikler!`;
      eventBus.emitBotMessage({ platform: 'all', message: chatMsg });
    } else {
      eventBus.emitBotMessage({ platform: 'all', message: '🏆 Bilgi yarışması sona erdi. Katılan herkese teşekkürler!' });
    }

    // Broadcast to Overlay
    this.broadcastWs('trivia_podium', {
      podium: podiumWinners,
      totalParticipants: sortedPlayers.length
    });

    // Reset back to idle after 12 seconds
    this.autoNextTimer = setTimeout(() => {
      this.status = 'idle';
      this.mode = 'single';
      this.currentQuestion = null;
      this.broadcastWs('trivia_state', this.getState());
    }, 12000);
  }

  // 6. SKIP OR CANCEL
  /**
   * Soruyu atla.
   *
   * Eskiden yalnız `question_active` durumunda çalışıyordu ve turnuvada da
   * oyunu tamamen `idle`'a düşürüyordu: cevap açıklanırken "Atla"ya basınca
   * hiçbir şey olmuyor, soru sırasında basınca turnuva donuyordu ("takılıyor").
   * Artık her iki durumda da SIRADAKİ soruya geçer.
   */
  skipQuestion(): boolean {
    if (this.status === 'idle' || this.status === 'podium') return false;
    const wasActive = this.status === 'question_active';
    this.cleanupTimers();
    eventBus.emitBotMessage({ platform: 'all', message: '⏭️ Soru atlandı.' });

    if (this.mode === 'tournament') {
      // `revealAnswer` cevap açılırken sayacı zaten artırdı; yalnız soru
      // etkinken atlanıyorsa burada artırılır (çift atlama olmasın).
      if (wasActive) this.tournamentCurrentIndex++;
      this.votes.clear();
      if (this.tournamentCurrentIndex <= this.tournamentTotalQuestions) {
        this.status = 'idle';
        this.startQuestion({ category: this.selectedCategory, durationSec: this.durationSeconds });
      } else {
        this.endTournament();
      }
      return true;
    }

    this.status = 'idle';
    this.currentQuestion = null;
    this.votes.clear();
    this.broadcastWs('trivia_state', this.getState());
    return true;
  }

  stopGame(): boolean {
    this.cleanupTimers();
    this.status = 'idle';
    this.mode = 'single';
    this.currentQuestion = null;
    this.votes.clear();
    eventBus.emitBotMessage({ platform: 'all', message: '⏹️ Bilgi yarışması durduruldu.' });
    this.broadcastWs('trivia_state', this.getState());
    return true;
  }

  // --- HELPERS ---

  private cleanupTimers() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.autoNextTimer) {
      clearTimeout(this.autoNextTimer);
      this.autoNextTimer = null;
    }
  }

  /** Harf/rakam ya da seçenek metni; Türkçe duyarlı (bkz. cevap-eslestir.ts). */
  private parseOption(text: string): 'A' | 'B' | 'C' | 'D' | null {
    const q = this.currentQuestion;
    return sikCoz(text, q ? { A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD } : undefined);
  }

  private calculateDistribution(): VoteDistribution {
    let countA = 0, countB = 0, countC = 0, countD = 0;
    for (const v of this.votes.values()) {
      if (v.option === 'A') countA++;
      else if (v.option === 'B') countB++;
      else if (v.option === 'C') countC++;
      else if (v.option === 'D') countD++;
    }

    const total = this.votes.size;
    return {
      A: { count: countA, percent: total > 0 ? Math.round((countA / total) * 100) : 0 },
      B: { count: countB, percent: total > 0 ? Math.round((countB / total) * 100) : 0 },
      C: { count: countC, percent: total > 0 ? Math.round((countC / total) * 100) : 0 },
      D: { count: countD, percent: total > 0 ? Math.round((countD / total) * 100) : 0 },
      total
    };
  }

  private broadcastQuestionToChat() {
    if (!this.currentQuestion) return;
    const q = this.currentQuestion;
    const roundPrefix = this.mode === 'tournament' ? `[Soru ${this.tournamentCurrentIndex}/${this.tournamentTotalQuestions}] ` : '';

    const categoryIcons: Record<string, string> = {
      'Genel Kültür': '💡',
      'Bilgi': '🔬',
      'Bilim': '🧪',
      'Oyun': '🎮',
      'Oyunlar': '🎲',
      'Film ve Dizi': '🎬',
      'Sinema TV': '🎥',
      'Coğrafya': '🌍',
      'Tarih': '📜',
      'Osmanlı Tarihi': '🕌',
      'Spor': '⚽',
      'Basketbol': '🏀',
      'Sanat': '🎨',
      'Tıbbi Terimler': '🩺',
      'Azerbaycan Türkçesi': '🇦🇿',
      'Gündem 2000/26': '📰',
      'Ekonomi': '📈',
      'Türk Mutfağı': '🍲',
      'Teknoloji': '💻',
      'İz Bırakanlar': '🌟',
      'Geçmişten Günümüze': '⏳',
      '4 İşlem': '🔢',
      'Yazım Yanlışları': '✍️',
      'Söz ve Deyiş': '💬'
    };
    const icon = categoryIcons[q.category] || '🧠';

    const msg = 
      `╔════════════ 🧠 BİL BAKALIM ════════════╗\n` +
      `║ ${icon} ${roundPrefix}Kategori: ${q.category} | Süre: ${this.durationSeconds}sn | Ödül: ${q.points} Puan\n` +
      `║ Soru: ${q.question}\n` +
      `║ 🇦 ${q.optionA}    🇧 ${q.optionB}\n` +
      `║ 🇨 ${q.optionC}    🇩 ${q.optionD}\n` +
      `╚════════════════════════════════════════════╝\n` +
      `💡 Cevap vermek için sohbete sadece A, B, C veya D yazın!`;

    eventBus.emitBotMessage({ platform: 'all', message: msg });
  }

  private broadcastAnswerToChat() {
    if (!this.currentQuestion) return;
    const q = this.currentQuestion;
    const optLetter = q.correctOption;
    const optText = (q as any)[`option${optLetter}`] || '';

    let msg = `⏰ SÜRE DOLDU! Doğru Cevap: [ ${optLetter} ] ${optText} ✅\n`;

    if (q.explanation) {
      msg += `📌 Bilgi Notu: ${q.explanation}\n`;
    }

    if (this.lastQuestionWinners.length > 0) {
      const fastest = this.lastQuestionWinners[0];
      const sec = (fastest.answerMs / 1000).toFixed(1);
      msg += `🏆 En Hızlı Bilen: @${fastest.displayName} (+${fastest.earnedPoints} Puan - ${sec} sn) | Toplam ${this.lastQuestionWinners.length} kişi bildi!`;

      if (fastest.streak >= 2) {
        msg += ` 🔥 (${fastest.streak} soru serisi!)`;
      }
    } else {
      msg += `😢 Maalesef bu soruyu kimse doğru bilemedi!`;
    }

    eventBus.emitBotMessage({ platform: 'all', message: msg });
  }

  private broadcastWs(type: string, data: any) {
    wsHub.broadcastTo(['all'], {
      type,
      data
    });
  }

  private getOrCreateScore(username: string, displayName: string, platform: string): TriviaScore {
    try {
      const row = db.prepare('SELECT * FROM trivia_scores WHERE username = ?').get(username.toLowerCase()) as any;
      if (row) {
        return {
          username: row.username,
          displayName: row.display_name,
          platform: row.platform,
          totalScore: row.total_score,
          correctCount: row.correct_count,
          wrongCount: row.wrong_count,
          fastestMs: row.fastest_ms,
          currentStreak: row.current_streak,
          bestStreak: row.best_streak,
          lastPlayed: row.last_played
        };
      }

      // Insert new
      db.prepare(`
        INSERT INTO trivia_scores (username, display_name, platform, total_score, correct_count, wrong_count, fastest_ms, current_streak, best_streak, last_played)
        VALUES (?, ?, ?, 0, 0, 0, 999999, 0, 0, ?)
      `).run(username.toLowerCase(), displayName, platform, Date.now());

      return {
        username: username.toLowerCase(),
        displayName,
        platform,
        totalScore: 0,
        correctCount: 0,
        wrongCount: 0,
        fastestMs: 999999,
        currentStreak: 0,
        bestStreak: 0,
        lastPlayed: Date.now()
      };
    } catch (err) {
      console.warn('[TriviaEngine] Score DB read error:', err);
      return {
        username: username.toLowerCase(),
        displayName,
        platform,
        totalScore: 0,
        correctCount: 0,
        wrongCount: 0,
        fastestMs: 999999,
        currentStreak: 0,
        bestStreak: 0,
        lastPlayed: Date.now()
      };
    }
  }

  private updateScoreInDb(
    username: string,
    displayName: string,
    platform: string,
    payload: { addPoints: number; isCorrect: boolean; answerMs: number; newStreak: number; bestStreak: number }
  ) {
    try {
      const user = this.getOrCreateScore(username, displayName, platform);
      const newTotal = user.totalScore + payload.addPoints;
      const newCorrect = user.correctCount + (payload.isCorrect ? 1 : 0);
      const newWrong = user.wrongCount + (payload.isCorrect ? 0 : 1);
      const fastest = payload.isCorrect && payload.answerMs > 0 ? Math.min(user.fastestMs, payload.answerMs) : user.fastestMs;

      db.prepare(`
        UPDATE trivia_scores
        SET display_name = ?, platform = ?, total_score = ?, correct_count = ?, wrong_count = ?, fastest_ms = ?, current_streak = ?, best_streak = ?, last_played = ?
        WHERE username = ?
      `).run(
        displayName,
        platform,
        newTotal,
        newCorrect,
        newWrong,
        fastest,
        payload.newStreak,
        Math.max(user.bestStreak, payload.bestStreak),
        Date.now(),
        username.toLowerCase()
      );
    } catch (err) {
      console.warn('[TriviaEngine] Score DB update error:', err);
    }
  }
}

export const triviaEngine = new TriviaEngine();
export default triviaEngine;
