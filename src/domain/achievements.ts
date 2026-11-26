/**
 * Achievements: earned only from things the reader actually did on this
 * device. Each one awards Embers once through the 'achievement' reward rule.
 */

export type AchievementInput = {
  finishedOriginals: number;
  discoveredGlyphs: number;
  imported: number;
  streak: number;
  fragments: number;
  collections: number;
  bookmarks: number;
};

export type Achievement = { id: string; title: string; detail: string; earned: (i: AchievementInput) => boolean };

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-chapter', title: 'First Signal', detail: 'Finish an original chapter', earned: (i) => i.finishedOriginals >= 1 },
  { id: 'first-glyph', title: 'Glyph Reader', detail: 'Discover an Echo Layer glyph', earned: (i) => i.discoveredGlyphs >= 1 },
  { id: 'glyph-hunter', title: 'Glyph Hunter', detail: 'Discover three glyphs', earned: (i) => i.discoveredGlyphs >= 3 },
  { id: 'first-fragment', title: 'Keeper of Fragments', detail: 'Find a Memory Fragment', earned: (i) => i.fragments >= 1 },
  { id: 'first-import', title: 'Your Shelf', detail: 'Import a comic of your own', earned: (i) => i.imported >= 1 },
  { id: 'curator', title: 'Curator', detail: 'Create a collection', earned: (i) => i.collections >= 1 },
  { id: 'marked', title: 'Marked', detail: 'Bookmark a page', earned: (i) => i.bookmarks >= 1 },
  { id: 'streak-7', title: 'Seven Nights', detail: 'Read seven days in a row', earned: (i) => i.streak >= 7 },
];

export function earnedAchievements(i: AchievementInput): string[] {
  return ACHIEVEMENTS.filter((a) => a.earned(i)).map((a) => a.id);
}
