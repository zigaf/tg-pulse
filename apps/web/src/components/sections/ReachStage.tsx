'use client';

import { useRef } from 'react';
import { useInView } from 'framer-motion';

/**
 * Viewport gate for the Global reach stage.
 *
 * The map, the arcs and the panel are server rendered; this leaf only sets
 * data-reach-inview once the stage is a quarter visible, and every draw-in
 * animation hangs off that attribute in CSS. The attribute is used instead of a
 * class because the rules are split across two CSS module files, which would
 * hash the same class name twice. data-reach-stage is the stable scope handle the
 * panel uses to light up the strand of a hovered row.
 */
export function ReachStage({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });

  return (
    <div
      ref={ref}
      className={className}
      data-reach-stage=""
      data-reach-inview={inView ? '' : undefined}
    >
      {children}
    </div>
  );
}
