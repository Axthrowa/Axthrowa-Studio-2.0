import { db } from '../../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { AuditLog, ShieldModeSettings } from '../../db/schema.js';
import { seyrekUyar } from '../../core/logger.js';
import { karaListeAdi, karaListeEslesir, karaListePlatformu, type KaraListePlatformu } from './blacklist-rules.js';

const VARSAYILAN_KALKAN: ShieldModeSettings = {
  isActive: false,
  autoClearRaidMessages: true,
  minAccountAgeDays: 3,
  blockLinks: true,
  blockCaps: true,
  blockEmotes: true,
  followerOnly: true,
  subOnly: false,
  karaListeEylemi: 'yoksay'
};

export interface KaraListeKaydi {
  username: string;
  reason: string;
  added_by: string;
  added_at: number;
  is_active: number;
  platform: KaraListePlatformu;
}

export class ShieldModeService extends EventEmitter {
  /** Her sohbet mesajında bakılır: bellekte tutulur, ekleme/silmede tazelenir. */
  private karaListe: Map<string, KaraListeKaydi> | null = null;

  getSettings(): ShieldModeSettings {
    try {
      const row = db.prepare("SELECT value FROM bot_settings WHERE key = 'shield_mode_settings'").get() as { value: string } | undefined;
      if (row?.value) {
        // Varsayılanlarla birleştir: sonradan eklenen alanlar eski kayıtta
        // tanımsız kalmasın.
        return { ...VARSAYILAN_KALKAN, ...JSON.parse(row.value) };
      }
    } catch (e) {
      seyrekUyar('ayar:shield_mode_settings', '[Ayar] Kalkan modu ayarı okunamadı — varsayılan kullanılıyor', e);
    }

    return { ...VARSAYILAN_KALKAN };
  }

  saveSettings(settings: Partial<ShieldModeSettings>): ShieldModeSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    db.prepare(`
      INSERT INTO bot_settings (key, value) VALUES ('shield_mode_settings', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(JSON.stringify(updated));
    this.emit('settings_changed', updated);
    return updated;
  }

  activate(moderator: string = 'Yayıncı'): ShieldModeSettings {
    const updated = this.saveSettings({ isActive: true, activatedAt: Date.now() });
    this.addAuditLog('SHIELD_MODE_ACTIVATED', moderator, 'Kalkan Modu (Acil Durum) devreye alındı. Aşırı spam ve raid korumaları aktif.', undefined, 'danger');
    this.emit('activated', { moderator, timestamp: Date.now() });
    return updated;
  }

  deactivate(moderator: string = 'Yayıncı'): ShieldModeSettings {
    const updated = this.saveSettings({ isActive: false });
    this.addAuditLog('SHIELD_MODE_DEACTIVATED', moderator, 'Kalkan Modu kapatıldı. Normal moderasyon devrede.', undefined, 'info');
    this.emit('deactivated', { moderator, timestamp: Date.now() });
    return updated;
  }

  // Audit Logs
  addAuditLog(action: string, moderator: string, details?: string, target?: string, severity: 'info' | 'warn' | 'danger' = 'info'): AuditLog {
    const log: AuditLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      action,
      moderator,
      target,
      details,
      severity
    };

    db.prepare(`
      INSERT INTO audit_logs (id, timestamp, action, moderator, target, details, severity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(log.id, log.timestamp, log.action, log.moderator, log.target || null, log.details || null, log.severity || 'info');

    this.emit('audit_logged', log);
    return log;
  }

  getAuditLogs(limit: number = 50, filterAction?: string): AuditLog[] {
    let query = 'SELECT * FROM audit_logs';
    const params: any[] = [];

    if (filterAction) {
      query += ' WHERE action = ?';
      params.push(filterAction);
    }
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      action: r.action,
      moderator: r.moderator,
      target: r.target || undefined,
      details: r.details || undefined,
      severity: r.severity || 'info'
    }));
  }

  // Ortak kara liste (tablo adı tarihsel: `kick_shared_bans`)
  getSharedBans(): KaraListeKaydi[] {
    const rows = db.prepare('SELECT * FROM kick_shared_bans WHERE is_active = 1 ORDER BY added_at DESC').all() as any[];
    return rows.map((r) => ({ ...r, platform: karaListePlatformu(r.platform) }));
  }

  addSharedBan(username: string, reason: string, addedBy: string = 'Moderatör', platform?: unknown): boolean {
    const cleanUsername = karaListeAdi(username);
    if (!cleanUsername) return false;
    const p = karaListePlatformu(platform);
    const sebep = String(reason || 'Moderatör kararı').slice(0, 200);

    db.prepare(`
      INSERT INTO kick_shared_bans (username, reason, added_by, added_at, is_active, platform)
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(username) DO UPDATE SET reason = excluded.reason, added_by = excluded.added_by,
        added_at = excluded.added_at, is_active = 1, platform = excluded.platform
    `).run(cleanUsername, sebep, String(addedBy || 'Moderatör').slice(0, 60), Date.now(), p);
    this.karaListe = null;

    const yer = p === 'tum' ? 'tüm platformlar' : p;
    this.addAuditLog('SHARED_BAN_ADDED', addedBy, `Ortak kara listeye eklendi (${yer}). Sebep: ${sebep}`, cleanUsername, 'warn');
    return true;
  }

  removeSharedBan(username: string, removedBy: string = 'Moderatör'): boolean {
    const cleanUsername = karaListeAdi(username);
    db.prepare('DELETE FROM kick_shared_bans WHERE username = ?').run(cleanUsername);
    this.karaListe = null;
    this.addAuditLog('SHARED_BAN_REMOVED', removedBy, 'Ortak kara listeden kaldırıldı.', cleanUsername, 'info');
    return true;
  }

  /**
   * Bu platformdan yazan kullanıcı kara listede mi? Kayıt yalnız kendi
   * platformunda (ya da 'tum' ise her yerde) eşleşir.
   */
  karaListeKaydi(username: string, platform: string): KaraListeKaydi | null {
    const ad = karaListeAdi(username);
    if (!ad) return null;
    if (!this.karaListe) {
      this.karaListe = new Map(this.getSharedBans().map((k) => [k.username, k]));
    }
    const kayit = this.karaListe.get(ad);
    return kayit && karaListeEslesir(kayit.platform, platform) ? kayit : null;
  }
}

export const shieldModeService = new ShieldModeService();
export default shieldModeService;
