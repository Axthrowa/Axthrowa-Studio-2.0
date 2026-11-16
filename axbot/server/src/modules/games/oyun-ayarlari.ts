/**
 * Mini Oyunlar paneli ile oyun motoru arasındaki ayar çevirisi (saf).
 *
 * Panel `soygun.minBet` gibi kendi adlarıyla kaydediyor, motor `heist.minBet` okuyordu: paneldeki
 * hiçbir ayar (oyunu kapatmak dahil) oyunlara ulaşmıyordu. Panel yalnız gerçekten etkisi olan alanları görür.
 */
import type { GameSettings } from './games.js';

/** Paneldeki oyun kimliği → motordaki adı */
export const PANEL_OYUNU: Record<string, string> = { soygun: 'heist', yaris: 'race', kelime: 'anagram', trivia: 'trivia' };

const sayi = (v: unknown, onceki: number, enAz = 1): number => {
  const n = Number(v);
  return v === undefined || v === null || !Number.isFinite(n) ? onceki : Math.max(enAz, Math.floor(n));
};

export function panelAyari(s: GameSettings) {
  const e = s.enabledGames;
  return {
    soygun: { enabled: e.heist, minBet: s.heist.minBet, maxBet: s.heist.maxBet, cooldownSec: s.heist.countdownSeconds },
    yaris: { enabled: e.race, minBet: s.race.minBet, maxBet: s.race.maxBet, cooldownSec: s.race.countdownSeconds },
    trivia: { enabled: e.trivia, timeoutSec: s.trivia.durationSeconds },
    kelime: { enabled: e.anagram, showHint: s.anagram.showHint !== false, rewardPoints: s.anagram.rewardPoints, timeoutSec: s.anagram.durationSeconds },
    balik: { enabled: e.fishing, cooldownSec: s.fishing.cooldownSeconds },
    kasa: { enabled: e.lootbox, cost: s.lootbox.cost },
    bomba: { enabled: e.bomb, cooldownSec: s.bomb.cooldownSeconds },
    zar: { enabled: e.dice, minBet: s.dice.minBet, maxBet: s.dice.maxBet },
    yazi_tura: { enabled: e.coinflip, minBet: s.coinflip.minBet, maxBet: s.coinflip.maxBet },
    duello: { enabled: e.duel, minBet: s.duel.minBet, maxBet: s.duel.maxBet }
  };
}

export function panelden(s: GameSettings, p: Record<string, any> | null | undefined): GameSettings {
  const o = p || {};
  const acik = (k: string, onceki: boolean) => (typeof o[k]?.enabled === 'boolean' ? o[k].enabled : onceki);
  const aralik = (k: string, onceki: { minBet: number; maxBet: number }) => {
    const minBet = sayi(o[k]?.minBet, onceki.minBet);
    return { minBet, maxBet: Math.max(minBet, sayi(o[k]?.maxBet, onceki.maxBet)) };
  };
  return {
    ...s,
    enabledGames: {
      heist: acik('soygun', s.enabledGames.heist),
      race: acik('yaris', s.enabledGames.race),
      trivia: acik('trivia', s.enabledGames.trivia),
      anagram: acik('kelime', s.enabledGames.anagram),
      fishing: acik('balik', s.enabledGames.fishing),
      lootbox: acik('kasa', s.enabledGames.lootbox),
      bomb: acik('bomba', s.enabledGames.bomb),
      dice: acik('zar', s.enabledGames.dice),
      coinflip: acik('yazi_tura', s.enabledGames.coinflip),
      duel: acik('duello', s.enabledGames.duel)
    },
    heist: { ...s.heist, ...aralik('soygun', s.heist), countdownSeconds: sayi(o.soygun?.cooldownSec, s.heist.countdownSeconds, 5) },
    race: { ...s.race, ...aralik('yaris', s.race), countdownSeconds: sayi(o.yaris?.cooldownSec, s.race.countdownSeconds, 5) },
    trivia: { ...s.trivia, durationSeconds: sayi(o.trivia?.timeoutSec, s.trivia.durationSeconds, 5) },
    anagram: { showHint: typeof o.kelime?.showHint === 'boolean' ? o.kelime.showHint : s.anagram.showHint, rewardPoints: sayi(o.kelime?.rewardPoints, s.anagram.rewardPoints, 0), durationSeconds: sayi(o.kelime?.timeoutSec, s.anagram.durationSeconds, 5) },
    fishing: { ...s.fishing, cooldownSeconds: sayi(o.balik?.cooldownSec, s.fishing.cooldownSeconds, 0) },
    lootbox: { ...s.lootbox, cost: sayi(o.kasa?.cost, s.lootbox.cost) },
    bomb: { cooldownSeconds: sayi(o.bomba?.cooldownSec, s.bomb.cooldownSeconds, 5) },
    dice: aralik('zar', s.dice),
    coinflip: aralik('yazi_tura', s.coinflip),
    duel: aralik('duello', s.duel)
  };
}
