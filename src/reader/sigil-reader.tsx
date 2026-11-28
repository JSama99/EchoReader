import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { activeGlyphs } from '@/domain/spoilers';
import {
  cameraForRect,
  FULL_PAGE,
  hitRect,
  nextStep,
  originCompensation,
  prevStep,
  screenToPage,
  tapZoneAction,
  type Step,
} from '@/domain/sigil';
import type { Chapter, GlyphHotspot, Position, ReadingDirection } from '@/domain/types';
import { color } from '@/theme/tokens';

import { PageArt } from './page-art';

/**
 * Sigil View: an authored camera moves panel to panel. Tap the advancing edge
 * to go forward, the other edge to go back, the center for the menu. Taps on
 * an Echo glyph are resolved by inverting the camera, so glyphs never fight
 * the tap zones.
 */
export function SigilReader({
  chapter,
  pageCount,
  reduceMotion,
  step,
  direction,
  transition,
  furthest,
  echoEnabled,
  fullPage,
  onStep,
  onGlyph,
  onMenu,
  onEnd,
}: {
  chapter: Chapter;
  /** Readable pages (fewer than chapter.pages for previews). */
  pageCount: number;
  /** Cut between panels and skip camera animation. */
  reduceMotion: boolean;
  step: Step;
  direction: ReadingDirection;
  transition: 'glide' | 'cut';
  furthest: Position;
  echoEnabled: boolean;
  fullPage: boolean;
  onStep: (s: Step) => void;
  onGlyph: (g: GlyphHotspot) => void;
  onMenu: () => void;
  onEnd: () => void;
}) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const pages = useMemo(() => chapter.pages.slice(0, pageCount), [chapter.pages, pageCount]);
  const page = pages[step.page];

  // Draw the page at a base size that fits the viewport; the camera zooms from there.
  const pageSize = useMemo(() => {
    if (!page || viewport.width === 0) return { width: 0, height: 0 };
    const s = Math.min(viewport.width / page.width, viewport.height / page.height);
    return { width: page.width * s, height: page.height * s };
  }, [page, viewport]);

  const rect = fullPage ? FULL_PAGE : (page?.panels[step.panel]?.rect ?? FULL_PAGE);
  const camera = useMemo(() => cameraForRect(rect, pageSize, viewport, 12), [rect, pageSize, viewport]);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);
  // Spotlight: the active panel's rectangle in viewport coordinates.
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const sw = useSharedValue(0);
  const sh = useSharedValue(0);

  useEffect(() => {
    if (pageSize.width === 0) return;
    const cfg = { duration: transition === 'glide' && !reduceMotion ? 420 : 0, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
    // Transforms scale around the view's center on every platform; convert the
    // camera's top-left-origin translation so we never depend on transformOrigin.
    const o = originCompensation(camera, pageSize);
    tx.value = withTiming(o.x, cfg);
    ty.value = withTiming(o.y, cfg);
    sc.value = withTiming(camera.scale, cfg);
    sx.value = withTiming(camera.translateX + rect.x * pageSize.width * camera.scale, cfg);
    sy.value = withTiming(camera.translateY + rect.y * pageSize.height * camera.scale, cfg);
    sw.value = withTiming(rect.w * pageSize.width * camera.scale, cfg);
    sh.value = withTiming(rect.h * pageSize.height * camera.scale, cfg);
  }, [camera, pageSize, rect, transition, reduceMotion, tx, ty, sc, sx, sy, sw, sh]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: sc.value }],
  }));
  const maskTop = useAnimatedStyle(() => ({ height: Math.max(0, sy.value) }));
  const maskBottom = useAnimatedStyle(() => ({ top: sy.value + sh.value }));
  const maskLeft = useAnimatedStyle(() => ({ top: sy.value, height: sh.value, width: Math.max(0, sx.value) }));
  const maskRight = useAnimatedStyle(() => ({ top: sy.value, height: sh.value, left: sx.value + sw.value }));

  const onPress = (e: GestureResponderEvent) => {
    // locationX is undefined on web; the reader fills the screen, so page coords work.
    const ne = e.nativeEvent;
    const x = Number.isFinite(ne.locationX) ? ne.locationX : ne.pageX;
    const y = Number.isFinite(ne.locationY) ? ne.locationY : ne.pageY;

    if (echoEnabled && page) {
      const p = screenToPage({ x, y }, camera, pageSize);
      const glyph = hitRect(activeGlyphs(page.glyphs, chapter.number, step.page, furthest), p);
      if (glyph) return onGlyph(glyph);
    }

    const action = tapZoneAction(x, viewport.width, direction);
    if (action === 'menu') return onMenu();
    const target = action === 'next' ? nextStep(pages, step) : prevStep(pages, step);
    if (target) onStep(target);
    else if (action === 'next') onEnd();
  };

  return (
    <View style={styles.root} onLayout={(e) => setViewport(e.nativeEvent.layout)}>
      {page && pageSize.width > 0 && (
        <Animated.View style={[styles.stage, { width: pageSize.width, height: pageSize.height }, animated]}>
          <PageArt
            page={page}
            pageIndex={step.page}
            chapterNumber={chapter.number}
            width={pageSize.width}
            height={pageSize.height}
            furthest={furthest}
            echoEnabled={echoEnabled}
            showPins={false}
            interactiveGlyphs={false}
            onGlyph={onGlyph}
          />
        </Animated.View>
      )}
      {!fullPage && pageSize.width > 0 && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={[styles.mask, { left: 0, right: 0, top: 0 }, maskTop]} />
          <Animated.View style={[styles.mask, { left: 0, right: 0, bottom: 0 }, maskBottom]} />
          <Animated.View style={[styles.mask, { left: 0 }, maskLeft]} />
          <Animated.View style={[styles.mask, { right: 0 }, maskRight]} />
        </View>
      )}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Reader. Tap the right edge for the next panel, left edge for the previous panel, center for the menu."
        accessibilityActions={[
          { name: 'increment', label: 'Next panel' },
          { name: 'decrement', label: 'Previous panel' },
        ]}
        onAccessibilityAction={(ev) => {
          const t = ev.nativeEvent.actionName === 'increment' ? nextStep(pages, step) : prevStep(pages, step);
          if (t) onStep(t);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.black, overflow: 'hidden' },
  stage: { position: 'absolute', left: 0, top: 0 },
  mask: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.88)' },
});
