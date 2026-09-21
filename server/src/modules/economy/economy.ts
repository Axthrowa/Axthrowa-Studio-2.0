import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessagePayload, eventBus } from '../../core/event-bus.js';
import { ttsEngine } from '../tts/tts.js';

interface ActiveDuel {
  challenger: string;
  target: string;
  amount: number;
  platform: string;
  createdAt: number;
}

export class EconomyEngine {
  private activeDuels: Map<string, ActiveDuel> = new Map();
  private userCache: Map<string, { data: any; lastDbUpdate: number }> = new Map();

  calculateTier(points: number = 0, watchTimeMinutes: number = 0, subsCount: number = 0): string {
    const score = points + (watchTimeMinutes * 2) + (subsCount * 500);
    if (score >= 50000) return '👑 Efsane';
    if (score >= 15000) return '💎 Elmas';
    if (score >= 5000) return '🥇 Altın';
    if (score >= 1500) return '🥈 Gümüş';
    return '🥉 Çaylak';
  }

  getUser(platform: string, username: string, displayName?: string) {
    const cleanUser = username.toLowerCase();
    const now = Date.now();
    const cached = this.userCache.get(cleanUser);

    if (cached) {
      if (now - cached.lastDbUpdate > 180000) { // Update SQLite once every 3 mins per user
        cached.lastDbUpdate = now;
        cached.data.last_active = now;
        if (displayName) cached.data.display_name = displayName;
        try {
          db.prepare(`
            UPDATE economy SET 
              last_active = ?, display_name = ?, points = ?, watch_time_minutes = ?,
              messages_count = ?, subs_count = ?, gifted_subs_count = ?, tips_amount = ?, loyalty_tier = ?
            WHERE id = ?
          `).run(
            now, displayName || username, cached.data.points, cached.data.watch_time_minutes,
            cached.data.messages_count || 0, cached.data.subs_count || 0, cached.data.gifted_subs_count || 0,
            cached.data.tips_amount || 0, cached.data.loyalty_tier || '🥉 Çaylak', cached.data.id
          );
        } catch {}
      }
      return cached.data;
    }

    let row = db.prepare('SELECT * FROM economy WHERE username = ? COLLATE NOCASE').get(cleanUser) as any;

    if (!row) {
      const id = uuidv4();
      const initialPoints = 100;
      const initialTier = '🥉 Çaylak';
      try {
        db.prepare(`
          INSERT INTO economy (
            id, platform, username, display_name, points, watch_time_minutes,
            messages_count, subs_count, gifted_subs_count, tips_amount, loyalty_tier, last_active
          )
          VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?)
        `).run(id, platform, cleanUser, displayName || username, initialPoints, initialTier, now);
      } catch {
        // Fallback for older schema if migration was pending
        db.prepare(`
          INSERT INTO economy (id, platform, username, display_name, points, watch_time_minutes, last_active)
          VALUES (?, ?, ?, ?, ?, 0, ?)
        `).run(id, platform, cleanUser, displayName || username, initialPoints, now);
      }

      row = { 
        id, 
        platform, 
        username: cleanUser, 
        display_name: displayName || username, 
        points: initialPoints, 
        watch_time_minutes: 0,
        messages_count: 0,
        subs_count: 0,
        gifted_subs_count: 0,
        tips_amount: 0,
        loyalty_tier: initialTier,
        last_active: now 
      };
    }

    this.userCache.set(cleanUser, { data: row, lastDbUpdate: now });
    return row;
  }

  // --- LOYALTY TRACKING TRIGGERS ---

  recordMessage(message: ChatMessagePayload) {
    if (!message.user || !message.user.username) return;
    const user = this.getUser(message.platform, message.user.username, message.user.displayName);
    
    user.messages_count = (user.messages_count || 0) + 1;

    // Check setting for points per message (default 2)
    const ppmRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'points_per_message'").get() as any;
    const ppm = ppmRow ? parseInt(ppmRow.value, 10) : 2;
    const bonus = isNaN(ppm) ? 2 : ppm;

    user.points = (user.points || 0) + bonus;
    user.loyalty_tier = this.calculateTier(user.points, user.watch_time_minutes, user.subs_count);
  }

