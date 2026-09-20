/** Sabit bağlantı göstergesi — animasyon / marquee yok. */

export default function StatusDot({
  ok,
  label,
}: {
  ok: boolean;
  label?: string;
}) {
  const text = label ?? (ok ? "Bağlı" : "Bağlı Değil");
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/75">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          ok ? "bg-emerald-400" : "bg-red-500"
        }`}
        aria-hidden
      />
      <span className="whitespace-nowrap">{text}</span>
    </span>
  );
}
