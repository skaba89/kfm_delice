"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const v = useInView(ref, { once: true, margin: "-60px" });
  return <motion.div ref={ref} initial={{ opacity: 0, y: 35 }} animate={v ? { opacity: 1, y: 0 } : { opacity: 0, y: 35 }} transition={{ duration: 0.55, delay, ease: "easeOut" }} className={className}>{children}</motion.div>;
}
