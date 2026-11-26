import { useMemo, useRef, useState } from 'react';
import { ScrollView, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { fitPageWidth, panelAtLine, type Step } from '@/domain/sigil';
import type { Chapter, GlyphHotspot, Position } from '@/domain/types';

import { PageArt } from './page-art';

const GUTTER = 10;

/** Vertical strip. Progress = the panel crossing the middle of the screen. */
export function ScrollReader({
  chapter,
  initial,
  furthest,
  echoEnabled,
  onStep,
  onGlyph,
  onTap,
}: {
  chapter: Chapter;
  initial: Step;
  furthest: Position;
  echoEnabled: boolean;
  onStep: (s: Step) => void;
  onGlyph: (g: GlyphHotspot) => void;
  onTap: () => void;
}) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const last = useRef<string>('');
  const dragged = useRef(false);

  const layout = useMemo(() => {
    const sizes = chapter.pages.map((p) => fitPageWidth(p, viewport.width));
    return sizes.map((size, i) => ({
      top: sizes.slice(0, i).reduce((sum, s) => sum + s.height + GUTTER, 0),
      ...size,
    }));
  }, [chapter.pages, viewport.width]);

  const initialY = layout[initial.page]
    ? Math.max(0, layout[initial.page].top + chapter.pages[initial.page].panels[initial.panel]?.rect.y * layout[initial.page].height - 120)
    : 0;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const atEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 24;
    const line = contentOffset.y + layoutMeasurement.height * 0.5;
    let page = 0;
    layout.forEach((l, i) => {
      if (l.top <= line) page = i;
    });
    let panel = panelAtLine(chapter.pages[page], line - layout[page].top, layout[page].height);
    if (atEnd) {
      page = chapter.pages.length - 1;
      panel = chapter.pages[page].panels.length - 1;
    }
    const key = `${page}:${panel}`;
    if (key !== last.current) {
      last.current = key;
      onStep({ page, panel });
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#000' }}
      onLayout={(e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout)}
      onScroll={onScroll}
      scrollEventThrottle={64}
      contentOffset={{ x: 0, y: initialY }}
      contentContainerStyle={{ gap: GUTTER, paddingBottom: 120 }}
      onTouchStart={() => {
        dragged.current = false;
      }}
      onScrollBeginDrag={() => {
        dragged.current = true;
      }}
      onTouchEnd={() => {
        // A tap (not a drag) on the art toggles the chrome.
        if (!dragged.current) onTap();
      }}
      accessibilityLabel={`Chapter ${chapter.number}, scroll mode`}
    >
      {viewport.width > 0 &&
        chapter.pages.map((p, i) => (
          <PageArt
            key={p.id}
            page={p}
            pageIndex={i}
            chapterNumber={chapter.number}
            width={layout[i].width}
            height={layout[i].height}
            furthest={furthest}
            echoEnabled={echoEnabled}
            onGlyph={onGlyph}
          />
        ))}
    </ScrollView>
  );
}
