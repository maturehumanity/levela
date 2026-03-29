import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Hammer, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

type StoredOffset = {
  x: number;
  y: number;
  label: string;
};

type BuildStorage = Record<string, Record<string, StoredOffset>>;

const STORAGE_KEY = 'levela-global-build-v1';
const BUTTON_POSITION_STORAGE_KEY = 'levela-build-button-position-v1';
const BUTTON_SIZE = 48;
const EDGE_GAP = 16;

type ButtonPosition = {
  x: number;
  y: number;
};

type BuildElement = HTMLElement | SVGElement;

function getNthOfTypeIndex(element: BuildElement) {
  if (!element.parentElement) return 1;
  const siblings = Array.from(element.parentElement.children).filter(
    (child) => child.tagName === element.tagName,
  );
  return siblings.indexOf(element) + 1;
}

function buildPathFromRoot(element: BuildElement, root: HTMLElement) {
  const segments: string[] = [];
  let current: BuildElement | null = element;

  while (current && current !== root) {
    if (current.id) {
      segments.unshift(`${current.tagName.toLowerCase()}#${CSS.escape(current.id)}`);
      break;
    }

    const nth = getNthOfTypeIndex(current);
    segments.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${nth})`);
    current = current.parentElement;
  }

  return segments.join(' > ');
}

function isAutoBuildCandidate(element: BuildElement) {
  if (element.dataset.buildIgnore === 'true') return false;
  if (element.closest('[data-build-ignore="true"]')) return false;

  const tag = element.tagName.toLowerCase();
  const candidateTags = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'span', 'div', 'strong', 'em', 'small',
    'img', 'svg', 'button', 'a',
    'label', 'input', 'textarea', 'select',
    'section', 'article', 'aside', 'header', 'footer', 'nav', 'form',
    'li', 'figure'
  ]);

  const rect = element.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;

  if (element.getAttribute('role') === 'button') return true;
  if (element.getAttribute('role') === 'img') return true;
  if (element.dataset.buildKey) return true;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return true;
  }
  if (element instanceof HTMLImageElement || element instanceof SVGElement) {
    return true;
  }
  if (candidateTags.has(tag) && (hasDirectReadableText(element) || element.children.length <= 2)) return true;

  const text = element.textContent?.trim().replace(/\s+/g, ' ') || '';
  if (text && text.length <= 80 && hasDirectReadableText(element)) return true;

  return false;
}

function isBuildElement(value: EventTarget | null): value is BuildElement {
  return value instanceof HTMLElement || value instanceof SVGElement;
}

function summarizeElement(element: BuildElement) {
  const explicitLabel = element.dataset.buildLabel || element.getAttribute('aria-label');
  if (explicitLabel) return explicitLabel;

  if (element instanceof HTMLInputElement) {
    return element.placeholder || element.name || 'input';
  }

  if (element instanceof HTMLTextAreaElement) {
    return element.placeholder || element.name || 'textarea';
  }

  if (element instanceof HTMLSelectElement) {
    return element.name || 'select';
  }

  if (element instanceof HTMLImageElement) {
    return element.alt || 'image';
  }

  if (element instanceof SVGElement) {
    return element.getAttribute('aria-label') || element.getAttribute('data-lucide') || 'icon';
  }

  const text = element.textContent?.trim().replace(/\s+/g, ' ');
  if (text) return text.slice(0, 42);

  return element.tagName.toLowerCase();
}

function getElementSelector(element: BuildElement) {
  const explicitKey = element.dataset.buildKey;
  if (explicitKey) {
    return `[data-build-key="${CSS.escape(explicitKey)}"]`;
  }

  const segments: string[] = [];
  let current: BuildElement | null = element;

  while (current && current.tagName.toLowerCase() !== 'body') {
    if (current.dataset.buildRoot === 'true') break;

    if (current.id) {
      segments.unshift(`${current.tagName.toLowerCase()}#${CSS.escape(current.id)}`);
      break;
    }

    const nth = getNthOfTypeIndex(current);
    segments.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${nth})`);
    current = current.parentElement;
  }

  return segments.join(' > ');
}

function hasDirectReadableText(element: BuildElement) {
  return Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
  );
}

function getAutoBuildRoot() {
  return document.body;
}

function registerAutoBuildTarget(element: BuildElement, pathname: string, root: HTMLElement) {
  if (element.dataset.buildIgnore === 'true') return;
  if (element.closest('[data-build-ignore="true"]')) return;

  if (!isAutoBuildCandidate(element)) return;

  const autoKey = `auto:${pathname}:${buildPathFromRoot(element, root)}`;
  if (!element.dataset.buildKey || element.dataset.buildAuto === 'true') {
    element.dataset.buildKey = autoKey;
    element.dataset.buildAuto = 'true';
  }

  if (!element.dataset.buildLabel || element.dataset.buildAuto === 'true') {
    element.dataset.buildLabel = summarizeElement(element);
  }
}

function readStorage(): BuildStorage {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BuildStorage;
  } catch {
    return {};
  }
}

function writeStorage(next: BuildStorage) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function clearOffset(element: BuildElement) {
  if (element.dataset.buildPositioned === 'true') {
    element.style.position = '';
    delete element.dataset.buildPositioned;
  }
  element.style.translate = '';
  element.style.left = '';
  element.style.top = '';
}

function getDefaultButtonPosition() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  return {
    x: Math.max(EDGE_GAP, viewportWidth - BUTTON_SIZE - EDGE_GAP),
    y: Math.max(EDGE_GAP, viewportHeight - BUTTON_SIZE - 96),
  };
}

function clampButtonPosition(position: ButtonPosition) {
  return {
    x: Math.min(Math.max(position.x, EDGE_GAP), Math.max(EDGE_GAP, window.innerWidth - BUTTON_SIZE - EDGE_GAP)),
    y: Math.min(Math.max(position.y, EDGE_GAP), Math.max(EDGE_GAP, window.innerHeight - BUTTON_SIZE - EDGE_GAP)),
  };
}

function applyOffset(selector: string, offset: StoredOffset) {
  const found = document.querySelector(selector);
  if (!isBuildElement(found)) return;
  const element = found;

  const display = window.getComputedStyle(element).display;
  if (display === 'inline') {
    if (window.getComputedStyle(element).position === 'static') {
      element.style.position = 'relative';
      element.dataset.buildPositioned = 'true';
    }
    element.style.left = `${offset.x}px`;
    element.style.top = `${offset.y}px`;
    element.style.translate = '';
    return;
  }

  element.style.translate = `${offset.x}px ${offset.y}px`;
  element.style.left = '';
  element.style.top = '';
}

function findMovableElement(target: BuildElement, root: HTMLElement) {
  let current: BuildElement | null = target;

  while (current && root.contains(current)) {
    if (current.dataset.buildIgnore === 'true') return null;
    if (current.dataset.buildKey) return current;

    const style = window.getComputedStyle(current);
    const rect = current.getBoundingClientRect();
    const isUsable =
      style.display !== 'contents' &&
      rect.width > 6 &&
      rect.height > 6 &&
      current.tagName.toLowerCase() !== 'main' &&
      current.tagName.toLowerCase() !== 'body';

    if (isUsable) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

export function BuildOverlay() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const [active, setActive] = useState(false);
  const [selectedSelector, setSelectedSelector] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>('Click an element');
  const [pageOffsets, setPageOffsets] = useState<Record<string, StoredOffset>>({});
  const [buttonPosition, setButtonPosition] = useState<ButtonPosition | null>(null);
  const suppressClickRef = useRef(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const canBuild = useMemo(
    () => Boolean(profile?.effective_permissions?.includes('build.use')),
    [profile?.effective_permissions],
  );

  useEffect(() => {
    if (!canBuild) {
      setActive(false);
      setSelectedSelector(null);
      setSelectedLabel('Click an element');
      setPageOffsets({});
      return;
    }

    const storage = readStorage();
    const nextPageOffsets = storage[pathname] || {};
    setPageOffsets(nextPageOffsets);

    Object.entries(nextPageOffsets).forEach(([selector, offset]) => {
      applyOffset(selector, offset);
    });
  }, [canBuild, pathname]);

  useEffect(() => {
    if (!canBuild) return;

    const root = getAutoBuildRoot();
    let animationFrame = 0;

    const scan = () => {
      registerAutoBuildTarget(root, pathname, root);
      const elements = root.querySelectorAll('*');
      elements.forEach((element) => {
        if (isBuildElement(element)) {
          registerAutoBuildTarget(element, pathname, root);
        }
      });
    };

    const scheduleScan = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(scan);
    };

    scheduleScan();

    const observer = new MutationObserver(() => {
      scheduleScan();
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-build-ignore', 'aria-label'],
    });

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [canBuild, pathname]);

  useEffect(() => {
    if (!canBuild) {
      setButtonPosition(null);
      return;
    }

    try {
      const raw = window.localStorage.getItem(BUTTON_POSITION_STORAGE_KEY);
      if (!raw) {
        setButtonPosition(getDefaultButtonPosition());
        return;
      }

      const parsed = JSON.parse(raw) as ButtonPosition;
      setButtonPosition(clampButtonPosition(parsed));
    } catch {
      setButtonPosition(getDefaultButtonPosition());
    }
  }, [canBuild]);

  useEffect(() => {
    if (!buttonPosition) return;
    window.localStorage.setItem(BUTTON_POSITION_STORAGE_KEY, JSON.stringify(buttonPosition));
  }, [buttonPosition]);

  useEffect(() => {
    if (!buttonPosition) return;

    const handleResize = () => {
      setButtonPosition((current) => (current ? clampButtonPosition(current) : current));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [buttonPosition]);

  useEffect(() => {
    if (!active) return;

    const handleClick = (event: MouseEvent) => {
      if (!isBuildElement(event.target)) return;
      if (event.target.closest('[data-build-ignore="true"]')) return;

      const root = getAutoBuildRoot();
      const nearestTarget = event.target.closest('[data-build-key]');
      const selectable = nearestTarget || findMovableElement(event.target, root);
      if (!selectable) return;

      event.preventDefault();
      event.stopPropagation();

      const selector = getElementSelector(selectable);
      setSelectedSelector(selector);
      setSelectedLabel(summarizeElement(selectable));
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [active]);

  useEffect(() => {
    if (!active || !selectedSelector) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 10 : 1;
      let deltaX = 0;
      let deltaY = 0;

      switch (event.key) {
        case 'ArrowUp':
          deltaY = -step;
          break;
        case 'ArrowDown':
          deltaY = step;
          break;
        case 'ArrowLeft':
          deltaX = -step;
          break;
        case 'ArrowRight':
          deltaX = step;
          break;
        default:
          return;
      }

      event.preventDefault();

      setPageOffsets((current) => {
        const existing = current[selectedSelector] || { x: 0, y: 0, label: selectedLabel };
        const next = {
          ...current,
          [selectedSelector]: {
            x: existing.x + deltaX,
            y: existing.y + deltaY,
            label: existing.label || selectedLabel,
          },
        };

        const storage = readStorage();
        writeStorage({
          ...storage,
          [pathname]: next,
        });
        applyOffset(selectedSelector, next[selectedSelector]);
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, pathname, selectedLabel, selectedSelector]);

  if (!canBuild) return null;
  if (!buttonPosition) return null;

  const handleButtonPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: buttonPosition.x,
      originY: buttonPosition.y,
      moved: false,
    };
  };

  const handleButtonPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (!dragState.moved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
      dragState.moved = true;
    }

    if (!dragState.moved) return;

    setButtonPosition(
      clampButtonPosition({
        x: dragState.originX + deltaX,
        y: dragState.originY + deltaY,
      }),
    );
  };

  const handleButtonPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    suppressClickRef.current = dragState.moved;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragStateRef.current = null;
  };

  const handleButtonClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (dragStateRef.current?.moved) return;
    setActive((current) => !current);
  };

  const nudgeSelected = (deltaX: number, deltaY: number) => {
    if (!selectedSelector) return;

    setPageOffsets((current) => {
      const existing = current[selectedSelector] || { x: 0, y: 0, label: selectedLabel };
      const next = {
        ...current,
        [selectedSelector]: {
          x: existing.x + deltaX,
          y: existing.y + deltaY,
          label: existing.label || selectedLabel,
        },
      };
      const storage = readStorage();
      writeStorage({
        ...storage,
        [pathname]: next,
      });
      applyOffset(selectedSelector, next[selectedSelector]);
      return next;
    });
  };

  const resetSelected = () => {
    if (!selectedSelector) return;

    setPageOffsets((current) => {
      const next = { ...current };
      delete next[selectedSelector];
      const storage = readStorage();
      writeStorage({
        ...storage,
        [pathname]: next,
      });
      const element = document.querySelector(selectedSelector);
      if (isBuildElement(element)) {
        clearOffset(element);
      }
      return next;
    });
  };

  const resetPage = () => {
    Object.keys(pageOffsets).forEach((selector) => {
      const element = document.querySelector(selector);
      if (isBuildElement(element)) {
        clearOffset(element);
      }
    });

    const storage = readStorage();
    delete storage[pathname];
    writeStorage(storage);
    setPageOffsets({});
  };

  return (
    <div
      data-build-ignore="true"
      className="pointer-events-none fixed z-[70] flex flex-col items-end gap-3"
      style={{ left: buttonPosition.x, top: buttonPosition.y }}
    >
      {active ? (
        <div
          className="pointer-events-auto mb-3 w-[18rem] max-w-[calc(100vw-2rem)] rounded-3xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur"
          style={{
            transform: buttonPosition.x > window.innerWidth / 2 ? 'translateX(calc(-100% + 3rem))' : 'translateX(0)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">Build mode</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Click any element, then nudge it into place.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={() => setActive(false)}
              aria-label="Close build mode"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 rounded-2xl border border-border/70 bg-muted/35 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Selected</p>
            <p className="mt-1 text-sm font-medium text-foreground">{selectedLabel}</p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={resetSelected}
              disabled={!selectedSelector}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Reset selected
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={resetPage}
            >
              Reset page
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-full rounded-2xl"
              onClick={() => nudgeSelected(0, -1)}
              disabled={!selectedSelector}
              aria-label="Move up"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <div />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-full rounded-2xl"
              onClick={() => nudgeSelected(-1, 0)}
              disabled={!selectedSelector}
              aria-label="Move left"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/70 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              1px
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-full rounded-2xl"
              onClick={() => nudgeSelected(1, 0)}
              disabled={!selectedSelector}
              aria-label="Move right"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-full rounded-2xl"
              onClick={() => nudgeSelected(0, 1)}
              disabled={!selectedSelector}
              aria-label="Move down"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <div />
          </div>

          <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
            Tip: use keyboard arrows for 1px moves, or hold Shift for 10px.
          </p>
        </div>
      ) : null}

      <Button
        type="button"
        size="icon"
        className="pointer-events-auto h-12 w-12 rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-[0_18px_40px_rgba(15,23,42,0.32)] [&_svg]:!h-7 [&_svg]:!w-7"
        onClick={handleButtonClick}
        onPointerDown={handleButtonPointerDown}
        onPointerMove={handleButtonPointerMove}
        onPointerUp={handleButtonPointerUp}
        onPointerCancel={handleButtonPointerUp}
        aria-label={active ? 'Exit build mode' : 'Open build mode'}
      >
        <Hammer />
      </Button>
    </div>
  );
}
