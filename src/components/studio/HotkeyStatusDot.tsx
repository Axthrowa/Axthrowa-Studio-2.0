/** Kısayol kayıt durumu noktası: yeşil = küresel kayıtlı · kırmızı = kaydedilemedi · sarı = bekliyor. */

export type HotkeyFailure = { id: string; spec: string; reason: string };

export default function HotkeyStatusDot({
  bindingId,
  hotkey,
  registered,
  failures,
  problem,
}: {
  bindingId: string;
  hotkey: string;
  registered: Set<string>;
  failures: HotkeyFailure[];
  /** Satır eksik alan yüzünden kaydedilmiyorsa nedeni */
  problem?: string | null;
}) {
  const fail = failures.find((f) => f.id === bindingId);
  const ok = !!hotkey && registered.has(bindingId);
  const color = fail ? "bg-red-400" : ok ? "bg-emerald-400" : "bg-amber-400";
  const title = !hotkey
    ? "Kısayol atanmadı"
    : problem
      ? `Eksik alan: ${problem} — bu satır kaydedilmez`
      : fail
        ? `Kaydedilemedi: ${fail.reason}`
        : ok
          ? "Küresel kayıt tutuyor — uygulama tepsideyken de çalışır"
          : "Yalnızca panel odaktayken çalışır";
  return <span className={"size-2 shrink-0 rounded-full " + color} title={title} />;
}
