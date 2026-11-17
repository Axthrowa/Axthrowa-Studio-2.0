/** PanelPage'den ayrıldı (TEK-4, davranış aynı): genel kısayollar ve eylem kısayolları. */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { OverlaySettings, sendPlayerCommand } from "../../lib/api";
import { bindingName, buildHotkeyPlan, conflictFailures } from "../../lib/hotkeyPlan";
import { wasHandledByNative } from "../../lib/globalHotkeys";
import { runObsAction, type ActionRow } from "../../lib/obsActions";
import { type MsgKey } from "../../i18n/messages";
import { type NavId } from "../../lib/panelLayout";
import { playSoundPad, stopAllSounds, type SoundPad } from "../../lib/soundboard";
import { toggleAudioInputsMuted, toggleInputMute } from "../../lib/obs";
import { resolveEndingScene } from "../../lib/streamAutomation";
import { obsControl } from "../../lib/obsControl";
import { clearPlatformChats, clearResultToast, temizlenebilirPlatformlar } from "../../lib/clearPlatformChats";
import { useGlobalHotkeys, eventToSpec, canonicalizeHotkeySpec } from "../../lib/globalHotkeys";

export type UsePanelKisayollariGirdisi = {
  clearChatHk: string;
  goScene: (sceneName: string, label?: string | undefined, navHint?: NavId | undefined) => Promise<void>;
  hotkeyCapture: boolean;
  hotkeyCaptureRef: React.RefObject<boolean>;
  settings: OverlaySettings;
  settingsRef: React.RefObject<OverlaySettings>;
  sfxPads: SoundPad[];
  sfxStopHk: string;
  showToast: (m: string) => undefined;
  tt: (key: MsgKey) => string;
};

