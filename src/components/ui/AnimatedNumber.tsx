"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";

/** Compteur animé : le chiffre grimpe vers sa valeur (dopamine légitime). */
export function AnimatedNumber({
  value,
  className,
  duration = 0.8,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v).toString());
  const first = useRef(true);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: first.current ? duration : 0.5,
      ease: "easeOut",
    });
    first.current = false;
    return controls.stop;
  }, [value, motionValue, duration]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
