import axios from 'axios';
import { db } from '../db/index.js';
import { ChatMessagePayload } from './event-bus.js';

import { canliDurum, sureMetni } from './live-status.js';

/**
 * YEDEK başlangıç: yalnız hiçbir platform yayın durumu bildirmiyorsa
 * kullanılır. Eskiden TEK kaynak buydu ve botun açılış anıydı — `!uptime`
 * yayının değil botun süresini söylüyordu.
 */
let streamStartTime = Date.now();

export function setStreamStartTime(time: number) {
  streamStartTime = time;
}

/**
 * Yayın süresi.
 *   • Yayın açık ve başlangıç biliniyor → gerçek süre
 *   • Yayın kapalı (bir platform kapalı dedi) → "yayın kapalı"
 *   • Hiçbir platform durum bildirmiyor → eski davranış (bot açılışı),
 *     geriye uyum için; algılama olmayan kurulumda da boş dönmesin.
 */
export function getStreamUptime(): string {
  const g = canliDurum.genel();
  if (g.canli === true && g.baslangic) return sureMetni(Date.now() - g.baslangic);
  if (g.canli === false) return 'yayın kapalı';
  return sureMetni(Date.now() - streamStartTime);
}

/** `!uptime` için: yayın açık mı, bilinmiyor mu? */
export function yayinAcikMi(): boolean | null {
  return canliDurum.genel().canli;
}