export function usePanelKisayollari({ clearChatHk, goScene, hotkeyCapture, hotkeyCaptureRef, settings, settingsRef, sfxPads, sfxStopHk, showToast, tt }: UsePanelKisayollariGirdisi) {

  /**
   * Sahne + ses kısayolları tek planda. Kurallar ve çakışma tespiti
   * `lib/hotkeyPlan.ts` içinde, saf ve test edilebilir hâlde.
   */
  const hotkeyPlan = useMemo(
    () =>
      buildHotkeyPlan({
        obs: settings.obs,
        sfxPads,
        clearChatHk,
        sfxStopHk,
      }),
    [settings.obs, sfxPads, clearChatHk, sfxStopHk]
  );

  const allHotkeys = hotkeyPlan.bindings;
  const sceneHotkeys = useMemo(
    () => allHotkeys.filter((b) => b.kind === "scene"),
    [allHotkeys]
  );
  const actionHotkeys = useMemo(
    () => allHotkeys.filter((b) => b.kind !== "scene"),
    [allHotkeys]
  );

  const hotkeysRef = useRef(sceneHotkeys);
  hotkeysRef.current = sceneHotkeys;
  const actionHotkeysRef = useRef(actionHotkeys);
  actionHotkeysRef.current = actionHotkeys;
  const sfxPadsRef = useRef(sfxPads);
  sfxPadsRef.current = sfxPads;

  const clearChatNow = useCallback(async () => {
    try {
      // Kısayolda soru sorulmaz: bağlı tüm platformlar temizlenir
      const r = await clearPlatformChats((await temizlenebilirPlatformlar()).filter((p) => p.bagli).map((p) => p.id));
      showToast(clearResultToast(r));
    } catch (e: any) {
      showToast(String(e?.message || e));
    }
  }, [showToast]);

  const runActionHotkey = useCallback(
    async (id: string) => {
      try {
        if (id.startsWith("sfx:")) {
          const padId = id.slice("sfx:".length);
          const pad = sfxPadsRef.current.find((p) => p.id === padId);
          if (!pad) {
            showToast("Ses bulunamadı");
            return;
          }
          playSoundPad(pad);
          showToast(`${tt("sfx.playing")}: ${pad.name}`);
          return;
        }
        if (id === "clearChat") {
          await clearChatNow();
          return;
        }
        if (id === "sfxStop") {
          stopAllSounds();
          showToast(tt("sfx.stopped"));
          return;
        }
        if (id === "stopStream") {
          await obsControl.stopStreamSequence(resolveEndingScene(settingsRef.current.obs || {}));
          showToast("Çıkış sahnesi — yayın süre sonunda kapanacak");
          return;
        }
        if (id === "mic") {
          const mic = settingsRef.current.obs?.micInput;
          if (!mic) {
            showToast("Önce OBS’te mikrofon kaynağı seç");
            return;
          }
          const muted = await toggleInputMute(mic);
          showToast(muted ? "Mikrofon kapalı" : "Mikrofon açık");
          return;
        }
        if (id === "muteAll") {
          const obs = settingsRef.current.obs || {};
          const exceptMic = obs.muteAllExceptMic !== false;
          const exclude =
            exceptMic && obs.micInput ? [String(obs.micInput)] : [];
          const muted = await toggleAudioInputsMuted({ excludeNames: exclude });
          showToast(
            muted
              ? exceptMic
                ? "Mikrofon hariç sesler kapatıldı"
                : "Tüm sesler kapatıldı"
              : exceptMic
                ? "Mikrofon hariç sesler açıldı"
                : "Tüm sesler açıldı"
          );
          return;
        }
        if (id === "music") {
          await sendPlayerCommand("muteToggle");
          showToast("Müzik ses aç/kapa");
          return;
        }
        // OBS eylemleri (kaynak aç/kapa, kayıt, ses seviyesi, filtre…).
        // Asıl çalıştırıcı Rust; bu yol tarayıcıda açılan panel için yedek.
        if (id.startsWith("act:")) {
          const rowId = id.slice("act:".length);
          const rows: ActionRow[] = settingsRef.current.obs?.actionHotkeys || [];
          const row = rows.find((r) => r.id === rowId);
          if (!row) {
            showToast("Eylem bulunamadı");
            return;
          }
          showToast(await runObsAction(row));
          return;
        }
        if (id.startsWith("srcMute:")) {
          const rowId = id.slice("srcMute:".length);
          const rows: { id: string; input?: string }[] =
            settingsRef.current.obs?.sourceMuteHotkeys || [];
          const row = rows.find((r) => r.id === rowId);
          const input = (row?.input || "").trim();
          if (!input) {
            showToast("Kaynak seçilmemiş");
            return;
          }
          const muted = await toggleInputMute(input);
          showToast(muted ? `${input} kapalı` : `${input} açık`);
          return;
        }
      } catch (e: any) {
        showToast(String(e?.message || e));
      }
    },
    [clearChatNow, tt]
  );

  // İşletim sistemi düzeyinde kayıt: pencere tepsideyken veya OBS/oyun
  // öndeyken de çalışsın.
  const { registered: globalHotkeys, failures: nativeFailures, error: hotkeyError } = useGlobalHotkeys(
    allHotkeys,
    (id) => {
      if (
        id === "mic" ||
        id === "muteAll" ||
        id === "music" ||
        id === "clearChat" ||
        id === "sfxStop" ||
        id.startsWith("srcMute:") ||
        id.startsWith("sfx:")
      ) {
        void runActionHotkey(id);
        return;
      }
      const ent = hotkeysRef.current.find((h) => h.id === id);
      if (ent) {
        const hint =
          id === "starting" || id === "ending" || id === "brb" || id === "chat"
            ? (id as NavId)
            : undefined;
        void goScene(ent.scene || "", ent.label || "", hint);
      }
    },
    {
      paused: hotkeyCapture,
      // Rust'ta çalışan bir kısayol hata verdiğinde (OBS'e ulaşılamadı, kaynak yok…)
      // sessiz kalmasın.
      onError: ({ id, message }) => showToast(`Kısayol çalışmadı (${bindingName(id, [])}): ${message}`),
    }
  );

  // Rust'ın kayıt sonucu (yalnız Tauri, kayıttan sonra) + planın çakışma
  // hesabı (her ortamda, anında). Aynı kimlik ikisinde de varsa Rust'ınki
  // geçerli — gerçek sebebi o biliyor.
  const hotkeyFailures = useMemo(() => {
    const native = new Map(nativeFailures.map((f) => [f.id, f]));
    for (const f of conflictFailures(hotkeyPlan)) if (!native.has(f.id)) native.set(f.id, f);
    return [...native.values()];
  }, [nativeFailures, hotkeyPlan]);
  const globalHotkeysRef = useRef(globalHotkeys);
  globalHotkeysRef.current = globalHotkeys;

  useEffect(() => {
    const lastLocal = new Map<string, number>();
    const matchHotkey = (e: KeyboardEvent, spec: string) => {
      const want = canonicalizeHotkeySpec(spec);
      if (!want) return false;
      const got = eventToSpec(e);
      return !!got && got === want;
    };

    const onKey = (e: KeyboardEvent) => {
      if (hotkeyCaptureRef.current) return;
      if (e.repeat) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Anahtar artık binding kimliği: aynı tuşu paylaşan iki binding'de
      // tuş metni üzerinden ayırt etmek mümkün değildi.
      const fire = (id: string) => {
        if (wasHandledByNative(id)) return false;
        const now = Date.now();
        const prev = lastLocal.get(id) || 0;
        if (now - prev < 400) return false;
        lastLocal.set(id, now);
        return true;
      };
      for (const ent of actionHotkeysRef.current) {
        if (!ent.spec.trim()) continue;
        if (globalHotkeysRef.current.has(ent.id)) continue;
        if (matchHotkey(e, ent.spec)) {
          if (!fire(ent.id)) return;
          e.preventDefault();
          void runActionHotkey(ent.id);
          return;
        }
      }
      for (const ent of hotkeysRef.current) {
        if (globalHotkeysRef.current.has(ent.id)) continue;
        if (matchHotkey(e, ent.spec)) {
          if (!fire(ent.id)) return;
          e.preventDefault();
          const hint =
            ent.id === "starting" ||
            ent.id === "ending" ||
            ent.id === "brb" ||
            ent.id === "chat"
              ? (ent.id as NavId)
              : undefined;
          void goScene(ent.scene || "", ent.label || "", hint);
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goScene, runActionHotkey]);
  return { clearChatNow, globalHotkeys, hotkeyError, hotkeyFailures, runActionHotkey };
}
