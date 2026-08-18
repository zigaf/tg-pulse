'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * Soft slide-up reveal. Default: on viewport enter.
 * `immediate` plays on mount regardless of scroll position (hero content).
 */
export function Reveal({
  children,
  delay = 0,
  immediate = false,
}: {
  children: React.ReactNode;
  delay?: number;
  immediate?: boolean;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      {...(immediate
        ? { animate: { opacity: 1, y: 0 } }
        : {
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, amount: 0.3, margin: '0px 0px -8% 0px' },
          })}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
