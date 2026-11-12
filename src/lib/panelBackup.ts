/**
 * Panel yedekleme — AxthrowA
 * Ayarlar, layout, prefs, soundboard, bölüm açık/kapalı durumu.
 */

import { API_BASE, fetchSettings, saveSettings, type OverlaySettings, type ScreenId } from "./api";
import { restoreBackupSecrets, stripBackupSecrets } from "./backupSecrets";
import { loadAppPrefs, saveAppPrefs, type AppPrefs } from "./appPrefs";
import { loadPanelLayout, savePanelLayout, type PanelLayout } from "./panelLayout";
import { loadSoundboard, saveSoundboard, type SoundPad } from "./soundboard";
import {
  exportSectionCollapsed,
  importSectionCollapsed,
} from "../components/panel/SettingsSection";

const SCREENS: ScreenId[] = ["starting", "ending", "brb", "chat"];

export type PanelBackup = {
  version: 1;
  exportedAt: string;
  prefs: AppPrefs;
  layout: PanelLayout;
  soundboard: SoundPad[];
  sectionCollapsed: Record<string, boolean>;
  settings: Partial<Record<ScreenId, OverlaySettings>>;
};

export async function buildBackup(): Promise<PanelBackup> {
  const settings: PanelBackup["settings"] = {};
  for (const screen of SCREENS) {
    try {
      // Yedek paylaşılabilir: OBS şifresi dosyaya girmez.
      settings[screen] = stripBackupSecrets(await fetchSettings(screen));
    } catch {
      settings[screen] = {};
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    prefs: loadAppPrefs(),
    layout: loadPanelLayout(),
    soundboard: loadSoundboard(),
    sectionCollapsed: exportSectionCollapsed(),
    settings,
  };
}

export async function applyBackup(data: PanelBackup): Promise<void> {
  if (!data || data.version !== 1) throw new Error("invalid backup");
  if (data.prefs) saveAppPrefs(data.prefs);
  if (data.layout) savePanelLayout(data.layout);
  if (Array.isArray(data.soundboard)) saveSoundboard(data.soundboard);
  if (data.sectionCollapsed) importSectionCollapsed(data.sectionCollapsed);
  if (data.settings) {
    for (const screen of SCREENS) {
      const s = data.settings[screen];
      if (s && typeof s === "object") {
        // Yedekte şifre yok; mevcut şifre korunur ki OBS bağlantısı kopmasın.
        let current: OverlaySettings = {};
        try {
          current = await fetchSettings(screen);
        } catch {
          /* sunucu yanıt vermezse şifreyi koruyamayız; yine de yedeği yükle */
        }
        await saveSettings(screen, restoreBackupSecrets(s, current));
      }
    }
  }
  void API_BASE;
}

export function downloadBackupJson(backup: PanelBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `axthrowa-studio-yedek-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
