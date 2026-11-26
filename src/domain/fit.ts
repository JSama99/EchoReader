import type { Page } from './types';

export type FitMode = 'page' | 'width' | 'height';

/** Size a page for a fit mode within a viewport (`pad` applies to fit-page only). */
export function fitPage(p: Pick<Page, 'width' | 'height'>, vp: { width: number; height: number }, fit: FitMode, pad: number) {
  const r = p.width / p.height;
  if (fit === 'width') return { width: vp.width, height: vp.width / r };
  if (fit === 'height') return { width: vp.height * r, height: vp.height };
  const h = Math.min(vp.height - pad * 2, (vp.width - pad * 2) / r);
  return { width: h * r, height: h };
}
