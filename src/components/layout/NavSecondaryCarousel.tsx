import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePageSecondaryNavContext } from '@/contexts/PageSecondaryNavContext';
import { cn } from '@/lib/utils';

const TAP_SLOP_PX = 8;
const WHEEL_HEIGHT = 78;
const SELECTED_Y = 60;
const LABEL_EDGE_PADDING_PX = 44;
/** Center gap width (px) — matches nav + button; used for arc spread on every page. */
const CENTER_RESERVE_PX = 44;

type WheelGeometry = {
  width: number;
  wheelHeight: number;
  pivotY: number;
  centerX: number;
  arcRadius: number;
  angleStep: number;
  arcSpan: number;
  pxPerSlot: number;
  centerExclusionRad: number;
};

function halfSpreadForItemCount(itemCount: number, safeWidth: number, centerX: number) {
  const availableHalf = centerX - LABEL_EDGE_PADDING_PX - CENTER_RESERVE_PX / 2;

  const widthRatio =
    itemCount <= 2 ? 0.13 :
    itemCount === 3 ? 0.16 :
    itemCount === 4 ? 0.19 :
    itemCount === 5 ? 0.21 :
    0.23;
  const widthBased = safeWidth * widthRatio;

  const minHalfSpread =
    itemCount <= 2 ? 42 :
    itemCount === 3 ? 54 :
    itemCount === 4 ? 66 :
    itemCount === 5 ? 78 :
    88;

  return Math.min(availableHalf, Math.max(minHalfSpread, widthBased));
}

function buildWheelGeometry(width: number, itemCount: number): WheelGeometry {
  const safeWidth = Math.max(width, 280);
  const centerX = safeWidth / 2;
  const slots = Math.max(itemCount - 1, 1);

  const sideDrop = Math.max(5, Math.min(7, safeWidth * 0.014));
  const desiredHalfSpread = halfSpreadForItemCount(itemCount, safeWidth, centerX);
  const arcRadius = Math.max(
    96,
    (desiredHalfSpread * desiredHalfSpread + sideDrop * sideDrop) / (2 * sideDrop),
  );
  const pivotY = SELECTED_Y + arcRadius;
  const halfSpan = Math.asin(Math.min(0.999, desiredHalfSpread / arcRadius));
  const arcSpan = halfSpan * 2;
  const angleStep = slots > 0 ? arcSpan / slots : 0;
  const pxPerSlot = Math.max(22, (desiredHalfSpread * 1.05) / Math.max(slots, 1));
  const centerExclusionRad = Math.asin(Math.min(0.999, CENTER_RESERVE_PX / arcRadius));

  return {
    width: safeWidth,
    wheelHeight: WHEEL_HEIGHT,
    pivotY,
    centerX,
    arcRadius,
    angleStep,
    arcSpan,
    pxPerSlot,
    centerExclusionRad,
  };
}

function itemAngle(
  index: number,
  wheelPosition: number,
  geometry: WheelGeometry,
  reserveCenter: boolean,
) {
  const offset = index - wheelPosition;
  let angle = -Math.PI / 2 + offset * geometry.angleStep;

  // Keep the snapped item centered above the + button; only flank items move aside.
  if (reserveCenter && Math.abs(offset) > 0.05) {
    const distFromTop = angle + Math.PI / 2;
    if (Math.abs(distFromTop) < geometry.centerExclusionRad) {
      angle = -Math.PI / 2 + Math.sign(offset) * geometry.centerExclusionRad;
    }
  }

  return angle;
}

function itemPosition(
  index: number,
  wheelPosition: number,
  geometry: WheelGeometry,
  reserveCenter: boolean,
) {
  const angle = itemAngle(index, wheelPosition, geometry, reserveCenter);
  return {
    x: geometry.centerX + Math.cos(angle) * geometry.arcRadius,
    y: geometry.pivotY + Math.sin(angle) * geometry.arcRadius,
    angle,
  };
}

function arcGuidePaths(geometry: WheelGeometry): string[] {
  const mid = -Math.PI / 2;
  const gap = geometry.centerExclusionRad;
  const startAngle = mid - geometry.arcSpan / 2;
  const endAngle = mid + geometry.arcSpan / 2;
  const leftEnd = mid - gap;
  const rightStart = mid + gap;

  const arcSegment = (from: number, to: number) => {
    const sx = geometry.centerX + Math.cos(from) * geometry.arcRadius;
    const sy = geometry.pivotY + Math.sin(from) * geometry.arcRadius;
    const ex = geometry.centerX + Math.cos(to) * geometry.arcRadius;
    const ey = geometry.pivotY + Math.sin(to) * geometry.arcRadius;
    return `M ${sx} ${sy} A ${geometry.arcRadius} ${geometry.arcRadius} 0 0 1 ${ex} ${ey}`;
  };

  const paths: string[] = [];
  if (startAngle < leftEnd - 0.02) {
    paths.push(arcSegment(startAngle, leftEnd));
  }
  if (rightStart < endAngle - 0.02) {
    paths.push(arcSegment(rightStart, endAngle));
  }
  return paths;
}

