/** Sayı geçişleri — slot / count-up (Framer Motion spring). */

import { useMotionValueEvent, useSpring, useTransform } from "framer-motion";
import { useEffect, useState } from "react";

type Props = {
  value: number;
  className?: string;
};

export default function AnimatedCounter({ value, className }: Props) {
  const spring = useSpring(value, { stiffness: 90, damping: 22, mass: 0.35 });
  const display = useTransform(spring, (v) => Math.round(v));
  const [shown, setShown] = useState(value);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useMotionValueEvent(display, "change", (v) => setShown(v));

  return <span className={className}>{shown}</span>;
}
