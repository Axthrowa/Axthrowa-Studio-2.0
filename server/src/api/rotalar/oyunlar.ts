/**
 * StreamAxT API — Sohbet oyunları ve trivia
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { randomUUID as uuidv4 } from 'crypto';
import { gamesEngine } from '../../modules/games/games.js';
import { triviaEngine } from '../../modules/games/trivia-engine.js';
import { GoogleGenAI } from '@google/genai';
import { geminiCoHost } from '../../modules/ai/gemini.js';
import { syncTriviaBank } from '../../modules/games/trivia-sync.js';

const router = Router();

// 17. Chat Minigames API
router.get('/games/settings', (req: Request, res: Response) => {
  res.json(gamesEngine.getSettings());
});

router.post('/games/settings', (req: Request, res: Response) => {
  const updated = gamesEngine.updateSettings(req.body);
  res.json({ success: true, settings: updated });
});

router.get('/games/active-lobbies', (req: Request, res: Response) => {
  res.json(gamesEngine.getActiveLobbies());
});

router.post('/games/trigger', (req: Request, res: Response) => {
  const { game } = req.body;
  const msg = gamesEngine.triggerGame(game);
  res.json({ success: true, message: msg });
});

router.post('/games/cancel', (req: Request, res: Response) => {
  const { type } = req.body;
  const ok = gamesEngine.cancelLobby(type);
  res.json({ success: ok });
});

// --- BİL BAKALIM TRIVIA BİLGİ YARIŞMASI API ---
router.get('/trivia/state', (req: Request, res: Response) => {
  res.json(triviaEngine.getState());
});

router.post('/trivia/start', (req: Request, res: Response) => {
  const { mode = 'single', category = 'all', durationSec = 20, questionCount = 5, questionId } = req.body;
  if (mode === 'tournament') {
    triviaEngine.startTournament(category, questionCount, durationSec);
  } else {
    triviaEngine.startQuestion({ category, durationSec, questionId });
  }
  res.json({ success: true, state: triviaEngine.getState() });
});

router.post('/trivia/skip', (req: Request, res: Response) => {
  const ok = triviaEngine.skipQuestion();
  res.json({ success: ok });
});

router.post('/trivia/stop', (req: Request, res: Response) => {
  const ok = triviaEngine.stopGame();
  res.json({ success: ok });
});

router.get('/trivia/questions', (req: Request, res: Response) => {
  const category = (req.query.category as string) || '';
  const search = (req.query.search as string) || '';
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

  let whereClauses: string[] = [];
  let params: any[] = [];

  if (category && category !== 'all') {
    whereClauses.push('category = ?');
    params.push(category);
  }
  if (search) {
    whereClauses.push('(question LIKE ? OR option_a LIKE ? OR option_b LIKE ? OR option_c LIKE ? OR option_d LIKE ?)');
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM trivia_questions ${whereSql}`).get(...params) as { cnt: number };
  const rows = db.prepare(`SELECT * FROM trivia_questions ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as any[];

  res.json({
    total: totalRow.cnt,
    limit,
    offset,
    questions: rows.map(r => ({
      id: r.id,
      category: r.category,
      question: r.question,
      optionA: r.option_a,
      optionB: r.option_b,
      optionC: r.option_c,
      optionD: r.option_d,
      correctOption: r.correct_option,
      points: r.points,
      explanation: r.explanation,
      difficulty: r.difficulty,
      createdAt: r.created_at
    }))
  });
});

router.post('/trivia/questions', (req: Request, res: Response) => {
  const { category, question, optionA, optionB, optionC, optionD, correctOption, points = 100, explanation = '', difficulty = 'medium' } = req.body;
  if (!category || !question || !optionA || !optionB || !optionC || !optionD || !correctOption) {
    return res.status(400).json({ success: false, error: 'Tüm şıklar, kategori ve soru metni zorunludur!' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO trivia_questions (id, category, question, option_a, option_b, option_c, option_d, correct_option, points, explanation, difficulty, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    category,
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption.toUpperCase(),
    points || 100,
    explanation || '',
    difficulty || 'medium',
    Date.now()
  );

  res.json({ success: true, id });
});

router.put('/trivia/questions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { category, question, optionA, optionB, optionC, optionD, correctOption, points = 100, explanation = '', difficulty = 'medium' } = req.body;
  
  db.prepare(`
    UPDATE trivia_questions
    SET category = ?, question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, points = ?, explanation = ?, difficulty = ?
    WHERE id = ?
  `).run(
    category,
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption.toUpperCase(),
    points,
    explanation,
    difficulty,
    String(id)
  );

  res.json({ success: true });
});

router.delete('/trivia/questions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM trivia_questions WHERE id = ?').run(String(id));
  res.json({ success: true });
});

router.get('/trivia/stats', (_req: Request, res: Response) => {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM trivia_questions').get() as { cnt: number };
  const cats = db.prepare('SELECT category, COUNT(*) as cnt FROM trivia_questions GROUP BY category ORDER BY category').all() as Array<{ category: string; cnt: number }>;
  res.json({ total: total.cnt, categories: cats });
});

router.post('/trivia/resync', (_req: Request, res: Response) => {
  try {
    const result = syncTriviaBank(db);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Senkron başarısız' });
  }
});

router.get('/trivia/leaderboard', (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const rows = db.prepare('SELECT * FROM trivia_scores ORDER BY total_score DESC LIMIT ?').all(limit) as any[];
  res.json(rows.map(r => ({
    username: r.username,
    displayName: r.display_name,
    platform: r.platform,
    totalScore: r.total_score,
    correctCount: r.correct_count,
    wrongCount: r.wrong_count,
    fastestMs: r.fastest_ms,
    currentStreak: r.current_streak,
    bestStreak: r.best_streak,
    lastPlayed: r.last_played
  })));
});

router.post('/trivia/generate-ai', async (req: Request, res: Response) => {
  const { category = 'Genel Kültür', count = 5, difficulty = 'orta' } = req.body;

  const keyRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'gemini_api_key'").get() as { value: string } | undefined;
  const apiKey = keyRow?.value || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'Gemini API anahtarı ayarlanmamış. Lütfen Ayarlar sayfasından bir Gemini API Key girin.'
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Sen Bil Bakalım televizyon yarışmasının profesyonel soru yazarısın.
Lütfen aşağıdaki kurallara göre tam ${count} adet Türkçe soru üret:
- Kategori: "${category}" (Seçenekler: Genel Kültür, Bilgi, Oyun, Film ve Dizi, Coğrafya, Tarih)
- Zorluk seviyesi: "${difficulty}" (kolay, orta veya zor)
- Her sorunun mutlaka 4 şıkkı (A, B, C, D) ve 1 doğru cevabı olmalı.
- Sorular net, ilgi çekici, yanıltıcı olmayan kaliteli yarışma soruları olmalıdır.
- Her soru için Bil Bakalım tarzı 1-2 cümlelik "Bunu Biliyor muydunuz?" açıklaması (explanation) ekle.

Lütfen çıktıyı YALNIZCA geçerli bir JSON dizisi (JSON Array) formatında ver, başka hiçbir markdown veya açıklama yazma:
[
  {
    "category": "${category}",
    "question": "Soru metni?",
    "optionA": "A şıkkı",
    "optionB": "B şıkkı",
    "optionC": "C şıkkı",
    "optionD": "D şıkkı",
    "correctOption": "A",
    "points": 100,
    "explanation": "Doğru cevabın ilginç açıklaması",
    "difficulty": "medium"
  }
]`;

    // Sabit model adı yerine çalışan modeli bul: bazı modeller yeni
    // hesaplara kapalı ve 404 dönüyor.
    const triviaModel = await geminiCoHost.resolveModel(ai);
    const aiRes = await ai.models.generateContent({
      model: triviaModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    let rawText = aiRes.text?.trim() || '';
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedQuestions = JSON.parse(rawText);
    if (!Array.isArray(parsedQuestions)) {
      throw new Error('AI cevabı geçerli bir JSON dizisi formatında değil.');
    }

    const inserted: any[] = [];
    const insertStmt = db.prepare(`
      INSERT INTO trivia_questions (id, category, question, option_a, option_b, option_c, option_d, correct_option, points, explanation, difficulty, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const q of parsedQuestions) {
      if (q.question && q.optionA && q.optionB && q.optionC && q.optionD && q.correctOption) {
        const id = uuidv4();
        insertStmt.run(
          id,
          q.category || category,
          q.question,
          q.optionA,
          q.optionB,
          q.optionC,
          q.optionD,
          q.correctOption.toUpperCase(),
          q.points || 100,
          q.explanation || '',
          q.difficulty || 'medium',
          Date.now()
        );
        inserted.push({ id, ...q });
      }
    }

    res.json({
      success: true,
      count: inserted.length,
      questions: inserted
    });
  } catch (err: any) {
    console.error('[AI Trivia Generator Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Yapay zeka soruları üretilirken hata oluştu.' });
  }
});

export default router;
