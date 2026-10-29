/** Ekranın ortasında, Tamam’a basılana kadar kalan hata kutusu (AxthrowA penceresi). */

import { useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { dismissAppAlert, useAppAlert } from "../../lib/appAlert";
import { Dialog } from "@/components/axthrowa/dialog";

export default function AppAlertModal() {
  const simdiki = useAppAlert();
  // Kapanış animasyonu sürerken son uyarının metni görünmeye devam etsin
  const son = useRef(simdiki);
  if (simdiki) son.current = simdiki;
  const alert = son.current;

  return (
    <Dialog
      open={!!simdiki}
      onOpenChange={(acik) => !acik && dismissAppAlert()}
      role="alertdialog"
      dismissible={false}
      icon={
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-300">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
      }
      title={alert?.title ?? ""}
      description={
        alert ? (
          <>
            <p className="whitespace-pre-wrap">{alert.message}</p>
            {alert.hint ? <p className="mt-2 text-[13px] text-zinc-500">{alert.hint}</p> : null}
          </>
        ) : null
      }
      footer={
        <button
          type="button"
          className="rounded-xl bg-axthrowa-cyan px-5 py-2 text-sm font-semibold text-axthrowa-dark transition-all duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-axthrowa-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-axthrowa-card"
          onClick={() => dismissAppAlert()}
          autoFocus
        >
          Tamam
        </button>
      }
    />
  );
}
