/**
 * Bundled art, keyed by id. Kept apart from catalog.ts so the catalog stays
 * plain data. Metro needs static require() calls, so every image is listed here.
 */
export const pageImages: Record<string, number> = {
  'fs1-p04': require('@/assets/content/flame-sigil/ch1_p04.jpg'),
  'fs1-end': require('@/assets/content/flame-sigil/ch1_p22_finale.jpg'),
};

export const coverImages: Record<string, number> = {
  'flame-sigil': require('@/assets/content/flame-sigil/fs_cover.jpg'),
};

export const portraitImages: Record<string, number> = {
  'malik-blaze': require('@/assets/content/flame-sigil/malik_portrait.jpg'),
};
