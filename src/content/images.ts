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
  'fs1-p04': require('@/assets/content/flame-sigil/ch1_p04.jpg'),
  'fs1-end': require('@/assets/content/flame-sigil/ch1_p22_finale.jpg'),
};

export const coverImages: Record<string, number> = {
  'flame-sigil': require('@/assets/content/flame-sigil/fs_cover.jpg'),
};

export const portraitImages: Record<string, number> = {
  'malik-blaze': require('@/assets/content/flame-sigil/malik_portrait.jpg'),
};