export function NavSecondaryCarousel() {
  const {
    config,
    carouselVisible,
    cancelCarouselHide,
    scheduleCarouselHide,
  } = usePageSecondaryNavContext();

  const items = useMemo(() => config?.items ?? [], [config?.items]);
  const hasFab = Boolean(config?.fab);
  const activeIndex = useMemo(
    () => Math.max(0, items.findIndex((item) => item.id === config?.value)),
    [items, config?.value],
  );

  const wheelPosition = useMotionValue(activeIndex);
  const arcTrackRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(360);

  const geometry = useMemo(
    () => buildWheelGeometry(containerWidth, items.length),
    [containerWidth, items.length],
  );

  const arcPaths = useMemo(() => arcGuidePaths(geometry), [geometry]);

  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startPosition: 0,
    moved: false,
  });

  useEffect(() => {
    const measure = () => {
      setContainerWidth(document.documentElement.clientWidth);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [carouselVisible]);

  useEffect(() => {
    animate(wheelPosition, activeIndex, {
      type: 'spring',
      stiffness: 420,
      damping: 34,
    });
  }, [activeIndex, wheelPosition]);

  useEffect(() => {
    if (!carouselVisible) {
      dragRef.current.active = false;
      animate(wheelPosition, activeIndex, { duration: 0.15 });
    } else {
      wheelPosition.set(activeIndex);
    }
  }, [activeIndex, carouselVisible, wheelPosition]);

  const snapToIndex = useCallback(
    (index: number, commit = true) => {
      const clamped = clampIndex(index, items.length);
      animate(wheelPosition, clamped, {
        type: 'spring',
        stiffness: 440,
        damping: 32,
      });

      if (!config || !commit) return;
      const item = items[clamped];
      if (item && !item.disabled && item.id !== config.value) {
        config.onChange(item.id);
      }
    },
    [config, items, wheelPosition],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      cancelCarouselHide();
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore unsupported capture in some touch webviews.
      }
      dragRef.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startPosition: wheelPosition.get(),
        moved: false,
      };
    },
    [cancelCarouselHide, wheelPosition],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active) return;
      if (event.pointerId !== dragRef.current.pointerId) return;
      event.preventDefault();
      const deltaX = event.clientX - dragRef.current.startX;
      if (Math.abs(deltaX) > TAP_SLOP_PX) {
        dragRef.current.moved = true;
      }
      const next = dragRef.current.startPosition - deltaX / geometry.pxPerSlot;
      const max = items.length - 1;
      const rubberBand = next < 0 ? next * 0.35 : next > max ? max + (next - max) * 0.35 : next;
      wheelPosition.set(rubberBand);
    },
    [geometry.pxPerSlot, items.length, wheelPosition],
  );

  const finishPointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active) return;
      if (event.pointerId !== dragRef.current.pointerId) return;
      dragRef.current.active = false;
      dragRef.current.pointerId = -1;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Ignore capture release errors.
        }
      }

      const current = wheelPosition.get();
      const targetIndex = clampIndex(Math.round(current), items.length);

      if (!dragRef.current.moved) {
        const rect = event.currentTarget.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;

        let hitIndex = targetIndex;
        let hitDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < items.length; i += 1) {
          const pos = itemPosition(i, current, geometry, hasFab);
          const dx = localX - pos.x;
          const dy = localY - pos.y;
          const dist = dx * dx + dy * dy;
          if (dist < hitDistance) {
            hitDistance = dist;
            hitIndex = i;
          }
        }
        snapToIndex(hitIndex);
      } else {
        snapToIndex(targetIndex);
      }

      scheduleCarouselHide();
    },
    [geometry, hasFab, items.length, scheduleCarouselHide, snapToIndex, wheelPosition],
  );

  if (!config || items.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      {carouselVisible ? (
        <motion.div
          key="nav-secondary-carousel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={cn(
            'pointer-events-none fixed inset-x-0 z-[60]',
            hasFab
              ? 'bottom-[calc(6.35rem+env(safe-area-inset-bottom,0px))]'
              : 'bottom-20',
          )}
        >
          <div
            className="pointer-events-auto w-full pb-2 -mb-2"
            onPointerEnter={cancelCarouselHide}
            onPointerLeave={scheduleCarouselHide}
          >
            <div
              ref={arcTrackRef}
              role="listbox"
              aria-label="Section navigation"
              aria-activedescendant={items[activeIndex]?.id}
              className="relative mx-auto w-full touch-none select-none"
              style={{ height: geometry.wheelHeight }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointer}
              onPointerCancel={finishPointer}
            >
              <svg
                className="pointer-events-none absolute inset-x-0 top-0 overflow-visible"
                width="100%"
                height={geometry.wheelHeight}
                viewBox={`0 0 ${geometry.width} ${geometry.wheelHeight}`}
                preserveAspectRatio="none"
                aria-hidden
              >
                {arcPaths.map((path, pathIndex) => (
                  <path
                    key={`arc-${pathIndex}`}
                    d={path}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1}
                    className="text-border/30"
                    strokeLinecap="round"
                  />
                ))}
              </svg>

              {items.slice(0, -1).map((_, separatorIndex) => (
                <ArcSeparatorDot
                  key={`sep-${separatorIndex}`}
                  leftIndex={separatorIndex}
                  wheelPosition={wheelPosition}
                  geometry={geometry}
                  hasFab={hasFab}
                />
              ))}

              {items.map((item, index) => (
                <CarouselArcItem
                  key={item.id}
                  item={item}
                  index={index}
                  wheelPosition={wheelPosition}
                  geometry={geometry}
                  hasFab={hasFab}
                  selectedId={config.value}
                />
              ))}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function clampIndex(index: number, length: number) {
  return Math.max(0, Math.min(length - 1, index));
}

