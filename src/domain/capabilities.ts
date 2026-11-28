import type { Capability, ReadingMode } from './types';

/**
 * Capability gates. The core reader needs nothing but pages; everything else
 * appears only when a publication declares it.
 */

export function has(caps: readonly Capability[] | undefined, c: Capability): boolean {
  return !!caps && caps.includes(c);
}

/** Reading modes a publication supports. Sigil View needs authored panels. */
export function modesFor(caps: readonly Capability[] | undefined): ReadingMode[] {
  return has(caps, 'sigil') ? ['sigil', 'scroll', 'pages'] : ['scroll', 'pages'];
}

/** Clamp a preferred mode to what the publication supports. */
export function supportedMode(preferred: ReadingMode, caps: readonly Capability[] | undefined): ReadingMode {
  const modes = modesFor(caps);
  return modes.includes(preferred) ? preferred : 'pages';
}

/** Capabilities every imported comic gets: plain reading, nothing more. */
export const IMPORTED_CAPABILITIES: readonly Capability[] = ['standard'];