  recordSub(username: string, platform: string, isGift: boolean = false, count: number = 1, recipient?: string) {
    const cleanUser = username.toLowerCase();
    const user = this.getUser(platform, cleanUser);

    if (isGift) {
      user.gifted_subs_count = (user.gifted_subs_count || 0) + count;
      const rateRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'points_per_gifted_sub'").get() as any;
      const rate = rateRow ? parseInt(rateRow.value, 10) : 1000;
      const award = (isNaN(rate) ? 1000 : rate) * count;
      user.points = (user.points || 0) + award;
    } else {
      user.subs_count = (user.subs_count || 0) + 1;
      const rateRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'points_per_sub'").get() as any;
      const rate = rateRow ? parseInt(rateRow.value, 10) : 500;
      user.points = (user.points || 0) + (isNaN(rate) ? 500 : rate);
    }

    user.loyalty_tier = this.calculateTier(user.points, user.watch_time_minutes, user.subs_count);
  }

  recordTip(username: string, platform: string, amount: number) {
    const cleanUser = username.toLowerCase();
    const user = this.getUser(platform, cleanUser);

    user.tips_amount = (user.tips_amount || 0) + amount;
    const rateRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'points_per_tip_unit'").get() as any;
    const rate = rateRow ? parseInt(rateRow.value, 10) : 50;
    const bonus = Math.round(amount * (isNaN(rate) ? 50 : rate));
    user.points = (user.points || 0) + bonus;

    user.loyalty_tier = this.calculateTier(user.points, user.watch_time_minutes, user.subs_count);
  }

  /**
   * İzleme süresi ve düzenli puan tiki.
   *
   * Bu metot tanımlıydı ama HİÇBİR YERDEN çağrılmıyordu: `watch_time_minutes`
   * hep 0 kalıyor, Rankings'teki "Watchtime" sekmesi boş görünüyordu
   * ("Rankings watchtime çalışmıyor"). Artık `startWatchTimeLoop` ile
   * düzenli çalışır ve yalnız SON ARALIKTA aktif olanlara yazar — kapanmış
   * sohbetlere saatlerce süre eklenmesin.
   */
  recordWatchTime(intervalMinutes: number = 5): number {
    const rateRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'points_per_interval'").get() as any;
    const basePoints = rateRow ? parseInt(rateRow.value, 10) : 15;
    const esik = Date.now() - intervalMinutes * 60_000 * 2;

    let sayac = 0;
    for (const [, cached] of this.userCache.entries()) {
      const u = cached.data;
      if (!u) continue;
      const sonHareket = Number(u.last_active) || 0;
      if (sonHareket && sonHareket < esik) continue;
      u.watch_time_minutes = (u.watch_time_minutes || 0) + intervalMinutes;
      u.points = (u.points || 0) + basePoints;
      u.loyalty_tier = this.calculateTier(u.points, u.watch_time_minutes, u.subs_count);
      sayac++;
    }
    // Sıralama tablosu diskten okuduğu için hemen yaz.
    if (sayac) this.flushAll();
    return sayac;
  }

  private watchTimer: NodeJS.Timeout | null = null;

  /** Açılışta bir kez çağrılır; izleme süresi sayacını başlatır. */
  startWatchTimeLoop(intervalMinutes: number = 5) {
    if (this.watchTimer) return;
    this.watchTimer = setInterval(() => {
      try {
        const n = this.recordWatchTime(intervalMinutes);
        if (n) console.log(`[Economy] izleme süresi: ${n} aktif izleyiciye +${intervalMinutes} dk`);
      } catch (err) {
        console.warn('[Economy] izleme süresi tiki:', (err as Error).message);
      }
    }, intervalMinutes * 60_000);
  }