type ArcSeparatorDotProps = {
  leftIndex: number;
  wheelPosition: ReturnType<typeof useMotionValue<number>>;
  geometry: WheelGeometry;
  hasFab: boolean;
};

function ArcSeparatorDot({ leftIndex, wheelPosition, geometry, hasFab }: ArcSeparatorDotProps) {
  const transform = useTransform(wheelPosition, (pos) => {
    const { x, y } = itemPosition(leftIndex + 0.5, pos, geometry, hasFab);
    return `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  });
  const opacity = useTransform(wheelPosition, (pos) => {
    if (hasFab) {
      const angle = itemAngle(leftIndex + 0.5, pos, geometry, true);
      if (Math.abs(angle + Math.PI / 2) < geometry.centerExclusionRad + 0.06) {
        return 0;
      }
    }
    const dist = Math.abs(leftIndex + 0.5 - pos);
    return Math.max(0.45, 0.8 - dist * 0.18);
  });

  return (
    <motion.span
      className="absolute left-0 top-0 h-1 w-1 rounded-full bg-muted-foreground/70"
      style={{ transform, opacity }}
      aria-hidden
    />
  );
}

type CarouselArcItemProps = {
  item: { id: string; label: string; disabled?: boolean; title?: string };
  index: number;
  wheelPosition: ReturnType<typeof useMotionValue<number>>;
  geometry: WheelGeometry;
  hasFab: boolean;
  selectedId: string;
};

function CarouselArcItem({
  item,
  index,
  wheelPosition,
  geometry,
  hasFab,
  selectedId,
}: CarouselArcItemProps) {
  const transform = useTransform(wheelPosition, (pos) => {
    const { x, y, angle } = itemPosition(index, pos, geometry, hasFab);
    const tangentDeg = ((angle + Math.PI / 2) * 180) / Math.PI;
    return `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${tangentDeg}deg)`;
  });
  const opacity = useTransform(wheelPosition, (pos) => {
    const dist = Math.abs(index - pos);
    return Math.max(0.62, 1 - dist * 0.2);
  });
  const color = useTransform(wheelPosition, (pos) =>
    Math.abs(index - pos) < 0.42 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.65)',
  );
  const zIndex = useTransform(wheelPosition, (pos) => {
    const dist = Math.abs(index - pos);
    if (hasFab && dist < 0.42) {
      return 8;
    }
    return dist < 0.42 ? 30 : 10 - dist;
  });

  const isCommitted = item.id === selectedId;

  return (
    <motion.div
      role="option"
      aria-selected={isCommitted}
      aria-disabled={item.disabled}
      title={item.title}
      className={cn(
        'absolute left-0 top-0 w-[4.6rem] -translate-x-1/2',
        'pointer-events-none whitespace-nowrap text-center',
        item.disabled && 'opacity-40',
      )}
      style={{ transform, opacity, zIndex }}
    >
      <motion.span
        className={cn(
          'block rounded-full border px-2 py-1 text-center text-xs font-semibold leading-tight',
          '[text-shadow:0_1px_1px_rgba(0,0,0,0.05)]',
          'backdrop-blur-[2px]',
          isCommitted
            ? 'border-border/45 bg-background/65'
            : 'border-border/30 bg-background/45',
        )}
        style={{ color }}
      >
        {item.label}
      </motion.span>
    </motion.div>
  );
}
