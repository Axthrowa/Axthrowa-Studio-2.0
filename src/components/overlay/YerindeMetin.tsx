import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * Önizlemede yazıyı YERİNDE düzenleme (panel önizlemesi; OBS çıktısında kapalı).
 *
 * Çift tık → yazı düzenlenebilir olur (tamamı seçili); Enter ya da dışarı
 * tıklamak kaydeder, Esc vazgeçer. Satır sonu girilmez (başlıklar tek satır).
 *
 * Düzenleme bitince öğe yeniden bağlanır (`key`): React'in metin düğümü ile
 * kullanıcının tarayıcıda değiştirdiği düğüm çakışıp yazıyı ikilemesin.
 */
export type YerindeMetinProps = {
  deger: string;
  /** Düzenleme açık mı (panel önizlemesi). Kapalıysa düz metin çizilir. */
  aktif: boolean;
  onKaydet: (yeni: string) => void;
  /** Boş bırakmaya izin (ör. alt not). Varsayılan: boşsa eski değer kalır. */
  bosOlabilir?: boolean;
};

/** Düzenlenen metni temizler: satır sonları boşluğa, baş/son boşluk atılır. */
export function metniTemizle(ham: string): string {
  return String(ham ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/ /g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export default function YerindeMetin({ deger, aktif, onKaydet, bosOlabilir }: YerindeMetinProps) {
  const [duzenliyor, setDuzenliyor] = useState(false);
  const [tur, setTur] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const vazgec = useRef(false);
  /** Enter + ardından gelen blur aynı düzenlemeyi iki kez kaydetmesin. */
  const acikRef = useRef(false);
  acikRef.current = duzenliyor;

  useEffect(() => {
    if (!duzenliyor || !ref.current) return;
    const el = ref.current;
    el.focus();
    const sec = document.createRange();
    sec.selectNodeContents(el);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(sec);
  }, [duzenliyor]);

  if (!aktif) return <>{deger}</>;

  const bitir = () => {
    if (!acikRef.current) return;
    acikRef.current = false;
    const yeni = metniTemizle(ref.current?.innerText ?? deger);
    const iptal = vazgec.current;
    vazgec.current = false;
    setDuzenliyor(false);
    setTur((n) => n + 1);
    if (iptal || yeni === deger) return;
    if (!yeni && !bosOlabilir) return;
    onKaydet(yeni);
  };

  const tus = (e: KeyboardEvent<HTMLSpanElement>) => {
    // Doğrudan bitir: pencere odakta değilken blur() olay üretmiyor, kayıt kayboluyordu
    if (e.key === "Enter") {
      e.preventDefault();
      bitir();
    } else if (e.key === "Escape") {
      e.preventDefault();
      vazgec.current = true;
      bitir();
    }
    e.stopPropagation(); // panel kısayolları (ör. Ctrl+S, oklar) yazarken tetiklenmesin
  };

  return (
    <span
      key={tur}
      ref={ref}
      className={`yerinde-metin${duzenliyor ? " duzenleniyor" : ""}`}
      title={duzenliyor ? "Enter: kaydet · Esc: vazgeç" : "Çift tıkla: yazıyı burada düzenle"}
      contentEditable={duzenliyor}
      suppressContentEditableWarning
      spellCheck={false}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setDuzenliyor(true);
      }}
      onKeyDown={duzenliyor ? tus : undefined}
      onBlur={bitir}
    >
      {deger}
    </span>
  );
}
