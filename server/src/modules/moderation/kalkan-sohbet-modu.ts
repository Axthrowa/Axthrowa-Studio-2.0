/**
 * Kalkan ↔ platformun kendi sohbet modları (B12).
 *
 * Bot gelen mesajda takip durumunu ya da hesap yaşını göremez; "Yalnız takipçi" kuralını platformun kendisi
 * uygulayabilir. Bugün yalnız Twitch Helix sohbet modlarını açıp kapatmaya izin veriyor (Kick ve YouTube'un
 * resmi API'sinde yok; Twitch'te de hesap yaşı modu API'de yok). Kalkan açılınca takipçi / abone / yavaş mod
 * açılır; kapanınca YALNIZ kalkanın açtıkları kapanır (yayıncının zaten açık tuttuğu moda dokunulmaz).
 */
import type { ShieldModeSettings } from '../../db/schema.js';
import { TAKIPCI_MOD_UST_DK, YAVAS_MOD_ARALIK } from '../../platforms/twitch-rules.js';

export type KalkanModu = 'follower_mode' | 'subscriber_mode' | 'slow_mode';
export type MevcutModlar = Partial<Record<KalkanModu, boolean>>;

export const VARSAYILAN_TAKIP_SURESI_DK = 10;

/** Kalkan açılırken gönderilecek Helix gövdesi ve kalkanın açtığı modlar. `mevcut` okunamadıysa null: hepsi kapalı sayılır. */
export function kalkanAcilisGovdesi(ayar: ShieldModeSettings, mevcut: MevcutModlar | null): { govde: Record<string, boolean | number>; acilan: KalkanModu[] } {
  const govde: Record<string, boolean | number> = {};
  const acilan: KalkanModu[] = [];
  if (ayar.platformModlari === false) return { govde, acilan };
  if (ayar.followerOnly && !mevcut?.follower_mode) {
    const dk = Math.round(Number(ayar.takipSuresiDk ?? VARSAYILAN_TAKIP_SURESI_DK));
    govde.follower_mode = true;
    govde.follower_mode_duration = Number.isFinite(dk) ? Math.min(TAKIPCI_MOD_UST_DK, Math.max(0, dk)) : VARSAYILAN_TAKIP_SURESI_DK;
    acilan.push('follower_mode');
  }
  if (ayar.subOnly && !mevcut?.subscriber_mode) {
    govde.subscriber_mode = true;
    acilan.push('subscriber_mode');
  }
  const sn = Math.round(Number(ayar.yavasModSn) || 0);
  if (sn >= YAVAS_MOD_ARALIK[0] && !mevcut?.slow_mode) {
    govde.slow_mode = true;
    govde.slow_mode_wait_time = Math.min(YAVAS_MOD_ARALIK[1], sn);
    acilan.push('slow_mode');
  }
  return { govde, acilan };
}

/** Kalkan kapanırken: yalnız kalkanın açtığı modlar kapanır. Kapatılacak yoksa null. */
export function kalkanKapanisGovdesi(acilan: readonly string[] | undefined): Record<string, boolean> | null {
  const gecerli = (acilan || []).filter((m): m is KalkanModu => m === 'follower_mode' || m === 'subscriber_mode' || m === 'slow_mode');
  if (!gecerli.length) return null;
  return Object.fromEntries(gecerli.map((m) => [m, false]));
}

export interface SohbetModuPlatformu {
  isConnected(): boolean;
  sohbetAyarlari(): Promise<MevcutModlar | null>;
  sohbetModu(govde: Record<string, boolean | number>): Promise<{ ok: boolean; hata?: string }>;
}

export interface KalkanModDeposu {
  getSettings(): ShieldModeSettings;
  saveSettings(s: Partial<ShieldModeSettings>): unknown;
  addAuditLog(action: string, moderator: string, details?: string, target?: string, severity?: 'info' | 'warn' | 'danger'): unknown;
}

const AD: Record<KalkanModu, string> = { follower_mode: 'takipçi modu', subscriber_mode: 'abone modu', slow_mode: 'yavaş mod' };

/** Kalkan açıldı/kapandı: Twitch sohbet modlarını uygular, açılanları ayara yazar, sonucu denetim günlüğüne düşer. */
export async function kalkanSohbetModlariniUygula(acik: boolean, twitch: SohbetModuPlatformu | undefined, depo: KalkanModDeposu): Promise<void> {
  const ayar = depo.getSettings();
  if (!twitch?.isConnected()) {
    if (acik && ayar.platformModlari !== false && (ayar.followerOnly || ayar.subOnly)) {
      depo.addAuditLog('SHIELD_CHAT_MODE', 'Kalkan', 'Twitch bağlı değil: platform sohbet modları açılmadı.', undefined, 'warn');
    }
    return;
  }
  if (acik) {
    const { govde, acilan } = kalkanAcilisGovdesi(ayar, await twitch.sohbetAyarlari().catch(() => null));
    if (!acilan.length) return;
    const r = await twitch.sohbetModu(govde);
    if (r.ok) depo.saveSettings({ twitchAcilanModlar: acilan });
    depo.addAuditLog(
      'SHIELD_CHAT_MODE',
      'Kalkan',
      `Twitch: ${acilan.map((m) => AD[m]).join(', ')} ${r.ok ? 'açıldı' : `açılamadı — ${r.hata || 'bilinmeyen hata'}`}`,
      undefined,
      r.ok ? 'info' : 'warn'
    );
    return;
  }
  const govde = kalkanKapanisGovdesi(ayar.twitchAcilanModlar);
  if (!govde) return;
  const r = await twitch.sohbetModu(govde);
  // Kapatılamadıysa liste kalır: bir sonraki kapanışta yeniden denenir
  if (r.ok) depo.saveSettings({ twitchAcilanModlar: [] });
  const adlar = Object.keys(govde).map((m) => AD[m as KalkanModu]).join(', ');
  depo.addAuditLog('SHIELD_CHAT_MODE', 'Kalkan', `Twitch: ${adlar} ${r.ok ? 'kapatıldı' : `kapatılamadı — ${r.hata || 'bilinmeyen hata'}`}`, undefined, r.ok ? 'info' : 'warn');
}
