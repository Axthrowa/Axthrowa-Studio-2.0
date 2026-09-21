import { db } from '../db/index.js';

class SettingsCache {
  private cache: Map<string, string> = new Map();
  private initialized: boolean = false;

  load() {
    try {
      const rows = db.prepare('SELECT key, value FROM bot_settings').all() as Array<{ key: string; value: string }>;
      this.cache.clear();
      for (const r of rows) {
        this.cache.set(r.key, r.value);
      }
      this.initialized = true;
    } catch (err) {
      console.warn('[SettingsCache] Error loading settings:', err);
    }
  }

  get(key: string, defaultValue: string = ''): string {
    if (!this.initialized) {
      this.load();
    }
    return this.cache.get(key) ?? defaultValue;
  }

  getBoolean(key: string, defaultValue: boolean = false): boolean {
    const val = this.get(key);
    if (!val) return defaultValue;
    return val === 'true' || val === '1';
  }

  set(key: string, value: string) {
    this.cache.set(key, value);
    try {
      db.prepare(`
        INSERT INTO bot_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, value);
    } catch (err) {
      console.error('[SettingsCache] Error saving key:', key, err);
    }
  }

  reload() {
    this.load();
  }
}

export const settingsCache = new SettingsCache();
export default settingsCache;
