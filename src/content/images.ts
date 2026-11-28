/**
 * Bundled art, keyed by id. Kept apart from catalog.ts so the catalog stays
 * plain data. Metro needs static require() calls, so every image is listed here.
 */
export const pageImages: Record<string, number> = {
  'fs0-p01': require('@/assets/content/flame-sigil/prologue_p01.png'),
  'fs0-p02': require('@/assets/content/flame-sigil/prologue_p02.png'),
  'fs0-p03': require('@/assets/content/flame-sigil/prologue_p03.png'),
  'fs0-p04': require('@/assets/content/flame-sigil/prologue_p04.png'),
  'fs0-p05': require('@/assets/content/flame-sigil/prologue_p05.png'),
  'fs0-p06': require('@/assets/content/flame-sigil/prologue_p06.png'),
  'fs1-p01': require('@/assets/content/flame-sigil/ch1_p01.png'),
  'fs1-p02': require('@/assets/content/flame-sigil/ch1_p02.png'),
  'fs1-p03': require('@/assets/content/flame-sigil/ch1_p03.png'),
  'fs1-p04': require('@/assets/content/flame-sigil/ch1_p04.png'),
  'fs1-p05': require('@/assets/content/flame-sigil/ch1_p05.png'),
  'fs1-p06': require('@/assets/content/flame-sigil/ch1_p06.png'),
  'fs1-p07': require('@/assets/content/flame-sigil/ch1_p07.png'),
  'fs1-p08': require('@/assets/content/flame-sigil/ch1_p08.png'),
  'fs1-p09': require('@/assets/content/flame-sigil/ch1_p09.png'),
  'fs1-p10': require('@/assets/content/flame-sigil/ch1_p10.png'),
  'fs1-p11': require('@/assets/content/flame-sigil/ch1_p11.png'),
  'fs1-p12': require('@/assets/content/flame-sigil/ch1_p12.png'),
  'fs1-p13': require('@/assets/content/flame-sigil/ch1_p13.png'),
  'fs1-p14': require('@/assets/content/flame-sigil/ch1_p14.png'),
};

export const coverImages: Record<string, number> = {
  'flame-sigil': require('@/assets/content/flame-sigil/fs_cover.jpg'),
};

export const portraitImages: Record<string, number> = {
  'malik-blaze': require('@/assets/content/flame-sigil/malik_portrait.jpg'),
};
