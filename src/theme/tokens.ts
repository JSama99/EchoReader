/**
 * Kiln design tokens. Mirrors the Paper file "EchoReader — Flame Sigil"
 * (01 · Research & Spec → Kiln — Design Foundations). One bright accent per
 * moment; Glyph Gold is reserved for lore (fragments, Echo, Codex).
 */
export const color = {
  soot: '#0B0A09',
  char: '#17140F',
  ash: '#2A251E',
  smoke: '#9A8F7E',
  bone: '#F2EBDD',
  ember: '#FF5B1F',
  storm: '#8FB8FF',
  glyph: '#E9B44C',
  black: '#000000',
  boneDim: 'rgba(242,235,221,0.82)',
  scrim: 'rgba(5,4,3,0.72)',
} as const;

export const font = {
  display: 'Unbounded_800ExtraBold',
  ui: 'InterTight_400Regular',
  uiMedium: 'InterTight_500Medium',
  uiSemibold: 'InterTight_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const;
export const radius = { sm: 6, md: 14, lg: 22, full: 999 } as const;

/** Minimum touch target (Apple HIG 44pt, Material 48dp). */
export const HIT = 44;
