/**
 * Ses paneli — AxthrowA
 * Ses ekle/sil, kısayol ata, canlı yayında anında çal.
 */

import CopyUrl from "../ui/CopyUrl";
import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";
import HotkeyInput from "./HotkeyInput";
import { useI18n } from "../../i18n";
import { API_BASE, importLibraryFile } from "../../lib/api";
import {
  deleteSfxFile,
  fetchSfxFiles,
  loadSoundboard,
  newSoundId,
  playSoundPad,
  saveSoundboard,
  sfxOverlayUrl,
  stopAllSounds,
  uploadSfxFile,
  type SoundPad,
} from "../../lib/soundboard";

type Props = {
  onToast: (msg: string) => void;
  onListeningChange?: (v: boolean) => void;
  /** Kaydedilen binding kimlikleri (`sfx:<padId>`). Tuş metni değil. */
  registeredHotkeys?: Set<string>;
  /** Çakışma vb. yüzünden kaydedilemeyenler */
  hotkeyFailures?: { id: string; spec: string; reason: string }[];
  /** "Tüm sesleri durdur" kısayolu */
  stopHotkey?: string;
  onStopHotkey?: (v: string) => void;
};

export default function SoundBoardPanel({
  onToast,
  onListeningChange,
  registeredHotkeys,
  hotkeyFailures = [],
  stopHotkey = "",
  onStopHotkey,
}: Props) {
  const { t } = useI18n();
  const [pads, setPads] = useState<SoundPad[]>(() => loadSoundboard());
  const [files, setFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const padsRef = useRef(pads);
  padsRef.current = pads;
  const obsSfxUrl = sfxOverlayUrl(API_BASE);

  const persist = useCallback((next: SoundPad[]) => {
    setPads(next);
    saveSoundboard(next);
    window.dispatchEvent(new CustomEvent("soundboard-changed", { detail: next }));
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      setFiles(await fetchSfxFiles());
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    void refreshFiles();
    // OBS ile paylaşmak için mevcut listeyi sunucuya yaz
    const pads = loadSoundboard();
    if (pads.length) saveSoundboard(pads);
  }, [refreshFiles]);

  useEffect(() => {
    const onExt = (e: Event) => {
      const detail = (e as CustomEvent<SoundPad[]>).detail;
      if (Array.isArray(detail)) setPads(detail);
    };
    window.addEventListener("soundboard-changed", onExt);
    return () => window.removeEventListener("soundboard-changed", onExt);
  }, []);

  const patchPad = (id: string, patch: Partial<SoundPad>) => {
    persist(pads.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addFromFileName = (name: string) => {
    const base = name.replace(/\.[^.]+$/, "");
    persist([
      ...pads,
      {
        id: newSoundId(),
        name: base,
        file: name,
        hotkey: "",
        volume: 80,
      },
    ]);
  };

  const onPickFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        const name = await uploadSfxFile(file);
        addFromFileName(name);
      }
      await refreshFiles();
      onToast(t("sfx.uploaded"));
    } catch {
      onToast(t("sfx.uploadFail"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const browseNative = async () => {
    try {
      if (!isTauri()) {
        fileRef.current?.click();
        return;
      }
      const picked = await open({
        multiple: true,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac"] }],
      });
      const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
      if (!paths.length) return;
      setBusy(true);
      for (const path of paths) {
        if (typeof path !== "string") continue;
        try {
          // Yeni sunucu: assets/sfx. Eski exe: sfx kind 400 → music'e kopyala.
          try {
            const res = await importLibraryFile("sfx", path);
            addFromFileName(res.name);
          } catch {
            const res = await importLibraryFile("music", path);
            addFromFileName(res.name);
          }
        } catch {
          /* tek dosya hatası — devam */
        }
      }
      await refreshFiles();
      onToast(t("sfx.uploaded"));
    } catch {
      onToast(t("sfx.uploadFail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("sfx.title")}</h1>
          <p className="mt-1 text-sm text-panel-muted">{t("sfx.subtitle")}</p>
          <p className="mt-1 text-[11px] text-panel-muted">AxthrowA</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac"
            multiple
            className="hidden"
            onChange={(e) => void onPickFiles(e.target.files)}
          />
          <button
            type="button"
            disabled={busy}
            className="rounded-md bg-panel-accent px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
            onClick={() => void browseNative()}
          >
            {t("sfx.add")}
          </button>
          <button
            type="button"
            className="rounded-md bg-black/40 px-3 py-2 text-sm"
            onClick={() => {
              stopAllSounds();
              onToast(t("sfx.stopped"));
            }}
          >
            {t("sfx.stopAll")}
          </button>
        </div>
      </div>

      <p className="rounded-lg border border-panel-border/60 bg-black/20 px-3 py-2 text-xs text-panel-muted leading-relaxed">
        {t("sfx.hint")}
      </p>
      <p className="text-[11px] text-panel-muted leading-relaxed">{t("sfx.chatHint")}</p>

      {onStopHotkey && (
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
          <span className="min-w-0 flex-1 text-xs">
            Tüm sesleri durdur
            <span className="block text-[11px] text-panel-muted">
              Bir sese atanan tuşa tekrar basmak da o sesi durdurur.
            </span>
          </span>
          <HotkeyInput
            className="w-32 rounded border border-panel-border bg-black/40 px-1 py-1 text-center text-xs"
            value={stopHotkey}
            placeholder="Kısayol yok"
            onListeningChange={onListeningChange}
            onChange={onStopHotkey}
          />
        </div>
      )}

      <div className="rounded-lg border border-panel-border/60 bg-black/25 p-3 space-y-2">
        <div className="text-xs font-medium text-panel-muted">{t("sfx.obsUrl")}</div>
        <CopyUrl url={obsSfxUrl} onCopied={() => onToast(t("sfx.copied"))} onFail={(u) => onToast(u)} />
      </div>

      {!pads.length && (
        <div className="rounded-lg border border-dashed border-panel-border px-4 py-10 text-center text-sm text-panel-muted">
          {t("sfx.empty")}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {pads.map((pad) => {
          const hk = pad.hotkey || "";
          // Kimlik üzerinden bakıyoruz: aynı tuşu sahne kısayolu da istiyorsa
          // metin eşleşmesi bu pad'i yanlışlıkla "kayıtlı" gösteriyordu.
          const global = !!(hk && registeredHotkeys?.has(`sfx:${pad.id}`));
          const hkFail = hk ? hotkeyFailures.find((f) => f.id === `sfx:${pad.id}`) : undefined;
          return (
            <div
              key={pad.id}
              className="space-y-2 rounded-lg border border-panel-border bg-black/25 p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded border border-panel-border bg-black/40 px-2 py-1.5 text-sm"
                  value={pad.name}
                  onChange={(e) => patchPad(pad.id, { name: e.target.value })}
                  placeholder={t("sfx.name")}
                />
                <button
                  type="button"
                  className="rounded-md bg-emerald-600/90 px-3 py-1.5 text-sm font-semibold text-white"
                  title={t("sfx.play")}
                  onClick={() => {
                    playSoundPad(
                      pad,
                      () => onToast(t("sfx.playFail")),
                      () => onToast(`${t("sfx.playing")}: ${pad.name}`)
                    );
                  }}
                >
                  ▶
                </button>
                <button
                  type="button"
                  className="rounded-md bg-red-900/50 px-2 py-1.5 text-xs text-red-200"
                  onClick={async () => {
                    const next = pads.filter((p) => p.id !== pad.id);
                    persist(next);
                    const stillUsed = next.some((p) => p.file === pad.file);
                    if (!stillUsed && pad.file) {
                      try {
                        await deleteSfxFile(pad.file);
                        await refreshFiles();
                      } catch {
                        /* */
                      }
                    }
                    onToast(t("sfx.removed"));
                  }}
                >
                  {t("sfx.remove")}
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 text-panel-muted">{t("sfx.file")}</span>
                <select
                  className="min-w-0 flex-1 rounded border border-panel-border bg-black/40 px-1 py-1"
                  value={pad.file}
                  onChange={(e) => patchPad(pad.id, { file: e.target.value })}
                >
                  {pad.file && !files.includes(pad.file) && (
                    <option value={pad.file}>{pad.file} (?)</option>
                  )}
                  {files.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 text-panel-muted">{t("sfx.hotkey")}</span>
                <span
                  className={
                    "size-2 shrink-0 rounded-full " +
                    (hkFail ? "bg-red-400" : global ? "bg-emerald-400" : "bg-amber-400")
                  }
                  title={
                    hkFail
                      ? `Kaydedilemedi: ${hkFail.reason}`
                      : global
                        ? t("sfx.globalOk")
                        : t("sfx.globalPartial")
                  }
                />
                <HotkeyInput
                  className="w-32 rounded border border-panel-border bg-black/40 px-1 py-1 text-center"
                  value={hk}
                  placeholder="Ctrl+1"
                  onListeningChange={onListeningChange}
                  onChange={(v) => patchPad(pad.id, { hotkey: v })}
                />
              </div>
              {hkFail && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
                  Bu kısayol çalışmıyor: {hkFail.reason}. Farklı bir tuş seç.
                </p>
              )}

              <div className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 text-panel-muted">{t("sfx.volume")}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  className="flex-1"
                  value={pad.volume}
                  onChange={(e) => patchPad(pad.id, { volume: Number(e.target.value) })}
                />
                <span className="w-8 text-right tabular-nums">{pad.volume}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Panel dışından (kısayol) güncel listeyi oku */
export function getSoundboardSnapshot(): SoundPad[] {
  return loadSoundboard();
}
