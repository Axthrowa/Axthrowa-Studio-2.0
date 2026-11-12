import { useEffect, useState } from "react";
import { Dialog } from "@/components/axthrowa/dialog";
import {
  clearPlatformChats,
  clearResultToast,
  temizlenebilirPlatformlar,
  type TemizlenebilirPlatform,
} from "../../lib/clearPlatformChats";

const AD: Record<string, string> = { kick: "Kick", twitch: "Twitch", youtube: "YouTube", trovo: "Trovo" };

/** "Hangi platformda temizlensin?" penceresi; yalnız bağlı platformlar seçilebilir. */
export default function SohbetTemizleDiyalogu({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (mesaj: string) => void;
}) {
  const [liste, setListe] = useState<TemizlenebilirPlatform[]>([]);
  const [secili, setSecili] = useState<Record<string, boolean>>({});
  const [hata, setHata] = useState("");
  const [mesgul, setMesgul] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHata("");
    setSecili({});
    temizlenebilirPlatformlar()
      .then(setListe)
      .catch((e) => setHata(String(e?.message || e)));
  }, [open]);

  const seciliOlanlar = liste.filter((p) => p.bagli && secili[p.id]).map((p) => p.id);

  const temizle = async () => {
    setMesgul(true);
    const r = await clearPlatformChats(seciliOlanlar);
    setMesgul(false);
    onDone(clearResultToast(r));
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(a) => !a && onClose()}
      title="Sohbet nerede temizlensin?"
      description="Seçilen platformda sohbet herkes için temizlenir."
      footer={
        <>
          <button type="button" className="studio-btn-ghost h-9 px-3.5 text-xs" onClick={onClose}>
            Vazgeç
          </button>
          <button type="button" disabled={mesgul || !seciliOlanlar.length} className="studio-btn-danger h-9 px-3.5 text-xs" onClick={() => void temizle()}>
            {mesgul ? "Temizleniyor…" : "Temizle"}
          </button>
        </>
      }
    >
      {hata && <p className="text-xs text-red-300">{hata}</p>}
      <div className="flex flex-col gap-1.5">
        {liste.map((p) => (
          <label key={p.id} className={"flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm " + (p.bagli ? "text-white" : "text-panel-muted")}>
            <input
              type="checkbox"
              disabled={!p.bagli}
              checked={!!secili[p.id]}
              onChange={(e) => setSecili((s) => ({ ...s, [p.id]: e.target.checked }))}
            />
            {AD[p.id] || p.id}
            {!p.bagli && <span className="ml-auto text-[11px]">bağlı değil</span>}
          </label>
        ))}
      </div>
    </Dialog>
  );
}
