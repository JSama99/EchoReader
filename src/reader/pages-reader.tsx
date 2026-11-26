import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { spreadsFor, type Step } from '@/domain/sigil';
import type { Chapter, GlyphHotspot, Position, ReadingDirection } from '@/domain/types';
import { fitPage, type FitMode } from '@/domain/fit';

import { PageArt } from './page-art';
import { Zoomable } from './zoomable';

const GAP = 4;

/**
 * Whole pages, swiped. Fit page / width / height, pinch and double-tap zoom.
 * On wide landscape screens in fit-page mode, pages pair into spreads.
 * Right-to-left books invert the list and the pair order, like a printed manga.
 */
export function PagesReader({
  chapter,
  pageCount,
  initialPage,
  direction,
  fit,
  background,
  furthest,
  echoEnabled,
  showPins,
  reduceMotion,
  onStep,
  onGlyph,
  onTap,
  listRef,
}: {
  chapter: Chapter;
  /** Readable pages (fewer than chapter.pages for previews). */
  pageCount: number;
  initialPage: number;
  direction: ReadingDirection;
  fit: FitMode;
  background: string;
  furthest: Position;
  echoEnabled: boolean;
  showPins: boolean;
  reduceMotion: boolean;
  onStep: (s: Step) => void;
  onGlyph: (g: GlyphHotspot) => void;
  onTap: () => void;
  listRef?: React.RefObject<FlatList<number[]> | null>;
}) {
  const [vp, setVp] = useState({ width: 0, height: 0 });
  const [zoomed, setZoomed] = useState(false);
  const last = useRef(-1);
  const pages = chapter.pages.slice(0, pageCount);
  const spread = fit === 'page' && vp.width > vp.height && vp.width >= 900;
  const groups = useMemo(() => spreadsFor(pages.length, spread), [pages.length, spread]);
  const initialIndex = Math.max(0, groups.findIndex((g) => g.includes(initialPage)));

  const report = (groupIndex: number) => {
    if (groupIndex === last.current || !groups[groupIndex]) return;
    last.current = groupIndex;
    // Seeing a whole page (or spread) counts as reaching its last panel.
    const page = groups[groupIndex][groups[groupIndex].length - 1];
    onStep({ page, panel: Math.max(0, pages[page].panels.length - 1) });
  };

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, vp.width));
    report(Math.min(groups.length - 1, Math.max(0, i)));
  };

  return (
    <View style={{ flex: 1, backgroundColor: background }} onLayout={(e) => setVp(e.nativeEvent.layout)}>
      {vp.width > 0 && (
        <FlatList
          ref={listRef}
          key={`${spread ? 'spread' : 'single'}-${fit}`}
          data={groups}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          inverted={direction === 'rtl'}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: vp.width, offset: vp.width * index, index })}
          onMomentumScrollEnd={onEnd}
          onScrollToIndexFailed={() => {}}
          onLayout={() => report(initialIndex)}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(g) => g.join('-')}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          renderItem={({ item }) => {
            const group = (direction === 'rtl' ? [...item].reverse() : item).map((i) => ({ i, p: pages[i] }));
            const pad = fit === 'page' ? 16 : 0;
            let sizes = group.map(({ p }) => fitPage(p, vp, fit, pad));
            if (group.length > 1) {
              // Spreads share a height so the pages sit flush.
              const ratioSum = group.reduce((a, { p }) => a + p.width / p.height, 0);
              const h = Math.min(vp.height - pad * 2, (vp.width - pad * 2 - GAP * (group.length - 1)) / ratioSum);
              sizes = group.map(({ p }) => ({ width: (h * p.width) / p.height, height: h }));
            }
            const contentW = sizes.reduce((a, s) => a + s.width, 0) + GAP * (sizes.length - 1);
            const contentH = Math.max(...sizes.map((s) => s.height));
            const art = (
              <Pressable onPress={onTap} style={{ flexDirection: 'row', gap: GAP }} accessibilityLabel={`Page ${group.map(({ p }) => p.label).join(' and ')}`}>
                {group.map(({ i, p }, k) => (
                  <PageArt
                    key={p.id}
                    page={p}
                    pageIndex={i}
                    chapterNumber={chapter.number}
                    width={sizes[k].width}
                    height={sizes[k].height}
                    furthest={furthest}
                    echoEnabled={echoEnabled}
                    showPins={showPins}
                    onGlyph={onGlyph}
                  />
                ))}
              </Pressable>
            );
            const overflowsV = contentH > vp.height + 1;
            const overflowsH = contentW > vp.width + 1;
            return (
              <View style={{ width: vp.width, height: vp.height, alignItems: 'center', justifyContent: 'center' }}>
                {overflowsV || overflowsH ? (
                  <ScrollView
                    horizontal={overflowsH && !overflowsV}
                    style={{ width: vp.width, height: vp.height }}
                    contentContainerStyle={{ alignItems: 'center', justifyContent: 'center', minWidth: vp.width, minHeight: vp.height }}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                  >
                    {art}
                  </ScrollView>
                ) : (
                  <Zoomable width={contentW} height={contentH} onZoomChange={setZoomed} reduceMotion={reduceMotion}>
                    {art}
                  </Zoomable>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
