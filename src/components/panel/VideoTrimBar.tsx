import { useCallback, useEffect, useRef, useState } from "react";
import { mediaUrl } from "../../lib/api";

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

type Props = {
  videoPath?: string | null;
  /** YouTube için süre bilinmiyorsa manuel üst sınır (sn) */
  durationHint?: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  label?: string;
};

export default function VideoTrimBar({
  videoPath,
  durationHint,
  start,
  end,
  onChange,
  label = "Kırpma",
}: Props) {
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState("");
  const barRef = useRef<HTMLDivElement>(null);
  const drag = useRef<"start" | "end" | null>(null);
  const src = mediaUrl(videoPath);

  useEffect(() => {
    setLoadError("");
    // Yeni kaynağa geçerken eski süreyi taşıma — kısa video seçilince bar
    // önceki uzun videonun süresini gösteriyor, kırpma yanlış hesaplanıyordu.
    setDuration(durationHint && durationHint > 0 ? durationHint : 0);
    if (!src) return;
    let cancelled = false;
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;

    const apply = () => {
      if (cancelled) return;
      const d = v.duration;
      if (Number.isFinite(d) && d > 0) {
        setDuration(d);
        setLoadError("");
      }
    };
    const onErr = () => {
      if (cancelled) return;
      setLoadError("Süre okunamadı");
      if (durationHint && durationHint > 0) setDuration(durationHint);
    };

    v.addEventListener("loadedmetadata", apply);
    v.addEventListener("durationchange", apply);
    v.addEventListener("canplay", apply);
    v.addEventListener("error", onErr);
    v.src = src;
    v.load();

    // Bazı WebView'lerde metadata gecikir
    const t = window.setTimeout(() => {
      if (!cancelled && !(v.duration > 0) && durationHint && durationHint > 0) {
        setDuration(durationHint);
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      v.removeEventListener("loadedmetadata", apply);
      v.removeEventListener("durationchange", apply);
      v.removeEventListener("canplay", apply);
      v.removeEventListener("error", onErr);
      v.removeAttribute("src");
      v.load();
    };
  }, [src, durationHint]);

  useEffect(() => {
    if (!src && durationHint && durationHint > 0) setDuration(durationHint);
  }, [src, durationHint]);

  // Bitiş eski videodan büyükse kırpmayı sıfırla (üst bileşen günceller)
  useEffect(() => {
    if (duration > 0 && end > duration + 0.25) {
      onChange(Math.min(start, Math.max(0, duration - 1)), 0);
    }
  }, [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxDur = duration > 0 ? duration : durationHint && durationHint > 0 ? durationHint : 0;
  const effectiveEnd = end > start ? end : maxDur;
  const startPct = maxDur > 0 ? (start / maxDur) * 100 : 0;
  const endPct = maxDur > 0 ? (effectiveEnd / maxDur) * 100 : 100;

  const posToTime = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      if (!bar || maxDur <= 0) return 0;
      const rect = bar.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(pct * maxDur * 10) / 10;
    },
    [maxDur]
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current || maxDur <= 0) return;
      const t = posToTime(e.clientX);
      if (drag.current === "start") {
        onChange(Math.min(t, (end > 0 ? end : maxDur) - 0.5), end);
      } else {
        onChange(start, Math.max(t, start + 0.5));
      }
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [maxDur, start, end, onChange, posToTime]);

  const show = !!(videoPath || durationHint != null || start > 0 || end > 0);
  if (!show) return null;

  return (
    <div className="space-y-2 rounded-md border border-panel-border/70 bg-black/30 p-3">
      <div className="flex justify-between text-[11px] text-panel-muted">
        <span>
          {label}: {formatTime(start)}
        </span>
        <span>{maxDur > 0 ? formatTime(maxDur) : loadError || "süre yükleniyor…"}</span>
        <span>{formatTime(effectiveEnd || maxDur)}</span>
      </div>
      <div
        ref={barRef}
        className="relative h-3 cursor-pointer rounded-full bg-white/10"
        onPointerDown={(e) => {
          if (maxDur <= 0) return;
          const t = posToTime(e.clientX);
          const mid = (start + (end > start ? end : maxDur)) / 2;
          drag.current = t < mid ? "start" : "end";
          if (drag.current === "start") onChange(t, end);
          else onChange(start, t);
        }}
      >
        <div
          className="absolute top-0 h-full rounded-full bg-panel-accent/70"
          style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-pure-white bg-panel-accent"
          style={{ left: `${startPct}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            drag.current = "start";
          }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-pure-white bg-panel-accent"
          style={{ left: `${endPct}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            drag.current = "end";
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-panel-muted">
          Başlangıç (sn)
          <input
            type="number"
            min={0}
            step={0.5}
            max={maxDur || undefined}
            className="mt-0.5 w-full rounded-md border border-panel-border bg-black/40 px-2 py-1 text-xs"
            value={start || 0}
            onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0), end)}
          />
        </label>
        <label className="text-[10px] text-panel-muted">
          Bitiş (sn, 0=son)
          <input
            type="number"
            min={0}
            step={0.5}
            max={maxDur || undefined}
            className="mt-0.5 w-full rounded-md border border-panel-border bg-black/40 px-2 py-1 text-xs"
            value={end || 0}
            onChange={(e) => onChange(start, Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
      </div>
      <p className="text-[10px] text-panel-muted">
        {maxDur > 0
          ? "Tutamaçları sürükleyerek başlangıç / bitiş seç"
          : "Video süresi yüklenince kırpma barı aktif olur"}
      </p>
    </div>
  );
}
