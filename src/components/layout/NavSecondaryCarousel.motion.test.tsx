import { render, waitFor } from '@testing-library/react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { describe, expect, it } from 'vitest';

import {
  buildWheelGeometry,
  itemPlacement,
  wheelOffset,
} from '@/components/layout/nav-secondary-carousel-geometry';

function rotationDegFromTransform(transform: string) {
  if (!transform || transform === 'none') return 0;
  const match = transform.match(/rotate\((-?\d+(\.\d+)?)deg\)/);
  return match ? Number(match[1]) : 0;
}

/** Mirrors production CarouselArcItem: x/y/rotate/scale on one motion.div only. */
function ArcCarouselItemProbe({
  wheelPosition,
  index,
}: {
  wheelPosition: ReturnType<typeof useMotionValue<number>>;
  index: number;
}) {
  const geometry = buildWheelGeometry(390, 30, true, 'Antiques & Collectibles', true);
  const itemCount = 30;
  const loop = true;
  const hasFab = true;

  const x = useTransform(wheelPosition, (pos) =>
    itemPlacement(index, pos, geometry, hasFab, itemCount, loop, true).x,
  );
  const y = useTransform(wheelPosition, (pos) =>
    itemPlacement(index, pos, geometry, hasFab, itemCount, loop, true).y,
  );
  const rotate = useTransform(wheelPosition, (pos) =>
    itemPlacement(index, pos, geometry, hasFab, itemCount, loop, true).tangentDeg,
  );

  return (
    <motion.div
      data-testid="arc-item"
      data-offset={wheelOffset(index, wheelPosition.get(), itemCount, loop)}
      style={{
        x,
        y,
        rotate,
        translateX: '-50%',
        translateY: '-50%',
      }}
    >
      <span>Label</span>
    </motion.div>
  );
}

describe('NavSecondaryCarousel arc rotation', () => {
  it('renders flank items with a visible rotation matrix (not identity)', async () => {
    const antiquesIndex = 11;

    function Host() {
      const wheelPosition = useMotionValue(antiquesIndex);
      return (
        <>
          <ArcCarouselItemProbe wheelPosition={wheelPosition} index={antiquesIndex - 1} />
          <ArcCarouselItemProbe wheelPosition={wheelPosition} index={antiquesIndex} />
          <ArcCarouselItemProbe wheelPosition={wheelPosition} index={antiquesIndex + 1} />
        </>
      );
    }

    const { getAllByTestId } = render(<Host />);
    const items = getAllByTestId('arc-item');

    await waitFor(() => {
      const left = items[0];
      const center = items[1];
      const right = items[2];

      const leftDeg = rotationDegFromTransform(left.style.transform);
      const centerDeg = rotationDegFromTransform(center.style.transform);
      const rightDeg = rotationDegFromTransform(right.style.transform);

      expect(leftDeg).toBeLessThan(-5);
      expect(rightDeg).toBeGreaterThan(5);
      expect(Math.abs(centerDeg)).toBeLessThan(2);
    });
  });
});
