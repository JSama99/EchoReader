import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { spreadsFor, type Step } from '@/domain/sigil';
import type { Chapter, GlyphHotspot, Position, ReadingDirection } from '@/domain/types';

import { PageArt } from './page-art';

const GAP = 4;

/**
 * Whole pages, swiped. On wide landscape screens (tablets, desktop) pages
 * pair into spreads. Right-to-left books invert the list and the pair order,
 * like a printed manga.
 */
export function PagesReader({
  chapter,
  initialPage,
  direction,
  furthest,
  echoEnabled,
  onStep,
  onGlyph,
  onTap,
}: {
  chapter: Chapter;
  initialPage: number;
  direction: ReadingDirection;
  furthest: Position;
  echoEnabled: boolean;
  onStep: (s: Step) => void;
  onGlyph: (g: GlyphHotspot) => void;
  onTap: () => void;
}) {
  const [vp, setVp] = useState({ width: 0, height: 0 });
  const last = useRef(-1);
  const spread = vp.width > vp.height && vp.width >= 900;
  const groups = useMemo(() => spreadsFor(chapter.pages.length, spread), [chapter.pages.length, spread]);
  const initialIndex = Math.max(0, groups.findIndex((g) => g.includes(initialPage)));

  const report = (groupIndex: number) => {
    if (groupIndex === last.current) return;
    last.current = groupIndex;
    // Seeing a whole page (or spread) counts as reaching its last panel.
    const page = groups[groupIndex][groups[groupIndex].length - 1];
    onStep({ page, panel: Math.max(0, chapter.pages[page].panels.length - 1) });
  };

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, vp.width));
    report(Math.min(groups.length - 1, Math.max(0, i)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setVp(e.nativeEvent.layout)}>
      {vp.width > 0 && (
        <FlatList
          key={spread ? 'spread' : 'single'}
          data={groups}
          horizontal
          pagingEnabled
          inverted={direction === 'rtl'}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: vp.width, offset: vp.width * index, index })}
          onMomentumScrollEnd={onEnd}
          onLayout={() => report(initialIndex)}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(g) => g.join('-')}
          renderItem={({ item }) => {
            const pages = (direction === 'rtl' ? [...item].reverse() : item).map((i) => ({ i, p: chapter.pages[i] }));
            // Fit the whole group by a shared height so pages sit flush.
            const pad = 24;
            const ratioSum = pages.reduce((a, { p }) => a + p.width / p.height, 0);
            const h = Math.min(vp.height - pad * 2, (vp.width - pad * 2 - GAP * (pages.length - 1)) / ratioSum);
            return (
              <Pressable onPress={onTap} style={{ width: vp.width, height: vp.height, flexDirection: 'row', gap: GAP, alignItems: 'center', justifyContent: 'center' }}>
                {pages.map(({ i, p }) => (
                  <PageArt
                    key={p.id}
                    page={p}
                    pageIndex={i}
                    chapterNumber={chapter.number}
                    width={(h * p.width) / p.height}
                    height={h}
                    furthest={furthest}
                    echoEnabled={echoEnabled}
                    onGlyph={onGlyph}
                  />
                ))}
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
