import { describe, it, expect } from 'vitest';
import { sohbetModuGovdesi, TAKIPCI_MOD_UST_DK } from './twitch-rules.js';

describe('sohbetModuGovdesi (Twitch Update Chat Settings)', () => {
  it('yavaş mod: 0 kapatır, 3-120 sn açar; aralık dışı reddedilir', () => {
    expect(sohbetModuGovdesi({ yavasSn: 30 })).toEqual({ ok: true, govde: { slow_mode: true, slow_mode_wait_time: 30 } });
    expect(sohbetModuGovdesi({ yavasSn: 0 })).toEqual({ ok: true, govde: { slow_mode: false } });
    expect(sohbetModuGovdesi({ yavasSn: 3 }).ok).toBe(true);
    expect(sohbetModuGovdesi({ yavasSn: 120 }).ok).toBe(true);
    expect(sohbetModuGovdesi({ yavasSn: 2 }).ok).toBe(false);
    expect(sohbetModuGovdesi({ yavasSn: 121 }).ok).toBe(false);
    expect(sohbetModuGovdesi({ yavasSn: 1.5 }).ok).toBe(false);
  });

  it('takipçi modu: null/false kapatır, 0-129600 dk açar', () => {
    expect(sohbetModuGovdesi({ takipciDk: 10 })).toEqual({ ok: true, govde: { follower_mode: true, follower_mode_duration: 10 } });
    expect(sohbetModuGovdesi({ takipciDk: 0 })).toEqual({ ok: true, govde: { follower_mode: true, follower_mode_duration: 0 } });
    expect(sohbetModuGovdesi({ takipciDk: null })).toEqual({ ok: true, govde: { follower_mode: false } });
    expect(sohbetModuGovdesi({ takipciDk: false })).toEqual({ ok: true, govde: { follower_mode: false } });
    expect(sohbetModuGovdesi({ takipciDk: TAKIPCI_MOD_UST_DK + 1 }).ok).toBe(false);
    expect(sohbetModuGovdesi({ takipciDk: -1 }).ok).toBe(false);
  });

  it('abone / emote / benzersiz yalnız boolean; bilinmeyen alanlar gövdeye girmez', () => {
    expect(sohbetModuGovdesi({ abone: true, emote: false, benzersiz: true, broadcaster_id: '1', slow_mode_wait_time: 1 })).toEqual({
      ok: true,
      govde: { subscriber_mode: true, emote_mode: false, unique_chat_mode: true }
    });
    expect(sohbetModuGovdesi({ abone: 'evet' }).ok).toBe(false);
  });

  it('boş istek reddedilir', () => {
    expect(sohbetModuGovdesi({})).toEqual({ ok: false, hata: 'Değiştirilecek sohbet modu yok' });
    expect(sohbetModuGovdesi(null).ok).toBe(false);
  });
});