  /**
   * Puan ekler ve YENİ bakiyeyi döndürür.
   *
   * Çağıranlar eskiden bakiyeyi kendileri hesaplıyordu (`user.points + amount`).
   * `user` nesnesi önbellekteki satırın TA KENDİSİ olduğu ve bu metot onu zaten
   * güncellediği için sohbete yazılan toplam iki kez sayılıyordu. Artık gerçek
   * bakiye buradan döner.
   */
  addPoints(username: string, amount: number): number {
    const cleanUser = username.toLowerCase();
    const res = db
      .prepare('UPDATE economy SET points = MAX(0, points + ?) WHERE username = ? COLLATE NOCASE')
      .run(amount, cleanUser);
    // Satır yoksa puan sessizce kayboluyordu; kullanıcıyı oluştur.
    if (!res.changes) {
      this.getUser('kick', cleanUser);
      db.prepare('UPDATE economy SET points = MAX(0, points + ?) WHERE username = ? COLLATE NOCASE').run(amount, cleanUser);
    }
    const cached = this.userCache.get(cleanUser);
    if (cached) {
      cached.data.points = Math.max(0, (cached.data.points || 0) + amount);
      cached.data.loyalty_tier = this.calculateTier(cached.data.points, cached.data.watch_time_minutes, cached.data.subs_count);
      return cached.data.points;
    }
    return this.getUserPoints(cleanUser);
  }

  /** Puan düşer ve YENİ bakiyeyi döndürür. */
  removePoints(username: string, amount: number): number {
    return this.addPoints(username, -Math.abs(amount));
  }

  deductPoints(username: string, amount: number) {
    this.removePoints(username, amount);
  }

  awardPoints(username: string, _disp: string, amount: number) {
    this.addPoints(username, amount);
  }

  /**
   * Bellekteki bütün kullanıcıları diske yazar.
   *
   * Puanlar önbellekte tutulup SQLite'a kullanıcı başına 3 dakikada bir
   * yazılıyordu; sıralama tablosu doğrudan tablodan okuduğu için dakikalarca
   * bayat kalıyordu ("Rankings düzgün çalışmıyor"). Sıralama okunmadan önce
   * çağrılır.
   */
  flushAll() {
    const now = Date.now();
    for (const [, cached] of this.userCache.entries()) {
      const d = cached.data;
      if (!d?.id) continue;
      try {
        db.prepare(
          `UPDATE economy SET last_active = ?, display_name = ?, points = ?, watch_time_minutes = ?,
             messages_count = ?, subs_count = ?, gifted_subs_count = ?, tips_amount = ?, loyalty_tier = ?
           WHERE id = ?`,
        ).run(
          d.last_active || now,
          d.display_name || d.username,
          d.points || 0,
          d.watch_time_minutes || 0,
          d.messages_count || 0,
          d.subs_count || 0,
          d.gifted_subs_count || 0,
          d.tips_amount || 0,
          d.loyalty_tier || '🥉 Çaylak',
          d.id,
        );
        cached.lastDbUpdate = now;
      } catch {
        /* tek kullanıcı yazılamazsa diğerleri sürsün */
      }
    }
  }

  /**
   * Yayıncının elle puan vermesi/alması. Dönen değer yeni bakiye.
   * Yetki denetimi komut katmanında yapılır.
   */
  grantPoints(targetRaw: string, amount: number): { user: string; total: number } {
    const target = String(targetRaw || '').replace('@', '').trim().toLowerCase();
    const total = this.addPoints(target, amount);
    return { user: target, total };
  }

  getUserPoints(username: string): number {
    const cleanUser = username.toLowerCase();
    const cached = this.userCache.get(cleanUser);
    if (cached) return cached.data.points || 0;
    const row = db.prepare('SELECT points FROM economy WHERE username = ? COLLATE NOCASE').get(cleanUser) as any;
    return row ? row.points : 0;
  }


  // --- COMMAND HANDLERS ---

  handlePointsCommand(message: ChatMessagePayload): string {
    const user = this.getUser(message.platform, message.user.username, message.user.displayName);
    const currencyNameRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'currency_name'").get() as { value: string } | undefined;
    const currency = currencyNameRow?.value || 'Puan';
    const tier = user.loyalty_tier || this.calculateTier(user.points, user.watch_time_minutes, user.subs_count);
    return `@${message.user.displayName}, [${tier}] toplam ${user.points} ${currency}'in var! 💰`;
  }

