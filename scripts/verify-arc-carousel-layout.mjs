#!/usr/bin/env node
/**
 * Verifies arc carousel geometry against docs/04-operations/dev/nav-secondary-carousel.md
 */
import {
  buildWheelGeometry,
  estimatePillWidth,
  FOCUS_SLOT_SNAP,
  horizontalCenterDistance,
  itemPlacement,
  minAngleStepForHorizontalClearance,
  NOMINAL_PILL_WIDTH_ICON,
  PILL_ROTATION_CLEARANCE,
} from '../src/components/layout/nav-secondary-carousel-geometry.ts';

const MARKET_LABELS = ['Saved', 'Sell', 'For you', 'Local', 'Jobs'];
const FOCUS_INDEX = 2;
const ITEM_COUNT = 30;
const MIN_GAP_PX = 44;
const MIN_FLANK_ROTATION_DEG = 12;
const MAX_FLANK_ROTATION_DEG = 58;
const MIN_ARC_HORIZONTAL_SPAN_PX = 240;

function fail(message) {
  console.error(`verify:arc-carousel-layout FAIL: ${message}`);
  process.exit(1);
}

function chordGap(indexA, indexB, wheelPosition, geometry) {
  const a = itemPlacement(indexA, wheelPosition, geometry, true, ITEM_COUNT, true, true);
  const b = itemPlacement(indexB, wheelPosition, geometry, true, ITEM_COUNT, true, true);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Mid-size phone widths where shallow-arc radius previously hid all flanks. */
const VIEWPORT_WIDTHS = [360, 390, 400, 412, 430, 480];

function verifyMarketAt390(geometry) {
  if (geometry.maxVisibleOffset < 1.9) {
    fail(`390px maxVisibleOffset ${geometry.maxVisibleOffset} — need ≥2 (Jobs at +2)`);
  }

  const requiredOffsets = [-2, -1, 0, 1, 2];
  const placements = requiredOffsets.map((offset) => ({
    offset,
    ...itemPlacement(
      FOCUS_INDEX + offset,
      FOCUS_INDEX,
      geometry,
      true,
      ITEM_COUNT,
      true,
      true,
    ),
  }));

  const positions = placements.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  if (new Set(positions).size !== positions.length) {
    fail('390px Market: visible offsets share placement (stacked)');
  }

  const focus = placements.find((p) => p.offset === 0);
  const sell = placements.find((p) => p.offset === 1);
  const jobs = placements.find((p) => p.offset === 2);
  if (!focus || !sell || !jobs) fail('390px Market: missing focus/sell/jobs placements');

  if (sell.y <= focus.y + 4) {
    fail(`390px: ±1 flank should sit lower on arc than focus (sell y=${sell.y}, focus y=${focus.y})`);
  }

  const span = Math.max(...placements.map((p) => p.x)) - Math.min(...placements.map((p) => p.x));
  if (span < MIN_ARC_HORIZONTAL_SPAN_PX) {
    fail(`390px arc horizontal span ${span.toFixed(0)}px < ${MIN_ARC_HORIZONTAL_SPAN_PX}px`);
  }

  for (const flankOffset of [-1, 1]) {
    const p = placements.find((item) => item.offset === flankOffset);
    const absRot = Math.abs(p.tangentDeg);
    if (absRot < MIN_FLANK_ROTATION_DEG || absRot > MAX_FLANK_ROTATION_DEG) {
      fail(
        `390px offset ${flankOffset} rotation ${absRot.toFixed(1)}° outside ${MIN_FLANK_ROTATION_DEG}–${MAX_FLANK_ROTATION_DEG}°`,
      );
    }
  }

  if (Math.abs(focus.tangentDeg) > 2) {
    fail(`390px focus should be flat when settled (got ${focus.tangentDeg.toFixed(1)}°)`);
  }
}

function verifyAtWidth(width) {
  const geometry = buildWheelGeometry(width, ITEM_COUNT, true, 'For you', true, MARKET_LABELS);
  const nominalPitch =
    NOMINAL_PILL_WIDTH_ICON * PILL_ROTATION_CLEARANCE + 10;

  if (geometry.maxVisibleOffset < 0.5 + FOCUS_SLOT_SNAP) {
    fail(`@${width}px maxVisibleOffset too small (${geometry.maxVisibleOffset}) — only center would show`);
  }

  const visibleOffsets = [];
  for (let offset = -3; offset <= 3; offset += 1) {
    if (Math.abs(offset) <= geometry.maxVisibleOffset + 0.01) {
      visibleOffsets.push(offset);
    }
  }

  if (visibleOffsets.length < 3) {
    fail(`@${width}px expected at least 3 visible arc offsets, got ${visibleOffsets.length}`);
  }

  const positions = visibleOffsets.map((offset) => {
    const placement = itemPlacement(
      FOCUS_INDEX + offset,
      FOCUS_INDEX,
      geometry,
      true,
      ITEM_COUNT,
      true,
      true,
    );
    return `${placement.x.toFixed(2)},${placement.y.toFixed(2)}`;
  });

  if (new Set(positions).size !== positions.length) {
    fail(`@${width}px visible arc items share the same placement (stacked)`);
  }

  for (let i = 1; i < visibleOffsets.length; i += 1) {
    const gap = chordGap(
      FOCUS_INDEX + visibleOffsets[i - 1],
      FOCUS_INDEX + visibleOffsets[i],
      FOCUS_INDEX,
      geometry,
    );
    if (gap < MIN_GAP_PX) {
      fail(
        `@${width}px gap ${visibleOffsets[i - 1]}→${visibleOffsets[i]} is ${gap.toFixed(1)}px (need ≥${MIN_GAP_PX}px)`,
      );
    }
  }

  const focusWidth = estimatePillWidth(true, 'For you');
  const flankWidth = estimatePillWidth(true, 'Sell');
  const neighborGap = chordGap(FOCUS_INDEX - 1, FOCUS_INDEX, FOCUS_INDEX, geometry);
  const minHorizontal = focusWidth / 2 + flankWidth / 2 + 4;
  if (neighborGap < minHorizontal) {
    fail(
      `@${width}px center-to-neighbor gap ${neighborGap.toFixed(1)}px < required ${minHorizontal.toFixed(1)}px`,
    );
  }

  const centerDist = horizontalCenterDistance(geometry.angleStep, geometry.arcRadius);
  const requiredStep = minAngleStepForHorizontalClearance(
    geometry.arcRadius,
    focusWidth,
    flankWidth,
  );
  if (!geometry.visibleSlots || width >= 520) {
    if (geometry.angleStep < requiredStep - 0.001) {
      fail(`@${width}px angleStep ${geometry.angleStep} below horizontal clearance ${requiredStep}`);
    }
  }
  if (centerDist < minHorizontal * 0.85) {
    fail(`@${width}px horizontal center distance ${centerDist.toFixed(1)}px too small`);
  }

  for (const offset of visibleOffsets) {
    const placement = itemPlacement(
      FOCUS_INDEX + offset,
      FOCUS_INDEX,
      geometry,
      true,
      ITEM_COUNT,
      true,
      true,
    );
    if (placement.y > geometry.wheelHeight - 4) {
      fail(
        `@${width}px offset ${offset} y=${placement.y.toFixed(1)} exceeds wheelHeight ${geometry.wheelHeight}`,
      );
    }
  }

  if (width === 390) {
    verifyMarketAt390(geometry);
  }

  console.log(
    `verify:arc-carousel-layout OK @${width}px (offsets ${visibleOffsets.join(',')}, wheelH ${geometry.wheelHeight})`,
  );
}

function main() {
  for (const width of VIEWPORT_WIDTHS) {
    verifyAtWidth(width);
  }
}

main();
