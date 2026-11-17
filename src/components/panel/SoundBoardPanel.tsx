/**
 * Ses paneli — AxthrowA
 * Ses ekle/sil, kısayol ata, canlı yayında anında çal.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";
import {
  AlertCircle,
  FolderOpen,
  Keyboard,
  Music2,
  Play,
  Plus,
  Radio,
  Square,
  Trash2,
  Volume2,
} from "lucide-react";
import CopyUrl from "@/components/axthrowa/CopyUrl";
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
  resolveSoundboard,
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
  const [activePlayId, setActivePlayId] = useState<string | null>(null);
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
    const loaded = loadSoundboard();
    if (loaded.length) saveSoundboard(loaded);
    // Bu tarayıcının deposu boşsa (ör. OBS dock'u) liste sunucudaki panel ayarından gelir
    else
      void resolveSoundboard().then((p) => {
        if (p.length) setPads(p);
      });
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
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-panel-card/60 p-5 shadow-glass">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border border-panel-accent/30 bg-panel-accent/15 text-panel-accent shadow-glow-sm">
              <Music2 className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-white">
                {t("sfx.title")}
              </h1>
              <p className="text-sm font-medium text-white/80">{t("sfx.subtitle")}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
            className="inline-flex items-center gap-2 rounded-xl border border-panel-accent/40 bg-panel-accent/90 px-4 py-2.5 text-xs md:text-sm font-bold text-ui-accent-ink shadow-glow-sm transition-all hover:bg-panel-accent active:scale-95 disabled:opacity-50"
            onClick={() => void browseNative()}
          >
            <Plus className="size-4" />
            {t("sfx.add")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs md:text-sm font-bold text-red-300 transition-all hover:border-red-500/50 hover:bg-red-500/20 active:scale-95"
            onClick={() => {
              stopAllSounds();
              setActivePlayId(null);
              onToast(t("sfx.stopped"));
            }}
          >
            <Square className="size-4 fill-red-400/80" />
            {t("sfx.stopAll")}
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-xs text-white/80">
        <AlertCircle className="size-4.5 shrink-0 text-panel-accent mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs md:text-sm font-medium leading-relaxed text-white/90">{t("sfx.hint")}</p>
          <p className="text-xs leading-relaxed text-white/75">{t("sfx.chatHint")}</p>
        </div>
      </div>

      {/* Stop Hotkey bar */}
      {onStopHotkey && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/35 p-4">
          <div className="flex items-center gap-3">
            <Keyboard className="size-4.5 text-panel-accent" />
            <div>
              <span className="text-sm font-bold text-white">Tüm sesleri durdur kısayolu</span>
              <span className="block text-xs font-medium text-white/75">
                Bir sese atanan tuşa tekrar basmak da o sesi durdurur.
              </span>
            </div>
          </div>
          <HotkeyInput
            className="w-36 rounded-lg border border-white/[0.1] bg-black/60 px-2.5 py-1.5 text-center text-xs md:text-sm font-mono font-medium text-white outline-none focus:border-panel-accent/60"
            value={stopHotkey}
            placeholder="Kısayol yok"
            onListeningChange={onListeningChange}
            onChange={onStopHotkey}
          />
        </div>
      )}

      {/* OBS Overlay URL Box */}
      <div className="rounded-xl border border-white/[0.07] bg-panel-card/40 p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/85">
          <Radio className="size-4 text-panel-accent" />
          <span>{t("sfx.obsUrl")}</span>
        </div>
        <CopyUrl
          url={obsSfxUrl}
          onCopied={() => onToast(t("sfx.copied"))}
          onFail={(u) => onToast(u)}
          onOpened={(u, s) => onToast(s === "opened" ? "Önizleme tarayıcıda açıldı" : s === "copied" ? "Tarayıcı açılamadı — adres kopyalandı" : "Önizleme açılamadı: " + u)}
        />
      </div>

      {/* Empty State */}
      {!pads.length && (
        <div
          onClick={() => void browseNative()}
          className="group cursor-pointer rounded-2xl border-2 border-dashed border-white/[0.1] bg-black/20 p-12 text-center transition-all hover:border-panel-accent/40 hover:bg-black/30"
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-panel-muted group-hover:border-panel-accent/30 group-hover:text-panel-accent">
            <FolderOpen className="size-6" />
          </div>
          <p className="mt-4 text-sm font-medium text-white/80">{t("sfx.empty")}</p>
          <p className="mt-1 text-xs text-panel-muted">
            Tıklayarak MP3, WAV, FLAC veya OGG ses dosyaları seçin.
          </p>
        </div>
      )}

      {/* Launchpad Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {pads.map((pad) => {
          const hk = pad.hotkey || "";
          const global = !!(hk && registeredHotkeys?.has(`sfx:${pad.id}`));
          const hkFail = hk ? hotkeyFailures.find((f) => f.id === `sfx:${pad.id}`) : undefined;
          const isPlaying = activePlayId === pad.id;

          return (
            <div
              key={pad.id}
              className={`group relative flex flex-col justify-between space-y-3.5 rounded-2xl border p-4 transition-all duration-200 ${
                isPlaying
                  ? "border-panel-accent/60 bg-panel-accent/[0.07] shadow-glow-sm"
                  : "border-white/[0.07] bg-panel-card/50 hover:border-white/[0.14] hover:bg-panel-card/70"
              }`}
            >
              {/* Header row: Pad Name + Play button + Delete button */}
              <div className="flex items-center gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-sm font-semibold text-white outline-none transition-colors focus:border-panel-accent/60"
                  value={pad.name}
                  onChange={(e) => patchPad(pad.id, { name: e.target.value })}
                  placeholder={t("sfx.name")}
                />
                <button
                  type="button"
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-90 ${
                    isPlaying
                      ? "bg-emerald-500 shadow-glow text-black"
                      : "bg-emerald-600/90 hover:bg-emerald-500 hover:shadow-glow-sm"
                  }`}
                  title={t("sfx.play")}
                  onClick={() => {
                    setActivePlayId(pad.id);
                    playSoundPad(
                      pad,
                      () => {
                        setActivePlayId(null);
                        onToast(t("sfx.playFail"));
                      },
                      () => {
                        onToast(`${t("sfx.playing")}: ${pad.name}`);
                      }
                    );
                  }}
                >
                  <Play className="size-4 fill-current ml-0.5" />
                </button>
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 transition-all hover:border-red-500/40 hover:bg-red-500/20 active:scale-95"
                  title={t("sfx.remove")}
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
                  <Trash2 className="size-4" />
                </button>
              </div>

              {/* File selector row */}
              <div className="flex items-center gap-2.5 text-xs">
                <span className="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-white/85">
                  {t("sfx.file")}
                </span>
                <select
                  className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-ui-s1 px-2.5 py-1.5 text-xs md:text-sm font-medium text-white outline-none focus:border-panel-accent/60"
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

              {/* Hotkey row */}
              <div className="flex items-center gap-2.5 text-xs">
                <span className="w-16 shrink-0 text-xs font-bold uppercase tracking-wider text-white/85">
                  {t("sfx.hotkey")}
                </span>
                <span
                  className={
                    "size-2.5 shrink-0 rounded-full transition-colors " +
                    (hkFail ? "bg-red-400" : global ? "bg-emerald-400 shadow-glow-sm" : "bg-amber-400")
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
                  className="w-32 rounded-lg border border-white/[0.08] bg-black/40 px-2 py-1.5 text-center font-mono text-xs md:text-sm font-medium text-white outline-none focus:border-panel-accent/60"
                  value={hk}
                  placeholder="Ctrl+1"
                  onListeningChange={onListeningChange}
                  onChange={(v) => patchPad(pad.id, { hotkey: v })}
                />
              </div>
              {hkFail && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200">
                  Bu kısayol çalışmıyor: {hkFail.reason}. Farklı bir tuş seç.
                </p>
              )}

              {/* Volume slider */}
              <div className="flex items-center gap-2.5 text-xs">
                <span className="flex w-16 shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wider text-white/85">
                  <Volume2 className="size-3.5" />
                  {t("sfx.volume")}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  className="ns-range flex-1"
                  value={pad.volume}
                  onChange={(e) => patchPad(pad.id, { volume: Number(e.target.value) })}
                />
                <span className="w-10 text-right font-mono text-sm font-bold tabular-nums text-panel-accent">
                  {pad.volume}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