export async function parseVariables(
  template: string, 
  context: {
    message: ChatMessagePayload;
    commandName?: string;
    args?: string[];
    geminiCaller?: (prompt: string) => Promise<string>;
  }
): Promise<string> {
  let result = template;
  const { message, commandName, args = [], geminiCaller } = context;

  const rawArgs = args.join(' ');
  const user = message.user.displayName || message.user.username;
  const targetUser = args[0] ? args[0].replace('@', '') : user;

  // Support both {var} and $(var) syntax
  result = result.replace(/\{user\}/gi, user).replace(/\$\(user\)/gi, user);
  result = result.replace(/\{touser\}/gi, targetUser).replace(/\$\(touser\)/gi, targetUser);
  result = result.replace(/\{query\}/gi, rawArgs).replace(/\$\(query\)/gi, rawArgs);
  result = result.replace(/\{args\}/gi, rawArgs).replace(/\$\(args\)/gi, rawArgs);
  result = result.replace(/\{uptime\}/gi, getStreamUptime()).replace(/\$\(uptime\)/gi, getStreamUptime());
  result = result.replace(/\{platform\}/gi, message.platform.toUpperCase()).replace(/\$\(platform\)/gi, message.platform.toUpperCase());

  // $(1), $(2), ... and {1}, {2}, ...
  for (let i = 0; i < 9; i++) {
    const regDollar = new RegExp(`\\$\\(${i + 1}\\)`, 'g');
    const regBrace = new RegExp(`\\{${i + 1}\\}`, 'g');
    result = result.replace(regDollar, args[i] || '').replace(regBrace, args[i] || '');
  }

  // Persistent Named Counters: {count:counter_name} or $(count:counter_name)
  const namedCountRegex = /(?:\{count:([a-zA-Z0-9_\-]+)\}|\$\(count:([a-zA-Z0-9_\-]+)\))/gi;
  let countMatch;
  while ((countMatch = namedCountRegex.exec(result)) !== null) {
    const counterName = (countMatch[1] || countMatch[2]).toLowerCase();
    try {
      db.prepare(`
        INSERT INTO counters (name, count, updated_at) VALUES (?, 1, ?)
        ON CONFLICT(name) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at
      `).run(counterName, Date.now());
      const row = db.prepare('SELECT count FROM counters WHERE name = ?').get(counterName) as { count: number } | undefined;
      const val = row ? row.count : 1;
      result = result.replace(countMatch[0], val.toString());
    } catch {
      result = result.replace(countMatch[0], '1');
    }
  }

  // Random: {random:min-max} or $(random.min-max)
  result = result.replace(/(?:\{random:(\d+)-(\d+)\}|\$\(random\.(\d+)-(\d+)\))/gi, (_, min1, max1, min2, max2) => {
    const lo = parseInt(min1 || min2, 10);
    const hi = parseInt(max1 || max2, 10);
    return Math.floor(Math.random() * (hi - lo + 1) + lo).toString();
  });
  result = result.replace(/(?:\{random:(\d+)\}|\$\(random\.(\d+)\))/gi, (_, max1, max2) => {
    const hi = parseInt(max1 || max2, 10);
    return Math.floor(Math.random() * hi + 1).toString();
  });

  // Choose: {choose:opt1|opt2|opt3} or $(choose opt1|opt2|opt3)
  const chooseRegex = /(?:\{choose:([^}]+)\}|\$\(choose\s+([^\)]+)\))/gi;
  let chooseMatch;
  while ((chooseMatch = chooseRegex.exec(result)) !== null) {
    const optionsStr = chooseMatch[1] || chooseMatch[2] || '';
    const opts = optionsStr.split('|').map(s => s.trim()).filter(Boolean);
    if (opts.length > 0) {
      const chosen = opts[Math.floor(Math.random() * opts.length)];
      result = result.replace(chooseMatch[0], chosen);
    } else {
      result = result.replace(chooseMatch[0], '');
    }
  }

  // Points: {points}, {puan}, $(points), $(puan)
  if (result.includes('{points}') || result.includes('{puan}') || result.includes('$(points)') || result.includes('$(puan)')) {
    const userRow = db.prepare('SELECT points FROM economy WHERE username = ? COLLATE NOCASE').get(message.user.username) as { points: number } | undefined;
    const points = userRow ? userRow.points : 0;
    result = result.replace(/\{points\}/gi, points.toString());
    result = result.replace(/\{puan\}/gi, points.toString());
    result = result.replace(/\$\(points\)/gi, points.toString());
    result = result.replace(/\$\(puan\)/gi, points.toString());
  }

  // Simple command use count
  if (commandName) {
    const cmdCountRegex = /(?:\{count\}|\$\(count\))/gi;
    if (cmdCountRegex.test(result)) {
      try {
        db.prepare('UPDATE commands SET use_count = use_count + 1 WHERE name = ?').run(commandName.toLowerCase());
        const row = db.prepare('SELECT use_count FROM commands WHERE name = ?').get(commandName.toLowerCase()) as { use_count: number } | undefined;
        const currentCount = row ? row.use_count : 1;
        result = result.replace(/(?:\{count\}|\$\(count\))/gi, currentCount.toString());
      } catch {
        result = result.replace(/(?:\{count\}|\$\(count\))/gi, '1');
      }
    }
  }

  // {if:cond:then:else} conditional tag
  const ifRegex = /\{if:([^:]+):([^:]+):([^}]+)\}/gi;
  let ifMatch;
  while ((ifMatch = ifRegex.exec(result)) !== null) {
    const [full, cond, thenVal, elseVal] = ifMatch;
    let evalCondition = false;
    try {
      // Clean condition
      const cleanCond = cond.replace(/[^0-9><=!&|.]/g, '');
      // eslint-disable-next-line no-eval
      evalCondition = Boolean(Function(`"use strict"; return (${cleanCond});`)());
    } catch {}
    result = result.replace(full, evalCondition ? thenVal : elseVal);
  }

  // Math / Eval: {math:expr} or $(eval expr)
  const mathRegex = /(?:\{math:([^}]+)\}|\$\(eval\s+([^\)]+)\))/gi;
  let mathMatch;
  while ((mathMatch = mathRegex.exec(result)) !== null) {
    const expr = mathMatch[1] || mathMatch[2] || '';
    try {
      const sanitized = expr.replace(/[^0-9+\-*/().%]/g, '');
      // eslint-disable-next-line no-eval
      const evalResult = Function(`"use strict"; return (${sanitized});`)();
      result = result.replace(mathMatch[0], String(evalResult));
    } catch {
      result = result.replace(mathMatch[0], '[Hesap Hatası]');
    }
  }

  // URL Fetch: $(urlfetch <url>)
  const urlFetchRegex = /\$\(urlfetch\s+(https?:\/\/[^\)]+)\)/gi;
  let urlMatch;
  while ((urlMatch = urlFetchRegex.exec(result)) !== null) {
    const targetUrl = urlMatch[1];
    try {
      const response = await axios.get(targetUrl, { timeout: 3500 });
      const fetchedText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      result = result.replace(urlMatch[0], fetchedText.slice(0, 400));
    } catch {
      result = result.replace(urlMatch[0], '[API Hatası]');
    }
  }

  // AI Prompt: {ai:soru} or $(ai soru) or $(sor soru)
  const aiRegex = /(?:\{ai:([^}]+)\}|\$\((?:ai|sor)\s+([^\)]+)\))/gi;
  let aiMatch;
  while ((aiMatch = aiRegex.exec(result)) !== null) {
    const prompt = (aiMatch[1] || aiMatch[2] || '').trim();
    if (geminiCaller && prompt) {
      try {
        const aiAnswer = await geminiCaller(prompt);
        result = result.replace(aiMatch[0], aiAnswer);
      } catch {
        result = result.replace(aiMatch[0], 'AI yanıt veremedi.');
      }
    } else {
      result = result.replace(aiMatch[0], 'Gemini AI yapılandırılmamış.');
    }
  }

  return result.trim();
}

