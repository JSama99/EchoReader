import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { commentCount, panelKey } from '@/content/catalog';
import { pageImages } from '@/content/images';
import { activeGlyphs } from '@/domain/spoilers';
import type { GlyphHotspot, Page, Position } from '@/domain/types';
import { color, radius } from '@/theme/tokens';
import { Bubble } from '@/ui/icons';
import { T } from '@/ui/kit';

/**
 * One page of art at an explicit size, with tappable Echo glyphs (only those
 * the reader has reached) and Cypher pins on panels that have discussion.
 */
export function PageArt({
  page,
  pageIndex,
  chapterNumber,
  width,
  height,
  furthest,
  echoEnabled,
  showPins = true,
  interactiveGlyphs = true,
  onGlyph,
}: {
  page: Page;
  pageIndex: number;
  chapterNumber: number;
  width: number;
  height: number;
  furthest: Position;
  echoEnabled: boolean;
  showPins?: boolean;
  interactiveGlyphs?: boolean;
  onGlyph: (g: GlyphHotspot) => void;
}) {
  const router = useRouter();
  // Glyphs and pins exist only on publications that declare Echo / Cypher; imported pages have none.
  const glyphs = echoEnabled ? activeGlyphs(page.glyphs, chapterNumber, pageIndex, furthest) : [];
  const source = page.src ? { uri: page.src } : pageImages[page.id];

  const pins = showPins
    ? page.panels
        .map((p, i) => ({ panel: p, i, key: panelKey(page, i), count: commentCount(panelKey(page, i)) }))
        .filter((x) => x.count > 0)
    : [];

  return (
    <View style={{ width, height }} accessibilityRole="image" accessibilityLabel={`Page ${page.label}`}>
      {source ? (
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="fill" transition={150} recyclingKey={page.id} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.missing]}>
          <T v="caption">Page unavailable</T>
        </View>
      )}

      {glyphs.map((g) => {
        const box = { left: g.rect.x * width, top: g.rect.y * height, width: g.rect.w * width, height: g.rect.h * height };
        return (
          <Pressable
            key={g.id}
            disabled={!interactiveGlyphs}
            pointerEvents={interactiveGlyphs ? 'auto' : 'none'}
            accessibilityRole="button"
            accessibilityLabel="Echo glyph. Opens a Codex entry."
            onPress={() => onGlyph(g)}
            hitSlop={12}
            style={[styles.glyph, box]}
          />
        );
      })}

      {pins.map(({ panel, key, count }) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={`${count} Cypher reactions on this panel`}
          onPress={() => router.push(`/thread/${encodeURIComponent(key)}`)}
          style={[styles.pin, { left: panel.rect.x * width + 10, top: panel.rect.y * height + 10 }]}
        >
          <Bubble size={13} />
          <T v="mono" style={{ color: color.storm }}>
            {count}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.char },
  glyph: {
    position: 'absolute',
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: color.glyph,
    backgroundColor: 'rgba(233,180,76,0.10)',
    shadowColor: color.glyph,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  pin: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: 'rgba(11,10,9,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(143,184,255,0.5)',
  },
});