  handleProfileCommand(message: ChatMessagePayload): string {
    const user = this.getUser(message.platform, message.user.username, message.user.displayName);
    const currencyNameRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'currency_name'").get() as { value: string } | undefined;
    const currency = currencyNameRow?.value || 'Puan';

    const hours = Math.floor((user.watch_time_minutes || 0) / 60);
    const mins = (user.watch_time_minutes || 0) % 60;
    const tier = user.loyalty_tier || this.calculateTier(user.points, user.watch_time_minutes, user.subs_count);

    return `👤 @${message.user.displayName} [${tier}] | ` +
      `Bakiye: ${user.points} ${currency} 💰 | ` +
      `İzleme: ${hours}sa ${mins}dk ⏱️ | ` +
      `Mesaj: ${user.messages_count || 0} 💬 | ` +
      `Abonelik: ${user.subs_count || 0} ⭐ | ` +
      `Hediye: ${user.gifted_subs_count || 0} 🎁`;
  }

  handleStoreCommand(): string {
    try {
      const items = db.prepare('SELECT title, cost, id FROM loyalty_rewards WHERE is_enabled = 1 LIMIT 6').all() as any[];
      if (!items || items.length === 0) {
        return '🛍️ Sadakat Mağazası: !al tts (150 Puan) | !al korna (100 Puan) | !al alkis (75 Puan) | !al kedi (120 Puan) | !al vip (2500 Puan)';
      }
      const list = items.map(i => `!al ${i.id.replace('reward-', '')} (${i.cost} Puan)`).join(' | ');
      return `🛍️ SADAKAT MAĞAZASI: ${list} 🎁 (Kullanmak için: !al <kod> [mesaj])`;
    } catch {
      return '🛍️ Sadakat Mağazası: !al tts (150 Puan) | !al korna (100 Puan) | !al alkis (75 Puan)';
    }
  }

  handleRedeemCommand(message: ChatMessagePayload, args: string[]): string {
    const itemCode = args[0]?.toLowerCase();
    if (!itemCode) {
      return `@${message.user.displayName}, hangi ödülü almak istiyorsun? Listeyi görmek için: !market`;
    }

    const user = this.getUser(message.platform, message.user.username, message.user.displayName);
    const searchId = itemCode.startsWith('reward-') ? itemCode : `reward-${itemCode}`;
    
    let reward = db.prepare('SELECT * FROM loyalty_rewards WHERE id = ? AND is_enabled = 1').get(searchId) as any;
    if (!reward) {
      reward = db.prepare('SELECT * FROM loyalty_rewards WHERE title LIKE ? AND is_enabled = 1').get(`%${itemCode}%`) as any;
    }

    if (!reward) {
      return `@${message.user.displayName}, "${itemCode}" kodlu ödül bulunamadı! Mevcut ödüller için: !market`;
    }

    if (user.points < reward.cost) {
      return `@${message.user.displayName}, bu ödül için yeterli puanın yok! Gereken: ${reward.cost} Puan | Bakiyen: ${user.points} 💰`;
    }

    // Deduct points
    this.removePoints(message.user.username, reward.cost);

    const payloadText = args.slice(1).join(' ').trim();
    const redemptionId = `red_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // 1. Record redemption in database for dashboard approval queue
    try {
      db.prepare(`
        INSERT INTO loyalty_redemptions (id, platform, username, display_name, reward_id, reward_title, cost, custom_input, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        redemptionId,
        message.platform,
        message.user.username,
        message.user.displayName,
        reward.id,
        reward.title,
        reward.cost,
        payloadText || null,
        Date.now()
      );
    } catch (e) {
      console.warn('[Economy] Could not save redemption row:', e);
    }

    // 2. Automated Action: TTS Voice
    if (reward.reward_type === 'tts' || payloadText) {
      const speech = payloadText || `${message.user.displayName}, ${reward.title} ödülünü aldı!`;
      ttsEngine.enqueue(speech, message.user.displayName);
    }

    // 3. Forward reward trigger event to WebSocket for OBS overlay
    eventBus.emit('loyalty_redeemed', {
      id: redemptionId,
      user: message.user.displayName,
      rewardId: reward.id,
      rewardTitle: reward.title,
      rewardType: reward.reward_type,
      cost: reward.cost,
      payload: payloadText || reward.payload,
      timestamp: Date.now()
    });

