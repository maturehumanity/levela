import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Box,
  ChevronDown,
  ChevronRight,
  Component,
  Folder,
  Hammer,
  Image as ImageIcon,
  Link as LinkIcon,
  RotateCcw,
  Shapes,
  SquareMousePointer,
  TextCursorInput,
  Type as TypeIcon,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';

type StoredOffset = {
  x: number;
  y: number;
  label: string;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
};

type BuildStorage = Record<string, Record<string, StoredOffset>>;
type BuildGroup = {
  id: string;
  label: string;
  members: string[];
};
type BuildGroupStorage = Record<string, BuildGroup[]>;

const STORAGE_KEY = 'levela-global-build-v1';
const GROUP_STORAGE_KEY = 'levela-global-build-groups-v1';
const BUTTON_POSITION_STORAGE_KEY = 'levela-build-button-position-v1';
const BUILD_STORAGE_EVENT = 'levela-build-storage-updated';
const BUTTON_SIZE = 48;
const EDGE_GAP = 16;

type ButtonPosition = {
  x: number;
  y: number;
};

type SelectionLayer = {
  selector: string;
  label: string;
};

type TargetType = 'group' | 'icon' | 'button' | 'input' | 'text' | 'image' | 'link' | 'container' | 'other';

type AvailableTarget = {
  kind: 'element' | 'group';
  selector: string;
  label: string;
  targetType: TargetType;
  targetName: string;
  hierarchyDepth: number;
  hierarchyOrder: number;
  parentSelector?: string | null;
  iconMarkup?: string;
  isManualGroup?: boolean;
  groupId?: string;
  members?: string[];
};

type SelectedRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  selector: string;
};

type StyleControlState = {
  width: string;
  height: string;
  fontSize: string;
  color: string;
  backgroundColor: string;
};

type AlignmentGuideSegment = {
  key: string;
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
  distance: number;
  diff: number;
};

const MAX_SELECTION_LAYERS = 5;
const ALIGNMENT_TOLERANCE = 4;
const MAX_GUIDE_DISTANCE = 180;
const MAX_GUIDES_PER_ORIENTATION = 2;
const TARGET_TYPE_ORDER: TargetType[] = ['group', 'icon', 'button', 'input', 'text', 'image', 'link', 'container', 'other'];

const TARGET_TYPE_LABEL: Record<TargetType, string> = {
  group: 'group',
  icon: 'icon',
  button: 'button',
  input: 'input',
  text: 'text',
  image: 'image',
  link: 'link',
  container: 'container',
  other: 'other',
};

type BuildElement = HTMLElement | SVGElement;

const LINKED_POSITION_SELECTOR_SETS = [
  [
    '[data-build-key="wcFrontBirthPlaceCompact"]',
    '[data-build-key="wcFrontBirthPlaceFrame"]',
    '[data-build-key="wcFrontBirthPlaceTrigger"]',
  ],
] as const;

const LINKED_POSITION_SELECTOR_LOOKUP = LINKED_POSITION_SELECTOR_SETS.reduce<Map<string, readonly string[]>>((map, selectors) => {
  selectors.forEach((selector) => map.set(selector, selectors));
  return map;
}, new Map());

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

