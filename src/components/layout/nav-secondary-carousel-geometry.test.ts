import { describe, expect, it } from 'vitest';

import {
  ARC_EDGE_INSET_PX,
  arcHalfSpreadPx,
  arcItemTransform,
  buildWheelGeometry,
  itemPlacement,
  SEPARATOR_GAP_PX,
  tangentDegForPlacement,
  wheelOffset,
} from '@/components/layout/nav-secondary-carousel-geometry';

describe('nav-secondary-carousel-geometry', () => {
  const geometry = buildWheelGeometry(390, 24, true, 'Antiques & Collectibles', true);

  it('assigns non-zero tangent rotation to flank items when settled at focus', () => {
    const focusIndex = 10;
    const left = itemPlacement(focusIndex - 1, focusIndex, geometry, true, 24, true, true);
    const right = itemPlacement(focusIndex + 1, focusIndex, geometry, true, 24, true, true);
    const center = itemPlacement(focusIndex, focusIndex, geometry, true, 24, true, true);

    expect(Math.abs(left.tangentDeg)).toBeGreaterThan(5);
    expect(Math.abs(right.tangentDeg)).toBeGreaterThan(5);
    expect(left.tangentDeg).toBeLessThan(0);
    expect(right.tangentDeg).toBeGreaterThan(0);
    expect(Math.abs(center.tangentDeg)).toBeLessThan(0.01);
  });

  it('keeps the focused item curved while the wheel is still moving', () => {
    const focusIndex = 10;
    const center = itemPlacement(focusIndex, focusIndex + 0.35, geometry, true, 24, true, false);
    expect(Math.abs(center.tangentDeg)).toBeGreaterThan(2);
  });

  it('embeds rotate() in the arc item CSS transform string', () => {
    const placement = itemPlacement(11, 10, geometry, true, 24, true, true);
    const transform = arcItemTransform(placement);

    expect(transform).toMatch(/rotate\(-?\d+(\.\d+)?deg\)/);
    const match = transform.match(/rotate\((-?\d+(\.\d+)?)deg\)/);
    expect(match).not.toBeNull();
    expect(Math.abs(Number(match![1]))).toBeGreaterThan(5);
  });

  it('spans the arc toward the lower screen edges on wide layouts', () => {
    const wide = buildWheelGeometry(1280, 30, true, 'Housing for Sale', true);
    const halfSpread = arcHalfSpreadPx(1280, true);
    const focusIndex = 18;
    const left = itemPlacement(focusIndex - 3, focusIndex, wide, true, 30, true, true);
    const right = itemPlacement(focusIndex + 3, focusIndex, wide, true, 30, true, true);

    expect(halfSpread).toBeGreaterThan(500);
    expect(left.x).toBeLessThan(ARC_EDGE_INSET_PX + 80);
    expect(right.x).toBeGreaterThan(1280 - ARC_EDGE_INSET_PX - 80);
  });

  it('shows flank items on phone widths without overlapping neighbors', () => {
    const labels = ['Saved', 'Sell', 'For you', 'Local', 'Vehicles'];
    const mobile = buildWheelGeometry(390, 30, true, 'For you', true, labels);
    const focusIndex = 2;
    const left = itemPlacement(focusIndex - 1, focusIndex, mobile, true, 30, true, true);
    const right = itemPlacement(focusIndex + 1, focusIndex, mobile, true, 30, true, true);
    const center = itemPlacement(focusIndex, focusIndex, mobile, true, 30, true, true);
    const leftGap = Math.hypot(center.x - left.x, center.y - left.y);
    const rightGap = Math.hypot(right.x - center.x, right.y - center.y);

    expect(mobile.maxVisibleOffset).toBeGreaterThan(0.5);
    expect(leftGap).toBeGreaterThan(72);
    expect(rightGap).toBeGreaterThan(72);
    expect(left.x).toBeGreaterThan(ARC_EDGE_INSET_PX + 24);
    expect(right.x).toBeLessThan(390 - ARC_EDGE_INSET_PX - 24);
  });

  it('does not stack visible offsets at the same arc position', () => {
    const labels = ['Saved', 'Sell', 'For you', 'Local', 'Vehicles'];
    const geometry = buildWheelGeometry(390, 30, true, 'For you', true, labels);
    const focusIndex = 2;
    const visibleOffsets = [-1, 0, 1];
    const positions = visibleOffsets.map((offset) => {
      const placement = itemPlacement(
        focusIndex + offset,
        focusIndex,
        geometry,
        true,
        30,
        true,
        true,
      );
      return `${placement.x.toFixed(1)},${placement.y.toFixed(1)}`;
    });

    expect(new Set(positions).size).toBe(positions.length);
  });

  it('spaces neighbors at least the separator gap on the arc', () => {
    const geometry = buildWheelGeometry(390, 24, true, 'Antiques & Collectibles', true);
    const focusIndex = 10;
    const left = itemPlacement(focusIndex - 1, focusIndex, geometry, true, 24, true, true);
    const right = itemPlacement(focusIndex + 1, focusIndex, geometry, true, 24, true, true);
    const chordDistance = Math.hypot(right.x - left.x, right.y - left.y);
    expect(chordDistance).toBeGreaterThan(SEPARATOR_GAP_PX);
  });

  it('uses symmetric offsets on a looped wheel', () => {
    const pos = 5;
    const leftOffset = wheelOffset(4, pos, 24, true);
    const rightOffset = wheelOffset(6, pos, 24, true);
    expect(leftOffset).toBe(-1);
    expect(rightOffset).toBe(1);
  });

  it('flattens tangent only when settled at the focus slot', () => {
    const offset = 0.05;
    const angle = -Math.PI / 2;
    expect(tangentDegForPlacement(offset, angle, geometry, true)).toBe(0);
    expect(Math.abs(tangentDegForPlacement(offset, angle, geometry, false))).toBeGreaterThan(0);
  });
});