    return `🎉 TEBRİKLER @${message.user.displayName}! "${reward.title}" ödülünü ${reward.cost} puan karşılığında satın aldın! Ekranda aktif edildi! 🌟`;
  }

  handleLeaderboardCommand(): string {
    const top = db.prepare('SELECT display_name, points, loyalty_tier FROM economy ORDER BY points DESC LIMIT 5').all() as Array<{ display_name: string; points: number; loyalty_tier?: string }>;
    if (!top || top.length === 0) return 'Henüz puan tablosunda kimse yok.';

    const currencyNameRow = db.prepare("SELECT value FROM bot_settings WHERE key = 'currency_name'").get() as { value: string } | undefined;
    const currency = currencyNameRow?.value || 'Puan';

    const list = top.map((u, i) => `${i + 1}. [${u.loyalty_tier || '🥉'}] ${u.display_name} (${u.points} ${currency})`).join(' | ');
    return `🏆 Zenginler Sıralaması: ${list}`;
  }

  handleRoulette(message: ChatMessagePayload, args: string[]): string {
    const user = this.getUser(message.platform, message.user.username, message.user.displayName);
    const amountStr = args[0]?.toLowerCase();

    let amount = 0;
    if (amountStr === 'hepsi' || amountStr === 'all') {
      amount = user.points;
    } else {
      amount = parseInt(amountStr, 10);
    }

    if (isNaN(amount) || amount <= 0) {
      return `@${message.user.displayName}, geçerli bir bahis miktarı girmelisin! Örnek: !rulet 50 veya !rulet hepsi`;
    }

    if (user.points < amount) {
      return `@${message.user.displayName}, yeterli puanın yok! Bakiyen: ${user.points}`;
    }

    const won = Math.random() >= 0.5;
    if (won) {
      const newTotal = this.addPoints(message.user.username, amount);
      return `🎉 @${message.user.displayName}, ruleti KAZANDIN! +${amount} puan kazandın! Yeni bakiyen: ${newTotal} 💰`;
    } else {
      const newTotal = this.removePoints(message.user.username, amount);
      return `💀 @${message.user.displayName}, ruleti KAYBETTİN! -${amount} puan gitti. Yeni bakiyen: ${newTotal} 💸`;
    }
  }

  handleSlots(message: ChatMessagePayload, args: string[]): string {
    const user = this.getUser(message.platform, message.user.username, message.user.displayName);
    const amount = parseInt(args[0], 10);

    if (isNaN(amount) || amount <= 0) {
      return `@${message.user.displayName}, lütfen oynamak istediğin miktarı yaz! Örnek: !slot 25`;
    }

    if (user.points < amount) {
      return `@${message.user.displayName}, yeterli puanın yok! Bakiyen: ${user.points}`;
    }

    const symbols = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
    const s1 = symbols[Math.floor(Math.random() * symbols.length)];
    const s2 = symbols[Math.floor(Math.random() * symbols.length)];
    const s3 = symbols[Math.floor(Math.random() * symbols.length)];

    const machineView = `🎰 [ ${s1} | ${s2} | ${s3} ]`;

    // Bahis her durumda çekilir; ikramiye bahsin KATI olarak geri ödenir.
    // Eskiden bahis hiç düşülmüyordu: iki simge tutturmak bile bedava kârdı ve
    // sohbette yazılan kazanç gerçek bakiyeyle tutmuyordu.
    this.removePoints(message.user.username, amount);
    if (s1 === s2 && s2 === s3) {
      const payout = amount * 5;
      const newTotal = this.addPoints(message.user.username, payout);
      return `${machineView} 💥 BÜYÜK İKRAMİYE! @${message.user.displayName} üçünü de tutturdu, net +${payout - amount} puan! Bakiye: ${newTotal} 🤑`;
    } else if (s1 === s2 || s2 === s3 || s1 === s3) {
      const payout = amount * 2;
      const newTotal = this.addPoints(message.user.username, payout);
      return `${machineView} ✨ Tebrikler @${message.user.displayName}, ikisini tutturdun! Net +${payout - amount} puan. Bakiye: ${newTotal}`;
    } else {
      const newTotal = this.getUserPoints(message.user.username);
      return `${machineView} 😢 Ah be @${message.user.displayName}, tutturamadın! -${amount} puan. Bakiye: ${newTotal}`;
    }
  }

  handleDuel(message: ChatMessagePayload, args: string[]): string {
    const user = this.getUser(message.platform, message.user.username, message.user.displayName);
    const targetTag = args[0];
    const amount = parseInt(args[1], 10);

    if (!targetTag || isNaN(amount) || amount <= 0) {
      return `@${message.user.displayName}, düello başlatmak için: !duello @hedef_kisi <miktar>`;
    }

    const targetUserClean = targetTag.replace('@', '').toLowerCase();
    if (targetUserClean === message.user.username.toLowerCase()) {
      return `@${message.user.displayName}, kendine meydan okuyamazsın! 😄`;
    }

    if (user.points < amount) {
      return `@${message.user.displayName}, bu düelloya girecek kadar puanın yok! Bakiyen: ${user.points}`;
    }

    const targetUser = this.getUser(message.platform, targetUserClean);
    if (targetUser.points < amount) {
      return `@${message.user.displayName}, meydan okuduğun kişinin (${targetTag}) yeterli puanı yok!`;
    }

    const duelKey = `${message.platform}_${targetUserClean}_${message.user.username.toLowerCase()}`;
    const reverseKey = `${message.platform}_${message.user.username.toLowerCase()}_${targetUserClean}`;

    if (this.activeDuels.has(reverseKey)) {
      const duel = this.activeDuels.get(reverseKey)!;
      this.activeDuels.delete(reverseKey);

      const challengerWins = Math.random() >= 0.5;
      if (challengerWins) {
        this.addPoints(duel.challenger, duel.amount);
        this.removePoints(message.user.username, duel.amount);
        return `⚔️ DÜELLO BİTTİ! @${duel.challenger} ile @${message.user.displayName} arasındaki kılıç savaşını @${duel.challenger} kazandı ve ${duel.amount * 2} puanı kaptı! 🏆`;
      } else {
        this.addPoints(message.user.username, duel.amount);
        this.removePoints(duel.challenger, duel.amount);
        return `⚔️ DÜELLO BİTTİ! @${message.user.displayName}, @${duel.challenger} karşısında galip geldi ve ${duel.amount * 2} puanı kaptı! 🏆`;
      }
    }

    this.activeDuels.set(duelKey, {
      challenger: message.user.username,
      target: targetUserClean,
      amount,
      platform: message.platform,
      createdAt: Date.now()
    });

    return `⚔️ MEYDAN OKUMA! @${message.user.displayName}, ${targetTag} kullanıcısını ${amount} puanına düelloya davet etti! Kabul etmek için: !duello @${message.user.username} ${amount}`;
  }

  handle8Ball(message: ChatMessagePayload, args: string[]): string {
    if (!args || args.length === 0) {
      return `@${message.user.displayName}, sihirli 8-Ball'a bir soru sormalısın! Örnek: !8ball bu maç kazanılır mı?`;
    }

    const answers = [
      'Kesinlikle evet! 🟢',
      'Şüphesiz öyle. 🟢',
      'Buna güvenebilirsin. 🟢',
      'Gördüğüm kadarıyla evet. 🟢',
      'Büyük ihtimalle. 🟢',
      'Şu an kestiremiyorum, sonra tekrar sor. 🟡',
      'Daha iyi odaklanıp tekrar dene. 🟡',
      'Bunu sana şimdi söylemesem daha iyi. 🟡',
      'Cevabım hayır. 🔴',
      'Kaynaklarım öyle olmadığını söylüyor. 🔴',
      'Pek olası görünmüyor. 🔴',
      'Hiç sanmıyorum dostum! 🔴'
    ];

    const answer = answers[Math.floor(Math.random() * answers.length)];
    return `🎱 8-Ball diyor ki: "${answer}"`;
  }
}

export const economy = new EconomyEngine();
export default economy;
