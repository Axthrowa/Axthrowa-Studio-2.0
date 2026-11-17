/**
 * Canlı ekranının ortak sınıfları: mekanik tuşlar ve üst veri etiketleri.
 * Renkler temadan gelir; varsayılan temanın katmanları index.css ve desktop.css içinde.
 */

/** Basınca içeri giren tuş; renkleri kullanan yer verir */
export const TUS_TABAN =
  "rounded-md border transition-all active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-panel-accent";

export const TUS = `${TUS_TABAN} border-panel-border bg-panel-elevated text-white hover:bg-[var(--dt-surface-3)] disabled:pointer-events-none disabled:opacity-40`;

export const ETIKET = "text-ui-2 axt-etiket font-semibold text-white/55";
