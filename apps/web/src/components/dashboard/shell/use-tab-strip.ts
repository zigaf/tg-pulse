'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Makes a horizontally scrolling tab strip usable without touch: on a desktop
 * client (Telegram Desktop, a laptop browser) the strip hides its scrollbar, so
 * a vertical wheel over it would only scroll the page and the tabs past the
 * right edge would be unreachable. Two behaviours:
 *  - a vertical wheel gesture over the strip scrolls it sideways instead of the page;
 *  - whenever the route changes, the active tab is brought into view, so landing
 *    on a page whose tab sits past the edge never hides where you are.
 */
export function useTabStrip(ref: RefObject<HTMLElement | null>, activeKey: string): void {
  useEffect(() => {
    const strip = ref.current;
    if (!strip) return undefined;

    const onWheel = (event: WheelEvent) => {
      if (!isOverflowing(strip)) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return; // already horizontal
      // React's onWheel is passive; a native listener is needed to stop the page scroll.
      event.preventDefault();
      strip.scrollLeft += event.deltaY;
    };
    strip.addEventListener('wheel', onWheel, { passive: false });
    return () => strip.removeEventListener('wheel', onWheel);
  }, [ref]);

  useEffect(() => {
    const strip = ref.current;
    if (!strip || !isOverflowing(strip)) return;
    const active = strip.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) strip.scrollLeft = centeredScrollLeft(strip, active);
  }, [ref, activeKey]);
}

function isOverflowing(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + 1;
}

/** scrollLeft that centres `item` in `strip`, clamped to the scrollable range. */
export function centeredScrollLeft(
  strip: { clientWidth: number; scrollWidth: number },
  item: { offsetLeft: number; offsetWidth: number },
): number {
  const target = item.offsetLeft + item.offsetWidth / 2 - strip.clientWidth / 2;
  return Math.max(0, Math.min(target, strip.scrollWidth - strip.clientWidth));
}