function humanizeBuildLabel(value: string) {
  const normalized = value
    .replace(/^lucide-/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toLowerCase();

  if (!normalized) return '';
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getNearestControlLabel(element: BuildElement) {
  const labelledAncestor = element.closest('[aria-label]');
  if (labelledAncestor && labelledAncestor !== element) {
    const label = labelledAncestor.getAttribute('aria-label')?.trim();
    if (label) return label;
  }

  const controlAncestor = element.closest('button,a,[role="button"]');
  if (controlAncestor && controlAncestor !== element) {
    const text = controlAncestor.textContent?.trim().replace(/\s+/g, ' ');
    if (text) return text.slice(0, 42);
  }

  return '';
}

function getSvgPreviewMarkup(element: SVGElement) {
  const clone = element.cloneNode(true) as SVGElement;
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  clone.removeAttribute('id');
  clone.setAttribute('width', '14');
  clone.setAttribute('height', '14');
  clone.setAttribute('stroke', 'currentColor');
  clone.setAttribute('fill', clone.getAttribute('fill') || 'none');
  clone.setAttribute('aria-hidden', 'true');
  clone.setAttribute('focusable', 'false');

  clone.querySelectorAll('*').forEach((node) => {
    if (!(node instanceof Element)) return;
    node.removeAttribute('class');
    node.removeAttribute('style');
    node.removeAttribute('id');
  });

  return clone.outerHTML;
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
    const svgAriaLabel = element.getAttribute('aria-label')?.trim();
    if (svgAriaLabel) return svgAriaLabel;

    const dataLucide = element.getAttribute('data-lucide');
    if (dataLucide) {
      return `${humanizeBuildLabel(dataLucide)} icon`;
    }

    const lucideClassName = Array.from(element.classList).find(
      (className) => className.startsWith('lucide-') && className !== 'lucide',
    );
    if (lucideClassName) {
      return `${humanizeBuildLabel(lucideClassName)} icon`;
    }

    const nearestControlLabel = getNearestControlLabel(element);
    if (nearestControlLabel) {
      return `${nearestControlLabel} icon`;
    }

    return 'Vector icon';
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

function readGroupStorage(): BuildGroupStorage {
  try {
    const raw = window.localStorage.getItem(GROUP_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as BuildGroupStorage;
  } catch {
    return {};
  }
}

function writeStorage(next: BuildStorage) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(BUILD_STORAGE_EVENT));
}

function writeGroupStorage(next: BuildGroupStorage) {
  window.localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(BUILD_STORAGE_EVENT));
}

function sanitizePageOffsets(offsets: Record<string, StoredOffset>) {
  const next = { ...offsets };
  const styleOnlySelectors = [
    '[data-build-key="wcFrontBirthPlaceCompact"]',
    '[data-build-key="wcFrontDobCompact"]',
    '[data-build-key="wcFrontEditWindowCompact"]',
  ];

  styleOnlySelectors.forEach((selector) => {
    const offset = next[selector];
    if (!offset) return;

    next[selector] = {
      x: offset.x,
      y: offset.y,
      label: offset.label,
      fontSize: offset.fontSize,
      color: offset.color,
    };
  });

  return next;
}

function applyStoredOffsets(offsets: Record<string, StoredOffset>) {
  Object.entries(offsets).forEach(([selector, offset]) => {
    applyOffset(selector, offset);
  });
}

function detectTargetType(element: BuildElement): TargetType {
  if (element instanceof SVGElement) return 'icon';
  if (element instanceof HTMLButtonElement || element.getAttribute('role') === 'button') return 'button';
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return 'input';
  if (element instanceof HTMLImageElement) return 'image';
  if (element instanceof HTMLAnchorElement) return 'link';

  const tag = element.tagName.toLowerCase();
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em', 'small', 'label'].includes(tag)) return 'text';
  if (['div', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'form', 'li', 'figure'].includes(tag)) return 'container';
  return 'other';
}

function normalizeTargetName(rawLabel: string, targetType: TargetType) {
  const cleaned = rawLabel.replace(/^Group:\s*/i, '').trim();
  if (!cleaned) return targetType === 'group' ? 'Selection' : 'Untitled';
  if (targetType === 'icon') {
    return cleaned.replace(/\s+icon$/i, '').trim() || 'Icon';
  }
  return cleaned;
}

function formatTargetLabel(targetType: TargetType, targetName: string) {
  if (targetType === 'group') return targetName;
  return `${TARGET_TYPE_LABEL[targetType]} ${targetName}`.trim();
}

function getAvailableTargets(groups: BuildGroup[]) {
  const seenSelectors = new Set<string>();
  const buildElements = Array.from(document.querySelectorAll('[data-build-key]'))
    .filter((element): element is BuildElement => isBuildElement(element))
    .filter((element) => !element.closest('[data-build-ignore="true"]'));

  const selectorByElement = new Map<BuildElement, string>();
  buildElements.forEach((element) => {
    const selector = getElementSelector(element);
    if (!selector || seenSelectors.has(selector)) return;
    seenSelectors.add(selector);
    selectorByElement.set(element, selector);
  });

  const elementBySelector = new Map<string, BuildElement>();
  selectorByElement.forEach((selector, element) => {
    elementBySelector.set(selector, element);
  });

  const preliminaryElementTargets = Array.from(selectorByElement.entries()).map(([element, selector], index) => {
    let hierarchyDepth = 0;
    let ancestor = element.parentElement;
    while (ancestor) {
      if (isBuildElement(ancestor) && selectorByElement.has(ancestor)) {
        hierarchyDepth += 1;
      }
      ancestor = ancestor.parentElement;
    }

    const baseTargetType = detectTargetType(element);
    const directBuildChildCount = Array.from(element.children).filter(
      (child): child is BuildElement => isBuildElement(child) && selectorByElement.has(child),
    ).length;
    const hasBuildDescendant = buildElements.some(
      (candidate) => candidate !== element && element.contains(candidate),
    );
    const isStructuralGroup = baseTargetType === 'container' && hasBuildDescendant && directBuildChildCount > 1;
    const targetType = isStructuralGroup ? 'group' : baseTargetType;
    const targetName = normalizeTargetName(summarizeElement(element), targetType);

    return {
      kind: 'element' as const,
      selector,
      targetType,
      targetName,
      label: formatTargetLabel(targetType, targetName),
      hierarchyDepth,
      hierarchyOrder: index,
      parentSelector: null,
      iconMarkup: element instanceof SVGElement ? getSvgPreviewMarkup(element) : undefined,
    };
  });

  const structuralGroupSelectors = new Set(
    preliminaryElementTargets
      .filter((target) => target.targetType === 'group')
      .map((target) => target.selector),
  );

  const elementTargets = preliminaryElementTargets.map((target) => {
    const element = elementBySelector.get(target.selector);
    if (!element) return target;

    let parentSelector: string | null = null;
    let ancestor = element.parentElement;
    while (ancestor) {
      if (isBuildElement(ancestor)) {
        const ancestorSelector = selectorByElement.get(ancestor);
        if (ancestorSelector && structuralGroupSelectors.has(ancestorSelector)) {
          parentSelector = ancestorSelector;
          break;
        }
      }
      ancestor = ancestor.parentElement;
    }

    return {
      ...target,
      parentSelector,
    };
  });

  const groupTargets = groups
    .filter((group) => group.members.length > 0)
    .map((group, index) => {
      const targetType = 'group' as const;
      const targetName = normalizeTargetName(group.label, targetType);
      return {
        kind: 'group' as const,
        selector: `group:${group.id}`,
        targetType,
        targetName,
        label: formatTargetLabel(targetType, targetName),
        hierarchyDepth: 0,
        hierarchyOrder: -10000 + index,
        parentSelector: null,
        isManualGroup: true,
        groupId: group.id,
        members: group.members,
      };
    });

  const allTargets = [...groupTargets, ...elementTargets];
  const childrenByParent = new Map<string | null, AvailableTarget[]>();

  allTargets.forEach((target) => {
    const parentKey = target.parentSelector || null;
    const bucket = childrenByParent.get(parentKey);
    if (bucket) {
      bucket.push(target);
      return;
    }
    childrenByParent.set(parentKey, [target]);
  });

  const compareTargets = (a: AvailableTarget, b: AvailableTarget) => {
    const typeDiff = TARGET_TYPE_ORDER.indexOf(a.targetType) - TARGET_TYPE_ORDER.indexOf(b.targetType);
    if (typeDiff !== 0) return typeDiff;

    if (a.targetType === 'group' && b.targetType === 'group') {
      if (Boolean(a.isManualGroup) !== Boolean(b.isManualGroup)) {
        return a.isManualGroup ? -1 : 1;
      }
    }

    const nameDiff = a.targetName.localeCompare(b.targetName, undefined, { sensitivity: 'base' });
    if (nameDiff !== 0) return nameDiff;

    return a.hierarchyOrder - b.hierarchyOrder;
  };

  const orderedTargets: AvailableTarget[] = [];
  const walk = (parentSelector: string | null, depth: number) => {
    const children = (childrenByParent.get(parentSelector) || []).sort(compareTargets);
    children.forEach((child) => {
      orderedTargets.push({
        ...child,
        hierarchyDepth: depth,
      });

      if (child.targetType === 'group' && !child.isManualGroup) {
        walk(child.selector, depth + 1);
      }
    });
  };

  walk(null, 0);
  return orderedTargets;
}

function cssColorToHex(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '#000000';
  if (trimmed.startsWith('#')) {
    if (trimmed.length === 4) {
      return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
    }
    return trimmed.toLowerCase();
  }

  const match = trimmed.match(/rgba?\(([^)]+)\)/i);
  if (!match) return '#000000';
  const channels = match[1].split(',').map((part) => part.trim());
  if (channels.length < 3) return '#000000';
  const [red, green, blue, alpha] = channels.map(Number);
  if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) return '#000000';
  if (Number.isFinite(alpha) && alpha === 0) return '#000000';

  return `#${[red, green, blue]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function getStyleControlState(selector: string): StyleControlState {
  const found = document.querySelector(selector);
  if (!isBuildElement(found)) {
    return {
      width: '',
      height: '',
      fontSize: '',
      color: '#ffffff',
      backgroundColor: '#000000',
    };
  }

  const computed = window.getComputedStyle(found);
  const rect = found.getBoundingClientRect();
  const fontSize = Number.parseFloat(computed.fontSize);

  return {
    width: `${Math.round(rect.width)}`,
    height: `${Math.round(rect.height)}`,
    fontSize: Number.isFinite(fontSize) ? `${Math.round(fontSize)}` : '',
    color: cssColorToHex(computed.color),
    backgroundColor: cssColorToHex(computed.backgroundColor),
  };
}

function clearOffset(element: BuildElement) {
  if (element.dataset.buildPositioned === 'true') {
    element.style.position = '';
    delete element.dataset.buildPositioned;
  }
  if (element.dataset.buildInlineSized === 'true') {
    element.style.display = '';
    delete element.dataset.buildInlineSized;
  }
  element.style.translate = '';
  element.style.left = '';
  element.style.top = '';
  element.style.width = '';
  element.style.height = '';
  element.style.boxSizing = '';
  element.style.justifySelf = '';
  element.style.alignSelf = '';
  element.style.fontSize = '';
  element.style.color = '';
  element.style.backgroundColor = '';
}

function expandLinkedPositionSelectors(selectors: string[]) {
  const next = new Set(selectors.filter(Boolean));
  selectors.forEach((selector) => {
    const linkedSelectors = LINKED_POSITION_SELECTOR_LOOKUP.get(selector);
    if (!linkedSelectors) return;
    linkedSelectors.forEach((linkedSelector) => next.add(linkedSelector));
  });
  return Array.from(next);
}

function getIndependentPositionSelectors(selectors: string[]) {
  const uniqueSelectors = Array.from(new Set(selectors.filter(Boolean)));
  const entries = uniqueSelectors
    .map((selector) => ({ selector, element: document.querySelector(selector) }))
    .filter((entry): entry is { selector: string; element: BuildElement } => isBuildElement(entry.element));

  return uniqueSelectors.filter((selector) => {
    const entry = entries.find((candidate) => candidate.selector === selector);
    if (!entry) return true;

    return !entries.some(
      (candidate) => candidate.selector !== selector && candidate.element.contains(entry.element),
    );
  });
}

function resolvePositionSelectors(selectors: string[]) {
  const expandedSelectors = expandLinkedPositionSelectors(selectors);
  return getIndependentPositionSelectors(expandedSelectors);
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
  } else {
    element.style.translate = `${offset.x}px ${offset.y}px`;
    element.style.left = '';
    element.style.top = '';
  }

  const hasWidth = typeof offset.width === 'number' && offset.width > 0;
  const hasHeight = typeof offset.height === 'number' && offset.height > 0;
  const hasExplicitSize = hasWidth || hasHeight;

  if (hasWidth) {
    if (display === 'inline' && element instanceof HTMLElement) {
      element.style.display = 'inline-block';
      element.dataset.buildInlineSized = 'true';
    }
    element.style.width = `${offset.width}px`;
    element.style.boxSizing = 'border-box';
  } else {
    element.style.width = '';
  }

  if (hasHeight) {
    if (display === 'inline' && element instanceof HTMLElement) {
      element.style.display = 'inline-block';
      element.dataset.buildInlineSized = 'true';
    }
    element.style.height = `${offset.height}px`;
    element.style.boxSizing = 'border-box';
  } else {
    element.style.height = '';
  }

  if (hasExplicitSize && element instanceof HTMLElement) {
    element.style.justifySelf = 'start';
    element.style.alignSelf = 'start';
  } else {
    element.style.boxSizing = '';
    element.style.justifySelf = '';
    element.style.alignSelf = '';
  }

  element.style.fontSize = typeof offset.fontSize === 'number' && offset.fontSize > 0 ? `${offset.fontSize}px` : '';
  element.style.color = offset.color || '';
  element.style.backgroundColor = offset.backgroundColor || '';
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

function isMeaningfulLayer(element: BuildElement) {
  if (element.dataset.buildKey) return true;

  const style = window.getComputedStyle(element);
  const hasVisibleBackground =
    style.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
    style.backgroundColor !== 'transparent';
  const hasBorder =
    Number.parseFloat(style.borderTopWidth) > 0 ||
    Number.parseFloat(style.borderRightWidth) > 0 ||
    Number.parseFloat(style.borderBottomWidth) > 0 ||
    Number.parseFloat(style.borderLeftWidth) > 0;
  const hasDirectText = hasDirectReadableText(element);
  const isFormControl =
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLButtonElement;
  const isGraphic = element instanceof HTMLImageElement || element instanceof SVGElement;

  return hasDirectText || hasVisibleBackground || hasBorder || isFormControl || isGraphic;
}

function preserveOrderedSelectionLayers(layers: SelectionLayer[]) {
  const seen = new Set<string>();
  const limited: SelectionLayer[] = [];

  for (const layer of layers) {
    if (!layer.selector || seen.has(layer.selector)) continue;
    const found = document.querySelector(layer.selector);
    if (!isBuildElement(found)) continue;
    if (!isMeaningfulLayer(found)) continue;
    seen.add(layer.selector);
    limited.push(layer);
    if (limited.length >= MAX_SELECTION_LAYERS) break;
  }

  return limited;
}

function getPrimarySelectableTarget(target: BuildElement, root: HTMLElement) {
  if (target.closest('[data-build-ignore="true"]')) return null;

  const explicitTarget = target.closest('[data-build-key]');
  if (isBuildElement(explicitTarget)) {
    return explicitTarget;
  }

  return findMovableElement(target, root);
}

function getElementArea(element: BuildElement) {
  const rect = element.getBoundingClientRect();
  return rect.width * rect.height;
}

function getElementDepth(element: BuildElement, root: HTMLElement) {
  let depth = 0;
  let current: Element | null = element;

  while (current && current !== root) {
    depth += 1;
    current = current.parentElement;
  }

  return depth;
}

function getElementsAtPoint(clientX: number, clientY: number, root: HTMLElement) {
  return document
    .elementsFromPoint(clientX, clientY)
    .filter((element): element is BuildElement => isBuildElement(element))
    .filter((element) => root.contains(element))
    .filter((element) => !element.closest('[data-build-ignore="true"]'));
}

function getPrimarySelectableTargetAtPoint(
  clientX: number,
  clientY: number,
  root: HTMLElement,
  fallbackTarget?: BuildElement | null,
) {
  const stack = getElementsAtPoint(clientX, clientY, root);

  const explicitCandidates = stack
    .map((element) => element.closest('[data-build-key]'))
    .filter((element): element is BuildElement => isBuildElement(element))
    .filter((element, index, array) => array.indexOf(element) === index)
    .filter((element) => root.contains(element))
    .filter((element) => isMeaningfulLayer(element))
    .sort((a, b) => {
      const areaDiff = getElementArea(a) - getElementArea(b);
      if (areaDiff !== 0) return areaDiff;
      return getElementDepth(b, root) - getElementDepth(a, root);
    });

  if (explicitCandidates.length) {
    return explicitCandidates[0];
  }

  if (fallbackTarget) {
    return getPrimarySelectableTarget(fallbackTarget, root);
  }

  return null;
}

function shouldIncludeAncestorLayer(element: BuildElement) {
  if (element.dataset.buildIgnore === 'true') return false;
  if (element.closest('[data-build-ignore="true"]')) return false;
  if (!isMeaningfulLayer(element)) return false;

  const tag = element.tagName.toLowerCase();
  if (tag === 'body' || tag === 'html' || tag === 'main') return false;

  const rect = element.getBoundingClientRect();
  const viewportArea = window.innerWidth * window.innerHeight;
  const area = rect.width * rect.height;

  return area > 24 && area < viewportArea * 0.7;
}

function buildSelectionLayersForPoint(target: BuildElement, clientX: number, clientY: number, root: HTMLElement) {
  const preferredTarget = getPrimarySelectableTargetAtPoint(clientX, clientY, root, target);
  if (!preferredTarget) return [];

  const rawStack = getElementsAtPoint(clientX, clientY, root);

  const orderedLayers: SelectionLayer[] = [
    {
      selector: getElementSelector(preferredTarget),
      label: summarizeElement(preferredTarget),
    },
  ];

  let ancestor = preferredTarget.parentElement;
  while (ancestor && root.contains(ancestor)) {
    if (isBuildElement(ancestor) && shouldIncludeAncestorLayer(ancestor)) {
      orderedLayers.push({
        selector: getElementSelector(ancestor),
        label: summarizeElement(ancestor),
      });
    }
    ancestor = ancestor.parentElement;
  }

  rawStack.forEach((element) => {
    if (element === preferredTarget) return;
    if (!preferredTarget.contains(element)) return;

    const innerTarget =
      (element.dataset.buildKey ? element : null) ||
      (isMeaningfulLayer(element) ? element : null) ||
      findMovableElement(element, preferredTarget as unknown as HTMLElement);

    if (!innerTarget || innerTarget === preferredTarget) return;

    orderedLayers.push({
      selector: getElementSelector(innerTarget),
      label: summarizeElement(innerTarget),
    });
  });

  return preserveOrderedSelectionLayers(orderedLayers);
}

function getConnectorRange(
  orientation: 'vertical' | 'horizontal',
  selectedRect: DOMRect,
  candidateRect: DOMRect,
) {
  if (orientation === 'vertical') {
    if (selectedRect.bottom <= candidateRect.top) {
      return { start: selectedRect.bottom, end: candidateRect.top };
    }

    if (candidateRect.bottom <= selectedRect.top) {
      return { start: candidateRect.bottom, end: selectedRect.top };
    }

    return {
      start: Math.max(selectedRect.top, candidateRect.top),
      end: Math.min(selectedRect.bottom, candidateRect.bottom),
    };
  }

  if (selectedRect.right <= candidateRect.left) {
    return { start: selectedRect.right, end: candidateRect.left };
  }

  if (candidateRect.right <= selectedRect.left) {
    return { start: candidateRect.right, end: selectedRect.left };
  }

  return {
    start: Math.max(selectedRect.left, candidateRect.left),
    end: Math.min(selectedRect.right, candidateRect.right),
  };
}

function getAlignmentGuidesForSelector(selector: string | null): AlignmentGuideSegment[] {
  if (!selector) {
    return [];
  }

  const selectedElement = document.querySelector(selector);
  if (!isBuildElement(selectedElement)) {
    return [];
  }

  const selectedRect = selectedElement.getBoundingClientRect();
  if (selectedRect.width < 1 || selectedRect.height < 1) {
    return [];
  }

  const selectedXPositions = [
    { name: 'left', value: selectedRect.left },
    { name: 'center', value: selectedRect.left + selectedRect.width / 2 },
    { name: 'right', value: selectedRect.right },
  ];
  const selectedYPositions = [
    { name: 'top', value: selectedRect.top },
    { name: 'middle', value: selectedRect.top + selectedRect.height / 2 },
    { name: 'bottom', value: selectedRect.bottom },
  ];

  const guides: AlignmentGuideSegment[] = [];
  const seen = new Set<string>();

  const candidates = document.querySelectorAll('[data-build-key]');
  candidates.forEach((candidate) => {
    if (!isBuildElement(candidate)) return;
    if (candidate === selectedElement) return;
    if (candidate.closest('[data-build-ignore="true"]')) return;

    const rect = candidate.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const xPositions = [
      { name: 'left', value: rect.left },
      { name: 'center', value: rect.left + rect.width / 2 },
      { name: 'right', value: rect.right },
    ];
    const yPositions = [
      { name: 'top', value: rect.top },
      { name: 'middle', value: rect.top + rect.height / 2 },
      { name: 'bottom', value: rect.bottom },
    ];

    for (const selectedX of selectedXPositions) {
      for (const candidateX of xPositions) {
        const diff = Math.abs(selectedX.value - candidateX.value);
        if (diff <= ALIGNMENT_TOLERANCE) {
          const range = getConnectorRange('vertical', selectedRect, rect);
          const distance = Math.abs(range.end - range.start);
          if (distance > MAX_GUIDE_DISTANCE) continue;
          const key = `v:${candidate.dataset.buildKey || candidate.tagName}:${selectedX.name}:${candidateX.name}:${Math.round(candidateX.value)}:${Math.round(range.start)}:${Math.round(range.end)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          guides.push({
            key,
            orientation: 'vertical',
            position: candidateX.value,
            start: range.start,
            end: range.end,
            distance,
            diff,
          });
        }
      }
    }

    for (const selectedY of selectedYPositions) {
      for (const candidateY of yPositions) {
        const diff = Math.abs(selectedY.value - candidateY.value);
        if (diff <= ALIGNMENT_TOLERANCE) {
          const range = getConnectorRange('horizontal', selectedRect, rect);
          const distance = Math.abs(range.end - range.start);
          if (distance > MAX_GUIDE_DISTANCE) continue;
          const key = `h:${candidate.dataset.buildKey || candidate.tagName}:${selectedY.name}:${candidateY.name}:${Math.round(candidateY.value)}:${Math.round(range.start)}:${Math.round(range.end)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          guides.push({
            key,
            orientation: 'horizontal',
            position: candidateY.value,
            start: range.start,
            end: range.end,
            distance,
            diff,
          });
        }
      }
    }
  });

  const pickBest = (orientation: 'vertical' | 'horizontal') =>
    guides
      .filter((guide) => guide.orientation === orientation)
      .sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        if (a.diff !== b.diff) return a.diff - b.diff;
        return a.key.localeCompare(b.key);
      })
      .slice(0, MAX_GUIDES_PER_ORIENTATION);

  return [...pickBest('vertical'), ...pickBest('horizontal')];
}

function TargetTypeGlyph({ targetType, className }: { targetType: TargetType; className?: string }) {
  switch (targetType) {
    case 'group':
      return <Folder className={className} />;
    case 'icon':
      return <Shapes className={className} />;
    case 'button':
      return <SquareMousePointer className={className} />;
    case 'input':
      return <TextCursorInput className={className} />;
    case 'text':
      return <TypeIcon className={className} />;
    case 'image':
      return <ImageIcon className={className} />;
    case 'link':
      return <LinkIcon className={className} />;
    case 'container':
      return <Box className={className} />;
    default:
      return <Component className={className} />;
  }
}

function TargetOptionIcon({ target }: { target: AvailableTarget }) {
  if (target.targetType === 'icon' && target.iconMarkup) {
    return (
      <span
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted-foreground [&_svg]:h-3.5 [&_svg]:w-3.5"
        dangerouslySetInnerHTML={{ __html: target.iconMarkup }}
      />
    );
  }

  return <TargetTypeGlyph targetType={target.targetType} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
}

export function BuildOverlay() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const [active, setActive] = useState(false);
  const [selectedSelector, setSelectedSelector] = useState<string | null>(null);
  const [selectedSelectors, setSelectedSelectors] = useState<string[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>('Click an element');
  const [selectionLayers, setSelectionLayers] = useState<SelectionLayer[]>([]);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(0);
  const [availableTargets, setAvailableTargets] = useState<AvailableTarget[]>([]);
  const [pageGroups, setPageGroups] = useState<BuildGroup[]>([]);
  const [pageOffsets, setPageOffsets] = useState<Record<string, StoredOffset>>({});
  const [selectedRects, setSelectedRects] = useState<SelectedRect[]>([]);
  const [hoveredRect, setHoveredRect] = useState<SelectedRect | null>(null);
  const [styleControls, setStyleControls] = useState<StyleControlState>({
    width: '',
    height: '',
    fontSize: '',
    color: '#ffffff',
    backgroundColor: '#000000',
  });
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuideSegment[]>([]);
  const [showAlignmentGuides, setShowAlignmentGuides] = useState(false);
  const [buttonPosition, setButtonPosition] = useState<ButtonPosition | null>(null);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [targetMenuOpen, setTargetMenuOpen] = useState(false);
  const [expandedTargetSelectors, setExpandedTargetSelectors] = useState<Set<string>>(() => new Set());
  const suppressClickRef = useRef(false);
  const suppressSelectionClickRef = useRef(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const selectedDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origins: Record<string, { x: number; y: number; label: string }>;
    moved: boolean;
  } | null>(null);
  const lastSelectionRef = useRef<{ x: number; y: number; signature: string } | null>(null);
  const guideHideTimeoutRef = useRef<number | null>(null);

  const canBuild = useMemo(
    () => Boolean(profile?.effective_permissions?.includes('build.use')),
    [profile?.effective_permissions],
  );
  const selectedTargetValue = selectedGroupId ? `group:${selectedGroupId}` : (selectedSelector || undefined);
  const selectedTargetOption = useMemo(
    () => availableTargets.find((target) => target.selector === selectedTargetValue) || null,
    [availableTargets, selectedTargetValue],
  );
  const targetChildrenByParent = useMemo(() => {
    const next = new Map<string | null, AvailableTarget[]>();
    availableTargets.forEach((target) => {
      const parentKey = target.parentSelector || null;
      const existing = next.get(parentKey);
      if (existing) {
        existing.push(target);
        return;
      }
      next.set(parentKey, [target]);
    });
    return next;
  }, [availableTargets]);

  useEffect(() => {
    setExpandedTargetSelectors((current) => {
      const valid = new Set<string>();
      current.forEach((selector) => {
        const children = targetChildrenByParent.get(selector);
        if (children?.length) valid.add(selector);
      });
      if (valid.size === current.size) {
        let unchanged = true;
        current.forEach((selector) => {
          if (!valid.has(selector)) unchanged = false;
        });
        if (unchanged) return current;
      }
      return valid;
    });
  }, [targetChildrenByParent]);

  const reloadPageOffsets = () => {
    const storage = readStorage();
    const nextPageOffsets = sanitizePageOffsets(storage[pathname] || {});
    const nextGroups = readGroupStorage()[pathname] || [];
    setPageGroups(nextGroups);
    setPageOffsets(nextPageOffsets);
    applyStoredOffsets(nextPageOffsets);
  };

  useEffect(() => {
    if (!canBuild) {
      setActive(false);
      setSelectedSelector(null);
      setSelectedSelectors([]);
      setSelectedLabel('Click an element');
      setSelectionLayers([]);
      setSelectedLayerIndex(0);
      setAvailableTargets([]);
      setPageGroups([]);
      setPageOffsets({});
      setSelectedGroupId(null);
      setTargetMenuOpen(false);
      setExpandedTargetSelectors(new Set());
      return;
    }

    const storage = readStorage();
    const nextPageOffsets = sanitizePageOffsets(storage[pathname] || {});
    const nextGroups = readGroupStorage()[pathname] || [];
    setPageGroups(nextGroups);
    setPageOffsets(nextPageOffsets);
    applyStoredOffsets(nextPageOffsets);
    window.requestAnimationFrame(() => {
      setAvailableTargets(getAvailableTargets(nextGroups));
    });
  }, [canBuild, pathname]);

  useEffect(() => {
    if (!canBuild) return;

    const handleStorageUpdate = () => {
      reloadPageOffsets();
      window.requestAnimationFrame(() => {
        setAvailableTargets(getAvailableTargets(readGroupStorage()[pathname] || []));
      });
    };

    window.addEventListener(BUILD_STORAGE_EVENT, handleStorageUpdate);
    return () => window.removeEventListener(BUILD_STORAGE_EVENT, handleStorageUpdate);
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
      applyStoredOffsets(pageOffsets);
      setAvailableTargets(getAvailableTargets(pageGroups));
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
  }, [canBuild, pageGroups, pageOffsets, pathname]);

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
    return () => {
      if (guideHideTimeoutRef.current) {
        window.clearTimeout(guideHideTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canBuild) {
      delete document.body.dataset.buildModeActive;
      return;
    }

    if (active) {
      document.body.dataset.buildModeActive = 'true';
    } else {
      delete document.body.dataset.buildModeActive;
    }

    return () => {
      delete document.body.dataset.buildModeActive;
    };
  }, [active, canBuild]);

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

    const root = getAutoBuildRoot();

    const handlePointerMove = (event: PointerEvent) => {
      if (selectedDragRef.current?.moved) return;
      if (!isBuildElement(event.target)) {
        setHoveredRect(null);
        return;
      }

      const primaryTarget = getPrimarySelectableTargetAtPoint(event.clientX, event.clientY, root, event.target);
      if (!primaryTarget) {
        setHoveredRect(null);
        return;
      }

      const rect = primaryTarget.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) {
        setHoveredRect(null);
        return;
      }

      setHoveredRect({
        selector: getElementSelector(primaryTarget),
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    const handlePointerLeaveWindow = () => {
      setHoveredRect(null);
    };

    const handleClick = (event: MouseEvent) => {
      if (suppressSelectionClickRef.current) {
        suppressSelectionClickRef.current = false;
        return;
      }
      if (!isBuildElement(event.target)) return;
      if (event.target.closest('[data-build-ignore="true"]')) return;

      const filteredLayers = buildSelectionLayersForPoint(event.target, event.clientX, event.clientY, root);

      if (!filteredLayers.length) return;

      event.preventDefault();
      event.stopPropagation();

      const signature = filteredLayers.map((layer) => layer.selector).join('|');
      const additiveMode = event.shiftKey || multiSelectMode;

      if (additiveMode) {
        const targetLayer = filteredLayers[0];
        const isAlreadySelected = selectedSelectors.includes(targetLayer.selector);
        const nextSelectedSelectors = isAlreadySelected
          ? selectedSelectors.filter((selector) => selector !== targetLayer.selector)
          : [...selectedSelectors, targetLayer.selector];

        setSelectionLayers(filteredLayers);
        setSelectedLayerIndex(0);
        setSelectedSelector(targetLayer.selector);
        setSelectedLabel(targetLayer.label);
        setSelectedSelectors(nextSelectedSelectors.length ? nextSelectedSelectors : [targetLayer.selector]);
        setSelectedGroupId(null);
        setStyleControls(getStyleControlState(targetLayer.selector));
        lastSelectionRef.current = {
          x: event.clientX,
          y: event.clientY,
          signature,
        };
        return;
      }

      const lastSelection = lastSelectionRef.current;
      const isSameSpot =
        lastSelection &&
        Math.abs(lastSelection.x - event.clientX) <= 6 &&
        Math.abs(lastSelection.y - event.clientY) <= 6 &&
        lastSelection.signature === signature;

      const nextIndex =
        isSameSpot && signature === selectionLayers.map((layer) => layer.selector).join('|')
          ? (selectedLayerIndex + 1) % filteredLayers.length
          : 0;

      lastSelectionRef.current = {
        x: event.clientX,
        y: event.clientY,
        signature,
      };

      setSelectionLayers(filteredLayers);
      setSelectedLayerIndex(nextIndex);
      setSelectedSelector(filteredLayers[nextIndex].selector);
      setSelectedLabel(filteredLayers[nextIndex].label);
      setSelectedSelectors([filteredLayers[nextIndex].selector]);
      setSelectedGroupId(null);
      setStyleControls(getStyleControlState(filteredLayers[nextIndex].selector));
    };

    document.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('blur', handlePointerLeaveWindow);
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('blur', handlePointerLeaveWindow);
      document.removeEventListener('click', handleClick, true);
    };
  }, [active, multiSelectMode, selectedLayerIndex, selectedSelectors, selectionLayers]);

  useEffect(() => {
    if (!active || !selectedSelector) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (!isBuildElement(event.target)) return;
      if (event.target.closest('[data-build-ignore="true"]')) return;

      const selectedElement = document.querySelector(selectedSelector);
      if (!isBuildElement(selectedElement)) return;
      if (!(selectedElement === event.target || selectedElement.contains(event.target))) return;

      event.preventDefault();
      const dragSelectors = resolvePositionSelectors(selectedSelectors.length ? selectedSelectors : [selectedSelector]);
      const origins = dragSelectors.reduce<Record<string, { x: number; y: number; label: string }>>((acc, selector) => {
        acc[selector] = {
          x: pageOffsets[selector]?.x || 0,
          y: pageOffsets[selector]?.y || 0,
          label: pageOffsets[selector]?.label || availableTargets.find((target) => target.selector === selector)?.label || selectedLabel,
        };
        return acc;
      }, {});

      selectedDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origins,
        moved: false,
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = selectedDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (!dragState.moved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
        dragState.moved = true;
        setShowAlignmentGuides(true);
      }

      if (!dragState.moved) return;

      setPageOffsets((current) => {
        const next = { ...current };
        Object.entries(dragState.origins).forEach(([selector, origin]) => {
          next[selector] = {
            ...(current[selector] || { label: origin.label }),
            x: origin.x + deltaX,
            y: origin.y + deltaY,
            label: current[selector]?.label || origin.label,
          };
        });
        const storage = readStorage();
        writeStorage({
          ...storage,
          [pathname]: next,
        });
        return next;
      });
      Object.entries(dragState.origins).forEach(([selector, origin]) => {
        applyOffset(selector, {
          ...(pageOffsets[selector] || { label: origin.label }),
          x: origin.x + deltaX,
          y: origin.y + deltaY,
          label: pageOffsets[selector]?.label || origin.label,
        });
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragState = selectedDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      suppressSelectionClickRef.current = dragState.moved;
      selectedDragRef.current = null;
      setShowAlignmentGuides(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerup', handlePointerUp, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
    };
  }, [active, availableTargets, pageOffsets, pathname, selectedLabel, selectedSelector, selectedSelectors]);

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
        const selectors = resolvePositionSelectors(selectedSelectors.length ? selectedSelectors : [selectedSelector]);
        const next = { ...current };
        selectors.forEach((selector) => {
          const label = current[selector]?.label || availableTargets.find((target) => target.selector === selector)?.label || selectedLabel;
          const existing = current[selector] || { x: 0, y: 0, label };
          next[selector] = {
            ...existing,
            x: existing.x + deltaX,
            y: existing.y + deltaY,
            label: existing.label || label,
          };
        });

        const storage = readStorage();
        writeStorage({
          ...storage,
          [pathname]: next,
        });
        selectors.forEach((selector) => applyOffset(selector, next[selector]));
        return next;
      });
      pulseAlignmentGuides();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, availableTargets, pathname, selectedLabel, selectedSelector, selectedSelectors]);

  useEffect(() => {
    if (!selectedSelector) {
      setSelectedRects([]);
      setStyleControls({
        width: '',
        height: '',
        fontSize: '',
        color: '#ffffff',
        backgroundColor: '#000000',
      });
      return;
    }

    setStyleControls(getStyleControlState(selectedSelector));
  }, [selectedSelector]);

  useEffect(() => {
    if (!active || !(selectedSelectors.length || selectedSelector)) {
      setSelectedRects([]);
      return;
    }

    let frame = 0;

    const updateRect = () => {
      const selectors = selectedSelectors.length ? selectedSelectors : (selectedSelector ? [selectedSelector] : []);
      const nextRects = selectors.reduce<SelectedRect[]>((acc, selector) => {
        const element = document.querySelector(selector);
        if (!isBuildElement(element)) return acc;
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          acc.push({
            selector,
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          });
        }
        return acc;
      }, []);
      setSelectedRects(nextRects);

      frame = window.requestAnimationFrame(updateRect);
    };

    frame = window.requestAnimationFrame(updateRect);
    return () => window.cancelAnimationFrame(frame);
  }, [active, pageOffsets, selectedSelector, selectedSelectors]);

  useEffect(() => {
    if (!active) {
      setHoveredRect(null);
    }
  }, [active]);

  useEffect(() => {
    if (!active || !selectedSelector || !showAlignmentGuides) {
      setAlignmentGuides([]);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setAlignmentGuides(getAlignmentGuidesForSelector(selectedSelector));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [active, pageOffsets, selectedSelector, showAlignmentGuides]);

  const pulseAlignmentGuides = (duration = 450) => {
    setShowAlignmentGuides(true);
    if (guideHideTimeoutRef.current) {
      window.clearTimeout(guideHideTimeoutRef.current);
    }
    guideHideTimeoutRef.current = window.setTimeout(() => {
      setShowAlignmentGuides(false);
      guideHideTimeoutRef.current = null;
    }, duration);
  };

  const selectLayerByIndex = (index: number) => {
    if (!selectionLayers.length) return;
    const safeIndex = ((index % selectionLayers.length) + selectionLayers.length) % selectionLayers.length;
    setSelectedLayerIndex(safeIndex);
    setSelectedSelector(selectionLayers[safeIndex].selector);
    setSelectedLabel(selectionLayers[safeIndex].label);
    setSelectedSelectors([selectionLayers[safeIndex].selector]);
    setSelectedGroupId(null);
    setStyleControls(getStyleControlState(selectionLayers[safeIndex].selector));
  };

  const handleTargetSelect = (value: string) => {
    const nextTarget = availableTargets.find((target) => target.selector === value);
    if (!nextTarget) return;

    if (nextTarget.kind === 'group' && nextTarget.members?.length) {
      setSelectedGroupId(nextTarget.groupId || null);
      setSelectedSelectors(nextTarget.members);
      setSelectedSelector(nextTarget.members[0]);
      setSelectedLabel(nextTarget.label);
      setSelectionLayers([]);
      setSelectedLayerIndex(0);
      setStyleControls(getStyleControlState(nextTarget.members[0]));
      setTargetMenuOpen(false);
      return;
    }

    setSelectedGroupId(null);
    setSelectedSelector(nextTarget.selector);
    setSelectedLabel(nextTarget.label);
    setSelectedSelectors([nextTarget.selector]);
    setSelectionLayers([]);
    setSelectedLayerIndex(0);
    setStyleControls(getStyleControlState(nextTarget.selector));
    setTargetMenuOpen(false);
  };

  const toggleTargetFolder = (selector: string) => {
    setExpandedTargetSelectors((current) => {
      const next = new Set(current);
      if (next.has(selector)) {
        next.delete(selector);
      } else {
        next.add(selector);
      }
      return next;
    });
  };

  const renderTargetTree = (parentSelector: string | null, depth = 0): JSX.Element[] => {
    const children = targetChildrenByParent.get(parentSelector) || [];
    return children.flatMap((target) => {
      const nestedChildren = targetChildrenByParent.get(target.selector) || [];
      const isExpandable = target.targetType === 'group' && !target.isManualGroup && nestedChildren.length > 0;
      const isExpanded = isExpandable && expandedTargetSelectors.has(target.selector);
      const isSelected = selectedTargetValue === target.selector;

      const row = (
        <div key={target.selector}>
          <button
            type="button"
            onClick={() => handleTargetSelect(target.selector)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
              isSelected ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/60'
            }`}
            style={{ paddingLeft: `${Math.min(88, 8 + depth * 14)}px` }}
          >
            {isExpandable ? (
              <span
                role="button"
                tabIndex={0}
                aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleTargetFolder(target.selector);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  event.stopPropagation();
                  toggleTargetFolder(target.selector);
                }}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </span>
            ) : (
              <span className="h-4 w-4 shrink-0" />
            )}
            <TargetOptionIcon target={target} />
            <span className="truncate">{target.label}</span>
          </button>
          {isExpandable && isExpanded ? renderTargetTree(target.selector, depth + 1) : null}
        </div>
      );

      return [row];
    });
  };

  const groupSelection = () => {
    const selectors = selectedSelectors.length ? selectedSelectors : (selectedSelector ? [selectedSelector] : []);
    if (selectors.length < 2) return;

    const labelBase = selectedLabel && selectedLabel !== 'Click an element' ? selectedLabel : 'Custom group';
    const group: BuildGroup = {
      id: `group-${Date.now()}`,
      label: labelBase.replace(/^Group:\s*/, ''),
      members: Array.from(new Set(selectors)),
    };

    const storage = readGroupStorage();
    const nextGroups = [...(storage[pathname] || []), group];
    writeGroupStorage({
      ...storage,
      [pathname]: nextGroups,
    });
    setPageGroups(nextGroups);
    setSelectedGroupId(group.id);
    setSelectedLabel(`Group: ${group.label}`);
  };

  const ungroupSelection = () => {
    if (!selectedGroupId) return;
    const storage = readGroupStorage();
    const nextGroups = (storage[pathname] || []).filter((group) => group.id !== selectedGroupId);
    writeGroupStorage({
      ...storage,
      [pathname]: nextGroups,
    });
    setPageGroups(nextGroups);
    setSelectedGroupId(null);
    if (selectedSelectors.length) {
      setSelectedSelector(selectedSelectors[0]);
      setSelectedLabel(availableTargets.find((target) => target.selector === selectedSelectors[0])?.label || selectedLabel);
      setStyleControls(getStyleControlState(selectedSelectors[0]));
    }
  };

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
    const selectors = resolvePositionSelectors(selectedSelectors.length ? selectedSelectors : [selectedSelector]);

    setPageOffsets((current) => {
      const next = { ...current };
      selectors.forEach((selector) => {
        const label = current[selector]?.label || availableTargets.find((target) => target.selector === selector)?.label || selectedLabel;
        const existing = current[selector] || { x: 0, y: 0, label };
        next[selector] = {
          ...existing,
          x: existing.x + deltaX,
          y: existing.y + deltaY,
          label: existing.label || label,
        };
      });
      const storage = readStorage();
      writeStorage({
        ...storage,
        [pathname]: next,
      });
      selectors.forEach((selector) => applyOffset(selector, next[selector]));
      return next;
    });
    pulseAlignmentGuides();
  };

  const updateSelectedStyles = (partial: Partial<StyleControlState>) => {
    if (!selectedSelector) return;
    const selectors = selectedSelectors.length ? selectedSelectors : [selectedSelector];

    const nextControls = { ...styleControls, ...partial };
    setStyleControls(nextControls);

    setPageOffsets((current) => {
      const next = { ...current };
      selectors.forEach((selector) => {
        const label = current[selector]?.label || availableTargets.find((target) => target.selector === selector)?.label || selectedLabel;
        const nextEntry: StoredOffset = {
          ...(current[selector] || { x: 0, y: 0, label }),
          label,
        };

        if ('width' in partial) {
          nextEntry.width = nextControls.width ? Number(nextControls.width) : undefined;
        }
        if ('height' in partial) {
          nextEntry.height = nextControls.height ? Number(nextControls.height) : undefined;
        }
        if ('fontSize' in partial) {
          nextEntry.fontSize = nextControls.fontSize ? Number(nextControls.fontSize) : undefined;
        }
        if ('color' in partial) {
          nextEntry.color = nextControls.color || undefined;
        }
        if ('backgroundColor' in partial) {
          nextEntry.backgroundColor = nextControls.backgroundColor || undefined;
        }
        next[selector] = nextEntry;
      });

      const storage = readStorage();
      writeStorage({
        ...storage,
        [pathname]: next,
      });
      selectors.forEach((selector) => applyOffset(selector, next[selector]));
      return next;
    });
  };

  const resetSelected = () => {
    if (!selectedSelector) return;
    const selectors = selectedSelectors.length ? selectedSelectors : [selectedSelector];
    setPageOffsets((current) => {
      const next = { ...current };
      selectors.forEach((selector) => {
        delete next[selector];
        const element = document.querySelector(selector);
        if (isBuildElement(element)) {
          clearOffset(element);
        }
      });
      const storage = readStorage();
      writeStorage({
        ...storage,
        [pathname]: next,
      });
      return next;
    });
    window.requestAnimationFrame(() => {
      setStyleControls(getStyleControlState(selectedSelector));
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
    const groupStorage = readGroupStorage();
    delete groupStorage[pathname];
    writeGroupStorage(groupStorage);
    setPageOffsets({});
    setPageGroups([]);
    setSelectedGroupId(null);
  };

  const resetAllBuildChanges = () => {
    Object.keys(pageOffsets).forEach((selector) => {
      const element = document.querySelector(selector);
      if (isBuildElement(element)) {
        clearOffset(element);
      }
    });

    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(GROUP_STORAGE_KEY);
    window.localStorage.removeItem(BUTTON_POSITION_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(BUILD_STORAGE_EVENT));
    setPageOffsets({});
    setPageGroups([]);
    setSelectedSelector(null);
    setSelectedSelectors([]);
    setSelectedGroupId(null);
    setSelectedLabel('Click an element');
    setSelectionLayers([]);
    setSelectedLayerIndex(0);
    setButtonPosition(getDefaultButtonPosition());
  };

  return (
    <div
      data-build-ignore="true"
      className="pointer-events-none fixed z-[70] flex flex-col items-end gap-3"
      style={{ left: buttonPosition.x, top: buttonPosition.y }}
    >
      {active ? (
        <>
          {hoveredRect && !selectedRects.some((rect) => rect.selector === hoveredRect.selector) ? (
            <div
              className="fixed rounded-xl border border-cyan-300/85 bg-cyan-200/5 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
              style={{
                left: `${hoveredRect.left}px`,
                top: `${hoveredRect.top}px`,
                width: `${hoveredRect.width}px`,
                height: `${hoveredRect.height}px`,
              }}
            />
          ) : null}
          {selectedRects.map((rect) => (
            <div
              key={rect.selector}
              className="fixed rounded-xl border-2 border-amber-300/95 bg-amber-200/6 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_0_18px_rgba(252,211,77,0.2)]"
              style={{
                left: `${rect.left}px`,
                top: `${rect.top}px`,
                width: `${rect.width}px`,
                height: `${rect.height}px`,
              }}
            />
          ))}
          {alignmentGuides.map((guide) => {
            if (guide.orientation === 'vertical') {
              const length = Math.max(0, guide.end - guide.start);
              const segmentLength = Math.min(10, Math.max(4, length / 3));
              return (
                <div key={guide.key}>
                  <div
                    className="fixed w-0 border-l border-dashed border-cyan-300/80"
                    style={{
                      left: `${guide.position}px`,
                      top: `${guide.start}px`,
                      height: `${length}px`,
                    }}
                  />
                  <div
                    className="fixed w-0 border-l-2 border-dashed border-emerald-400"
                    style={{
                      left: `${guide.position}px`,
                      top: `${guide.start}px`,
                      height: `${segmentLength}px`,
                    }}
                  />
                  <div
                    className="fixed w-0 border-l-2 border-dashed border-emerald-400"
                    style={{
                      left: `${guide.position}px`,
                      top: `${Math.max(guide.start, guide.end - segmentLength)}px`,
                      height: `${segmentLength}px`,
                    }}
                  />
                </div>
              );
            }

            const length = Math.max(0, guide.end - guide.start);
            const segmentLength = Math.min(10, Math.max(4, length / 3));
            return (
              <div key={guide.key}>
                <div
                  className="fixed h-0 border-t border-dashed border-cyan-300/80"
                  style={{
                    left: `${guide.start}px`,
                    top: `${guide.position}px`,
                    width: `${length}px`,
                  }}
                />
                <div
                  className="fixed h-0 border-t-2 border-dashed border-emerald-400"
                  style={{
                    left: `${guide.start}px`,
                    top: `${guide.position}px`,
                    width: `${segmentLength}px`,
                  }}
                />
                <div
                  className="fixed h-0 border-t-2 border-dashed border-emerald-400"
                  style={{
                    left: `${Math.max(guide.start, guide.end - segmentLength)}px`,
                    top: `${guide.position}px`,
                    width: `${segmentLength}px`,
                  }}
                />
              </div>
            );
          })}
        </>
      ) : null}

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
                Click any element, then nudge it into place. Shift-click adds more on desktop.
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
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{selectedSelectors.length > 1 ? `${selectedSelectors.length} elements selected` : '1 element selected'}</span>
              <div className="flex items-center gap-1">
                {selectedSelectors.length > 1 && !selectedGroupId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2"
                    onClick={groupSelection}
                  >
                    Group
                  </Button>
                ) : null}
                {selectedGroupId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2"
                    onClick={ungroupSelection}
                  >
                    Ungroup
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant={multiSelectMode ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 rounded-full px-2"
                  onClick={() => setMultiSelectMode((current) => !current)}
                >
                  Multi-select
                </Button>
              </div>
            </div>
            {availableTargets.length ? (
              <label className="mt-2 block">
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Target</span>
                <Popover open={targetMenuOpen} onOpenChange={setTargetMenuOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="mt-1 flex h-8 w-full items-center justify-between rounded-xl border border-border/70 bg-background px-2 text-xs"
                      data-build-ignore="true"
                    >
                      {selectedTargetOption ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <TargetOptionIcon target={selectedTargetOption} />
                          <span className="truncate text-foreground">{selectedTargetOption.label}</span>
                        </span>
                      ) : (
                        <span className="truncate text-muted-foreground">Select a target</span>
                      )}
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="z-[120] max-h-72 w-[--radix-popover-trigger-width] overflow-y-auto rounded-2xl border-border/70 bg-background p-2"
                    data-build-ignore="true"
                  >
                    <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Targets
                    </p>
                    <div className="space-y-0.5">{renderTargetTree(null, 0)}</div>
                  </PopoverContent>
                </Popover>
              </label>
            ) : null}
            {selectionLayers.length > 1 ? (
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2"
                  onClick={() => selectLayerByIndex(selectedLayerIndex - 1)}
                >
                  Prev
                </Button>
                <span>
                  Layer {selectedLayerIndex + 1} of {selectionLayers.length}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2"
                  onClick={() => selectLayerByIndex(selectedLayerIndex + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-destructive hover:text-destructive"
              onClick={resetAllBuildChanges}
            >
              Reset everything
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2 text-left">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Width</span>
              <input
                type="number"
                min="1"
                value={styleControls.width}
                onChange={(event) => updateSelectedStyles({ width: event.target.value })}
                disabled={!selectedSelector}
                className="mt-1 w-full bg-transparent text-sm text-foreground outline-none disabled:opacity-50"
              />
            </label>
            <label className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2 text-left">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Height</span>
              <input
                type="number"
                min="1"
                value={styleControls.height}
                onChange={(event) => updateSelectedStyles({ height: event.target.value })}
                disabled={!selectedSelector}
                className="mt-1 w-full bg-transparent text-sm text-foreground outline-none disabled:opacity-50"
              />
            </label>
            <label className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2 text-left">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Font size</span>
              <input
                type="number"
                min="1"
                value={styleControls.fontSize}
                onChange={(event) => updateSelectedStyles({ fontSize: event.target.value })}
                disabled={!selectedSelector}
                className="mt-1 w-full bg-transparent text-sm text-foreground outline-none disabled:opacity-50"
              />
            </label>
            <label className="rounded-2xl border border-border/70 bg-muted/20 px-3 py-2 text-left">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Text color</span>
              <input
                type="color"
                value={styleControls.color}
                onChange={(event) => updateSelectedStyles({ color: event.target.value })}
                disabled={!selectedSelector}
                className="mt-1 h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0 disabled:opacity-50"
              />
            </label>
          </div>

          <label className="mt-2 block rounded-2xl border border-border/70 bg-muted/20 px-3 py-2 text-left">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Background color</span>
            <input
              type="color"
              value={styleControls.backgroundColor}
              onChange={(event) => updateSelectedStyles({ backgroundColor: event.target.value })}
              disabled={!selectedSelector}
              className="mt-1 h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0 disabled:opacity-50"
            />
          </label>

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
            Tip: use keyboard arrows for 1px moves, hold Shift for 10px, and use Shift-click or Multi-select to move several elements together.
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
