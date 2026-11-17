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
        className={`h-2 w-2 shrink-0 rounded-full transition-all duration-300 ${
          ok
            ? "bg-emerald-400 shadow-[0_0_8px_rgb(var(--ui-ok)/0.7)]"
            : "bg-red-500/80 shadow-[0_0_6px_rgb(var(--ui-danger)/0.4)]"
        }`}
        aria-hidden
      />
      <span className="whitespace-nowrap">{text}</span>
    </span>
  );
}
