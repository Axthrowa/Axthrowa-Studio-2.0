/** Settings — yazılım güncelleme (Tauri plugin-updater). */

import { useCallback, useEffect, useState } from "react";
import { Btn, Header } from "../panel/botTabs/ui";

type Props = { onToast: (m: string) => void };

async function getVersion(): Promise<string> {
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return "1.0.0";
  }
}

export default function StudioUpdaterPanel({ onToast }: Props) {
  const [version, setVersion] = useState("…");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void getVersion().then(setVersion);
  }, []);

  const check = useCallback(async () => {
    setBusy(true);
    setStatus("Kontrol ediliyor…");
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        setStatus("Güncel sürümdesiniz.");
        onToast("Güncelleme yok");
        return;
      }
      setStatus(`Yeni sürüm: ${update.version}`);
      onToast(`Güncelleme bulundu: ${update.version}`);
      // dialog:true ise native onay da gelebilir; yine de manuel indir
      await update.downloadAndInstall();
      try {
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      } catch {
        onToast("Güncelleme indi — uygulamayı yeniden başlatın");
      }
    } catch (e) {
      const msg = String((e as Error).message || e);
      setStatus(msg);
      onToast(
        msg.includes("pubkey") || msg.includes("signature")
          ? "Updater pubkey henüz ayarlı değil (tauri signer generate)"
          : msg
      );
    } finally {
      setBusy(false);
    }
  }, [onToast]);

  return (
    <section className="space-y-3">
      <Header
        title="Yazılım Güncelleme"
        sub="Tauri Auto-Updater · imzalı sürüm kontrolü"
      />
      <div className="rounded-xl border border-panel-border/70 bg-panel-elevated/50 px-4 py-3 space-y-3">
        <p className="text-sm text-white">
          Mevcut sürüm:{" "}
          <span className="font-mono text-panel-accent">{version}</span>
        </p>
        {status && (
          <p className="text-xs text-panel-muted whitespace-pre-wrap">{status}</p>
        )}
        <Btn disabled={busy} onClick={() => void check()}>
          {busy ? "Kontrol…" : "Güncellemeleri Kontrol Et"}
        </Btn>
        <p className="text-[11px] text-panel-muted">
          Üretim için <code>tauri signer generate</code> ile pubkey’i{" "}
          <code>tauri.conf.json → plugins.updater.pubkey</code> alanına yapıştırın.
        </p>
      </div>
    </section>
  );
}
