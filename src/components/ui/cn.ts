/**
 * Stüdyo Masası token sınıflarını tanıyan `cn`. Genel `lib/cn` bunları bilmez: `text-ui-2`
 * (yazı boyutu) ile `text-ui-fg`'yi (yazı rengi) aynı grup sanıp birini siler, `h-ctl` ile
 * `h-9` çakışmasını çözemez. Token sınıflarını birleştiren her yerde bunu kullanın.
 */
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["ui-1", "ui-2", "ui-3", "ui-4", "ui-5", "ui-6"],
      spacing: ["ctl", "row", "pad", "hit"],
      radius: ["ui-1", "ui-2"],
      shadow: ["ui-float"],
      ease: ["ui"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
