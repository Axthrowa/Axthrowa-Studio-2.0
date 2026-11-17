/** U10: mini kip şeridi — CANLI süresi, sağlık, son sohbet satırı, sahne seçimi ve altı hızlı işlem. Ctrl+M çıkar. */
import { useEffect, useState } from "react";
import { getObs, getStreamHealth, isObsConnected, listScenes } from "../../lib/obs";
import { useNotices } from "../../lib/notices";
import { axbotBase } from "../../lib/axbot";
import { normalizeChat } from "../../lib/chat/normalize";
import { actionsApi, quickActions, type ActionInfo } from "../../lib/api/actions";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";
import { sureMetni } from "../../lib/miniKip";

export function MiniKip({ onCik, onToast }: { onCik: () => void; onToast: (m: string) => void }) {
  const canli = useAxthrowaStore((s) => s.isLive);
  const uyarilar = useNotices();
  const [saglik, setSaglik] = useState<{ sureMs: number; dusen: number } | null>(null);
  const [sohbet, setSohbet] = useState("");
  const [sahneler, setSahneler] = useState<string[]>([]);
  const [sahne, setSahne] = useState("");
  const [eylemler, setEylemler] = useState<ActionInfo[]>([]);

  useEffect(() => {
    let bitti = false;
    const oku = async () => {
      if (isObsConnected()) {
        const [h, l, c] = await Promise.all([
          getStreamHealth().catch(() => null),
          listScenes().catch(() => [] as string[]),
          getObs().call("GetCurrentProgramScene").catch(() => null) as Promise<{ currentProgramSceneName?: string } | null>,
        ]);
        if (bitti) return;
        setSaglik(h ? { sureMs: h.durationMs, dusen: h.dropPct } : null);
        setSahneler(l);
        setSahne(c?.currentProgramSceneName || "");
      }
      try {
        const r = await fetch(`${await axbotBase()}/api/chat/history`, { cache: "no-store" });
        const d = r.ok ? ((await r.json()) as { mesajlar?: unknown[] }) : null;
        const m = d?.mesajlar?.length ? normalizeChat(d.mesajlar[d.mesajlar.length - 1]) : null;
        if (!bitti && m) setSohbet(`${m.displayName}: ${m.message}`);
      } catch {
        /* AxBoT kapalı: sohbet satırı boş kalır */
      }
    };
    void oku();
    const t = window.setInterval(() => void oku(), 2000);
    actionsApi
      .list()
      .then((l) => !bitti && setEylemler(quickActions(l).filter((a) => a.available).slice(0, 6)))
      .catch(() => {});
    return () => {
      bitti = true;
      window.clearInterval(t);
    };
  }, []);

  const calistir = async (id: string, params: Record<string, string> = {}, onay = false) => {
    if (onay && !confirm(`${eylemler.find((a) => a.id === id)?.label || id} çalıştırılsın mı?`)) return;
    try {
      await actionsApi.run(id, params, onay);
    } catch (e) {
      onToast(String((e as Error).message || e).slice(0, 160));
    }
  };

  const uyari = uyarilar[0];
  return (
    <div className="flex h-screen flex-col gap-1 overflow-hidden bg-ui-bg p-2 text-white">
      <div data-tauri-drag-region className="flex cursor-move items-center gap-2 text-xs">
        {canli ? <span className="rounded bg-red-600 px-1.5 font-bold">CANLI {saglik ? sureMetni(saglik.sureMs) : ""}</span> : <span className="text-white/50">Yayında değil</span>}
        <span data-tauri-drag-region className={`min-w-0 flex-1 truncate ${uyari ? (uyari.level === "error" ? "text-red-300" : "text-amber-300") : "text-emerald-300"}`}>
          {uyari ? uyari.text : canli && saglik ? `Sağlıklı · düşen kare %${saglik.dusen.toFixed(1)}` : ""}
        </span>
        <select aria-label="Sahne" value={sahne} onChange={(e) => void calistir("scene.switch", { scene: e.target.value })} className="max-w-36 rounded bg-white/10 px-1 py-0.5">
          {!sahneler.includes(sahne) && <option value="">Sahne</option>}
          {sahneler.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" onClick={onCik} title="Tam pencere (Ctrl+M)" className="rounded bg-white/10 px-1.5 py-0.5">
          Tam
        </button>
      </div>
      <p data-tauri-drag-region className="truncate text-xs text-white/70">
        {sohbet || "Sohbet yok"}
      </p>
      <div className="grid flex-1 grid-cols-6 gap-1">
        {eylemler.map((a) => (
          <button key={a.id} type="button" title={a.label} onClick={() => void calistir(a.id, {}, a.confirm)} className="truncate rounded bg-white/10 px-1 text-[11px] hover:bg-white/20">
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
