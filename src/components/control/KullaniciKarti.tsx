/**
 * Sohbet kullanıcı kartı (U5): son 20 mesaj, geçmiş cezalar, hazır nedenli susturma/ban.
 * Akış: ada tıkla → "10 dk sustur" → neden seç = uygulanır (üç tıklama; neden seçimi onaydır).
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PLATFORM_LABEL, type NormalizedChatMessage } from "../../lib/chat/model";

export const HAZIR_NEDENLER = ["Spam", "Hakaret", "Reklam", "Konu dışı"] as const;

type Ceza = { action: string; timestamp: number; details: string | null };
type Eylem = "timeout" | "ban";

const EYLEM_ADI: Record<string, string> = {
  MANUAL_TIMEOUT: "Susturma",
  MANUAL_BAN: "Ban",
  MANUAL_UNBAN: "Ban kaldırma",
  MANUAL_DELETE_MESSAGE: "Mesaj silme",
  SHARED_BAN_ENFORCED: "Kara liste banı",
  SHARED_BAN_FAILED: "Kara liste banı (başarısız)",
};

const saat = (t: number) => new Date(t).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

type Props = {
  m: NormalizedChatMessage;
  mesajlar: NormalizedChatMessage[];
  base: string;
  izin: { timeout: boolean; ban: boolean };
  onCeza: (m: NormalizedChatMessage, eylem: Eylem, sebep: string) => Promise<void>;
  onKapat: () => void;
};

export default function KullaniciKarti({ m, mesajlar, base, izin, onCeza, onKapat }: Props) {
  const [cezalar, setCezalar] = useState<Ceza[] | null>(null);
  const [eskiMesajlar, setEskiMesajlar] = useState<{ message: string; timestamp: number }[]>([]);
  const [secili, setSecili] = useState<Eylem | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [yenile, setYenile] = useState(0);
  const ilk = useRef<HTMLButtonElement>(null);

  useEffect(() => ilk.current?.focus(), []);

  useEffect(() => {
    let iptal = false;
    fetch(`${base}/api/viewers/${encodeURIComponent(m.username)}/kart`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (iptal) return;
        setCezalar(Array.isArray(d?.cezalar) ? d.cezalar : []);
        setEskiMesajlar(Array.isArray(d?.mesajlar) ? d.mesajlar : []);
      })
      .catch(() => !iptal && setCezalar([]));
    return () => {
      iptal = true;
    };
  }, [base, m.username, yenile]);

  // Bu oturumun mesajları önce; yoksa botun kayıtlı geçmişi
  const oturum = mesajlar.filter((x) => x.userKey === m.userKey).slice(-20);
  const liste = oturum.length ? oturum.map((x) => ({ message: x.message, timestamp: x.timestamp })) : eskiMesajlar;

  const uygula = async (sebep: string) => {
    if (!secili) return;
    setMesgul(true);
    await onCeza(m, secili, sebep);
    setMesgul(false);
    setSecili(null);
    setYenile((n) => n + 1);
  };

  return (
    <div
      role="dialog"
      aria-label={`Kullanıcı kartı: ${m.displayName}`}
      className="absolute inset-0 z-10 flex flex-col gap-2 rounded-lg border border-white/10 bg-ui-s1 p-2"
      onKeyDown={(e) => e.key === "Escape" && onKapat()}
    >
      <div className="flex items-center gap-2">
        <b className="min-w-0 truncate text-sm" style={m.color ? { color: m.color } : undefined}>
          {m.displayName}
        </b>
        <span className="text-[10px] text-panel-muted">{PLATFORM_LABEL[m.platform]}</span>
        <button ref={ilk} type="button" className="ml-auto rounded p-1 hover:bg-white/10" onClick={onKapat} aria-label="Kartı kapat">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {izin.timeout || izin.ban ? (
        <div className="space-y-1">
          <div className="flex gap-1">
            {izin.timeout && (
              <button type="button" aria-pressed={secili === "timeout"} className={`rounded px-2 py-1 text-[11px] font-semibold ${secili === "timeout" ? "bg-amber-600 text-white" : "bg-white/10 hover:bg-white/15"}`} onClick={() => setSecili((s) => (s === "timeout" ? null : "timeout"))}>
                10 dk sustur
              </button>
            )}
            {izin.ban && (
              <button type="button" aria-pressed={secili === "ban"} className={`rounded px-2 py-1 text-[11px] font-semibold ${secili === "ban" ? "bg-red-600 text-white" : "bg-white/10 hover:bg-white/15"}`} onClick={() => setSecili((s) => (s === "ban" ? null : "ban"))}>
                Kalıcı ban
              </button>
            )}
          </div>
          {secili && (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Ceza nedeni">
              <span className="text-[10px] text-panel-muted">Neden seç, uygulanır:</span>
              {HAZIR_NEDENLER.map((n) => (
                <button key={n} type="button" disabled={mesgul} className="rounded border border-white/15 px-2 py-0.5 text-[11px] hover:border-white/40 hover:bg-white/10" onClick={() => void uygula(n)}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-panel-muted">Bu kullanıcıya buradan ceza verilemez (platform bağlı değil, yetki yok ya da yayıncı/moderatör).</p>
      )}

      <section aria-label="Geçmiş cezalar" className="space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-panel-muted">Geçmiş cezalar</p>
        {cezalar === null ? (
          <p className="text-panel-muted">Yükleniyor…</p>
        ) : cezalar.length === 0 ? (
          <p className="text-panel-muted">Kayıtlı ceza yok.</p>
        ) : (
          <ul className="custom-scrollbar max-h-20 space-y-0.5 overflow-y-auto">
            {cezalar.map((c, i) => (
              <li key={i} className="truncate" title={c.details || undefined}>
                <span className="text-panel-muted">{saat(c.timestamp)}</span> {EYLEM_ADI[c.action] || c.action}
                {c.details ? <span className="text-white/60"> · {c.details}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Son mesajlar" className="flex min-h-0 flex-1 flex-col gap-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-panel-muted">Son mesajlar ({liste.length})</p>
        <ul className="custom-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {liste.length === 0 && <li className="text-panel-muted">Mesaj yok.</li>}
          {liste.map((x, i) => (
            <li key={i} className="break-words">
              <span className="text-[10px] text-panel-muted">{saat(x.timestamp)}</span> {x.message}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
