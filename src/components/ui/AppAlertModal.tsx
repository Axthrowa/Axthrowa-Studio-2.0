/** Ekranın ortasında, Tamam’a basılana kadar kalan hata kutusu. */

import { AlertTriangle } from "lucide-react";
import { dismissAppAlert, useAppAlert } from "../../lib/appAlert";

export default function AppAlertModal() {
  const alert = useAppAlert();
  if (!alert) return null;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-alert-title"
      aria-describedby="app-alert-body"
    >
      <div className="w-full max-w-[26rem] rounded-xl border border-white/10 bg-[#12141a] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-300">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="app-alert-title"
              className="text-[15px] font-semibold tracking-tight text-white"
            >
              {alert.title}
            </h2>
            <p
              id="app-alert-body"
              className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-white/75"
            >
              {alert.message}
            </p>
            {alert.hint ? (
              <p className="mt-2 text-[12px] leading-relaxed text-white/50">{alert.hint}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-[#3EEDFE] px-5 py-2 text-[13px] font-semibold text-[#032f34]"
            onClick={() => dismissAppAlert()}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                dismissAppAlert();
              }
            }}
          >
            Tamam
          </button>
        </div>
      </div>
    </div>
  );
}
