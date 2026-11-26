import type { NormRect, Page, ReadingDirection } from './types';

/**
 * Sigil View camera. Given a page drawn at `pageSize` (points) and a viewport,
 * compute the scale and translation that fit one panel in the viewport with
 * padding, centered. Pure math so it can be tested and reused by any renderer.
 */

export type Size = { width: number; height: number };
export type Camera = { scale: number; translateX: number; translateY: number };

export function fitPageWidth(page: { width: number; height: number }, viewportWidth: number): Size {
  return { width: viewportWidth, height: (viewportWidth * page.height) / page.width };
}

export function cameraForRect(
  rect: NormRect,
  pageSize: Size,
  viewport: Size,
  padding = 16,
  maxScale = 4,
): Camera {
  const rw = Math.max(1, rect.w * pageSize.width);
  const rh = Math.max(1, rect.h * pageSize.height);
  const availW = Math.max(1, viewport.width - padding * 2);
  const availH = Math.max(1, viewport.height - padding * 2);
  const scale = Math.min(availW / rw, availH / rh, maxScale);
  const cx = (rect.x + rect.w / 2) * pageSize.width;
  const cy = (rect.y + rect.h / 2) * pageSize.height;
  // Transform is applied as: translate, then scale around the page origin.
  return {
    scale,
    translateX: viewport.width / 2 - cx * scale,
    translateY: viewport.height / 2 - cy * scale,
  };
}

export const FULL_PAGE: NormRect = { x: 0, y: 0, w: 1, h: 1 };

export type Step = { page: number; panel: number };

/**
 * Next panel in reading order. Panels are stored in reading order already
 * (the manifest is authored per direction), so RTL only changes which edge
 * of the screen advances — handled by `tapZoneAction`.
 */
export function nextStep(pages: Page[], at: Step): Step | null {
  const page = pages[at.page];
  if (!page) return null;
  if (at.panel + 1 < page.panels.length) return { page: at.page, panel: at.panel + 1 };
  if (at.page + 1 < pages.length) return { page: at.page + 1, panel: 0 };
  return null;
}

export function prevStep(pages: Page[], at: Step): Step | null {
  if (at.panel > 0) return { page: at.page, panel: at.panel - 1 };
  if (at.page > 0) {
    const prev = pages[at.page - 1];
    return { page: at.page - 1, panel: Math.max(0, prev.panels.length - 1) };
  }
  return null;
}

/**
 * Tap zones: outer 30% of each edge. For LTR the right edge advances; for RTL
 * the left edge advances (like turning a manga page). Center opens the menu.
 */
export function tapZoneAction(
  x: number,
  width: number,
  direction: ReadingDirection,
): 'next' | 'prev' | 'menu' {
  const edge = width * 0.3;
  const zone = x < edge ? 'left' : x > width - edge ? 'right' : 'center';
  if (zone === 'center') return 'menu';
  const forwardEdge = direction === 'rtl' ? 'left' : 'right';
  return zone === forwardEdge ? 'next' : 'prev';
}

/** Overall progress through a chapter, 0..1, counting panels. */
export function chapterProgress(pages: Page[], at: Step): number {
  const total = pages.reduce((n, p) => n + Math.max(1, p.panels.length), 0);
  let done = 0;
  for (let i = 0; i < at.page; i++) done += Math.max(1, pages[i].panels.length);
  done += at.panel + 1;
  return total === 0 ? 0 : Math.min(1, done / total);
}

/** Inverse camera: a screen point (viewport coords) to normalized page coords. */
export function screenToPage(
  point: { x: number; y: number },
  camera: Camera,
  pageSize: Size,
): { x: number; y: number } {
  return {
    x: (point.x - camera.translateX) / camera.scale / pageSize.width,
    y: (point.y - camera.translateY) / camera.scale / pageSize.height,
  };
}

/** First rect containing the normalized point, expanded by `slop` (normalized). */
export function hitRect<T extends { rect: NormRect }>(
  items: T[],
  p: { x: number; y: number },
  slop = 0.02,
): T | undefined {
  return items.find(
    (i) =>
      p.x >= i.rect.x - slop &&
      p.x <= i.rect.x + i.rect.w + slop &&
      p.y >= i.rect.y - slop &&
      p.y <= i.rect.y + i.rect.h + slop,
  );
}

/**
 * Which panel a vertical reading line has reached on a page drawn `height`
 * tall: the last panel (in reading order) whose top edge is above `lineY`.
 */
export function panelAtLine(page: Page, lineY: number, height: number): number {
  let idx = 0;
  page.panels.forEach((p, i) => {
    if (p.rect.y * height <= lineY) idx = i;
  });
  return idx;
}

/**
 * `cameraForRect` assumes scaling about the page's top-left corner. Native and
 * web views scale about their center, so shift the translation by
 * -(size/2)·(1 - scale) to land on the same framing.
 */
export function originCompensation(camera: Camera, pageSize: Size): { x: number; y: number } {
  return {
    x: camera.translateX - (pageSize.width / 2) * (1 - camera.scale),
    y: camera.translateY - (pageSize.height / 2) * (1 - camera.scale),
  };
}

/**
 * Group page indexes for display. Single: one page per screen. Spread: pairs,
 * with an odd trailing page on its own.
 */
export function spreadsFor(pageCount: number, spread: boolean): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < pageCount; i += spread ? 2 : 1) {
    out.push(spread && i + 1 < pageCount ? [i, i + 1] : [i]);
  }
  return out;
}
