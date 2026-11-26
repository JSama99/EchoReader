import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fragments, getChapter, getSeries } from '@/content/catalog';
import { has, IMPORTED_CAPABILITIES, modesFor, supportedMode } from '@/domain/capabilities';
import { canOpen, canReadFully, readablePageCount } from '@/domain/commerce/access';
import { newlyFound } from '@/domain/fragments';
import { chapterFromLocal, isLocalKey, localIdOf } from '@/domain/library';
import { resolveMode } from '@/domain/reading-mode';
import { chapterProgress, nextStep, prevStep, type Step } from '@/domain/sigil';
import type { Capability, Chapter, GlyphHotspot, ReadingDirection, ReadingMode, Series } from '@/domain/types';
import { EchoCard, PowSheet, SettingsSheet } from '@/reader/sheets';
import { PagesReader } from '@/reader/pages-reader';
import { ScrollReader } from '@/reader/scroll-reader';
import { SigilReader } from '@/reader/sigil-reader';
import { track } from '@/services/analytics';
import { releasePages, resolvePages } from '@/services/page-store';
import { furthestOf, useAccess, useCatalogVersion, useNow } from '@/state/derived';
import { useDispatch, useReader } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Back, Bookmark, Settings } from '@/ui/icons';
import { Button, IconButton, ProgressBar, T } from '@/ui/kit';
import { PowSeal, useVerification } from '@/ui/pow-seal';

const PAPER = '#F4F1EA';

export default function Reader() {
  const { chapterId = '' } = useLocalSearchParams<{ chapterId?: string }>();
  const id = decodeURIComponent(chapterId);
  const local = isLocalKey(id);
  useCatalogVersion();
  const state = useReader((s) => s);
  const pub = local ? state.library.find((p) => p.id === localIdOf(id)) : undefined;
  const [uris, setUris] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!pub) return;
    let alive = true;
    resolvePages(pub).then((u) => alive && setUris(u));
    return () => {
      alive = false;
      releasePages(pub);
    };
    // Re-resolve only when the comic itself changes, not on metadata edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pub?.id]);

  if (local) {
    if (!pub) return <Redirect href="/library" />;
    if (!uris) return <View style={{ flex: 1, backgroundColor: color.black }} />;
    const chapter = chapterFromLocal(pub, (f) => uris[f]);
    const series: Series = {
      id: chapter.seriesId,
      publisherId: 'local',
      title: pub.title,
      tagline: '',
      direction: pub.direction,
      defaultMode: 'pages',
      capabilities: [...IMPORTED_CAPABILITIES],
      chapterIds: [chapter.id],
      status: 'live',
    };
    return <ReaderView chapter={chapter} series={series} direction={pub.direction} caps={series.capabilities} readable={chapter.pages.length} full format={pub.format} />;
  }

  return <CatalogReader id={id} />;
}

function CatalogReader({ id }: { id: string }) {
  const now = useNow(30_000);
  const access = useAccess(id, now)!;
  const chapter = getChapter(id);
  const series = chapter ? getSeries(chapter.seriesId) : undefined;
  if (!chapter || !series) return <Redirect href="/" />;
  if (chapter.pages.length === 0 || !canOpen(access, chapter.pages.length)) return <Redirect href={`/editions/${chapter.id}`} />;
  return (
    <ReaderView
      chapter={chapter}
      series={series}
      direction={series.direction}
      caps={series.capabilities}
      readable={readablePageCount(access, chapter.pages.length)}
      full={canReadFully(access)}
    />
  );
}

function ReaderView({
  chapter,
  series,
  direction,
  caps,
  readable,
  full,
  format,
}: {
  chapter: Chapter;
  series: Series;
  direction: ReadingDirection;
  caps: readonly Capability[];
  readable: number;
  full: boolean;
  format?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const state = useReader((s) => s);
  const systemReduce = useReducedMotion();
  const key = chapter.seriesId;
  const verify = useVerification(has(caps, 'verification') ? chapter.id : undefined);

  const saved = state.current[key];
  const [step, setStep] = useState<Step>(() => {
    if (saved && saved.chapter === chapter.number && saved.page < readable) return { page: saved.page, panel: saved.panel };
    return { page: 0, panel: 0 };
  });
  const [chrome, setChrome] = useState(true);
  const [settings, setSettings] = useState(false);
  const [echo, setEcho] = useState<GlyphHotspot | null>(null);
  const [powOpen, setPowOpen] = useState(false);
  const [fullPage, setFullPage] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  const powShown = useRef(false);

  const modes = modesFor(caps);
  const mode = supportedMode(resolveMode(series, state.seriesModes, state.globalMode), caps);
  const remember = series.id in state.seriesModes;
  const reduceMotion = state.motion === 'reduce' || (state.motion === 'system' && systemReduce);
  const background = state.readerTheme === 'light' ? PAPER : color.black;
  const showEcho = has(caps, 'echo') && state.echoEnabled;
  const showPins = has(caps, 'cypher');

  useEffect(() => {
    if (verify?.status === 'mismatch' && !powShown.current) {
      powShown.current = true;
      setPowOpen(true);
    }
  }, [verify]);

  useEffect(() => {
    dispatch({ type: 'opened', key, chapterId: chapter.id, now: Date.now() });
    track(format ? { name: 'local_read_start', format } : { name: 'chapter_start', publicationId: chapter.id, mode });
    const t0 = Date.now();
    return () => track({ name: 'reading_session', publicationId: chapter.id, seconds: (Date.now() - t0) / 1000, mode });
    // Once per opening of this chapter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  const pages = chapter.pages.slice(0, readable);
  const furthest = furthestOf(state, key);
  const page = pages[step.page];
  const progress = chapterProgress(chapter.pages, step);
  const bookmarked = state.bookmarks.some((b) => b.chapterId === chapter.id && b.page === step.page);

  const report = (s: Step) => {
    setStep(s);
    const before = furthestOf(state, key);
    const position = { chapter: chapter.number, page: s.page, panel: s.panel };
    dispatch({ type: 'advance', seriesId: key, position, now: Date.now() });

    const last = pages.length - 1;
    const atEnd = s.page === last && s.panel >= Math.max(0, pages[last].panels.length - 1);
    if (atEnd && full && !state.finishedChapterIds.includes(chapter.id)) {
      dispatch({ type: 'finishChapter', chapterId: chapter.id, now: Date.now() });
      track({ name: 'chapter_complete', publicationId: chapter.id });
    }
    if (atEnd && !full) {
      setPreviewEnded(true);
      track({ name: 'preview_end', publicationId: chapter.id });
    }

    if (has(caps, 'fragments')) {
      const found = newlyFound(fragments.filter((f) => f.seriesId === key), before, position).filter((f) => !state.celebratedFragmentIds.includes(f.id));
      if (found[0]) {
        dispatch({ type: 'celebrate', fragmentId: found[0].id });
        router.push(`/fragment/${found[0].id}`);
      }
    }
  };

  const onGlyph = (g: GlyphHotspot) => {
    dispatch({ type: 'discoverGlyph', glyphId: g.id, now: Date.now() });
    setEcho(g);
  };
  const setMode = (m: ReadingMode) => {
    dispatch({ type: 'setMode', seriesId: series.id, mode: m, remember });
    track({ name: 'mode_change', mode: m });
  };
  const stepBy = (dir: 1 | -1) => {
    const t = dir === 1 ? nextStep(pages, step) : prevStep(pages, step);
    if (t) report(t);
    else if (dir === 1 && !full) setPreviewEnded(true);
  };
  const onEnd = () => (full ? router.back() : setPreviewEnded(true));
  const ink = state.readerTheme === 'light' ? color.soot : color.bone;

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      {mode === 'sigil' && (
        <SigilReader
          chapter={chapter}
          pageCount={readable}
          reduceMotion={reduceMotion}
          step={step}
          direction={direction}
          transition={state.transition}
          furthest={furthest}
          echoEnabled={showEcho}
          fullPage={fullPage}
          onStep={report}
          onGlyph={onGlyph}
          onMenu={() => setChrome((c) => !c)}
          onEnd={onEnd}
        />
      )}
      {mode === 'scroll' && (
        <ScrollReader
          chapter={chapter}
          pageCount={readable}
          initial={step}
          background={background}
          furthest={furthest}
          echoEnabled={showEcho}
          showPins={showPins}
          onStep={report}
          onGlyph={onGlyph}
          onTap={() => setChrome((c) => !c)}
        />
      )}
      {mode === 'pages' && (
        <PagesReader
          chapter={chapter}
          pageCount={readable}
          initialPage={step.page}
          direction={direction}
          fit={state.fit}
          background={background}
          furthest={furthest}
          echoEnabled={showEcho}
          showPins={showPins}
          reduceMotion={reduceMotion}
          onStep={report}
          onGlyph={onGlyph}
          onTap={() => setChrome((c) => !c)}
        />
      )}

      {chrome && (
        <>
          <LinearGradient colors={['rgba(11,10,9,0.97)', 'rgba(11,10,9,0.9)', 'rgba(11,10,9,0)']} locations={[0, 0.72, 1]} style={[styles.top, { paddingTop: insets.top + 4 }]}>
            <IconButton label="Close reader" onPress={() => router.back()}>
              <Back />
            </IconButton>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="bodyStrong" numberOfLines={1}>
                {chapter.label ? `${chapter.label} · ` : ''}
                {chapter.title}
              </T>
              <T v="mono" style={{ fontSize: 11 }} numberOfLines={1}>
                {format ? `${format.toUpperCase()} · ` : `${series.title.toUpperCase()} · `}PAGE {page?.label}
                {mode === 'sigil' && page && page.panels.length > 0 ? ` · PANEL ${step.panel + 1}/${page.panels.length}` : ''}
                {!full ? ' · PREVIEW' : ''}
              </T>
            </View>
            {has(caps, 'verification') && <PowSeal result={verify} onPress={verify?.status === 'mismatch' ? () => setPowOpen(true) : undefined} />}
            <IconButton
              label={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
              onPress={() => dispatch({ type: 'toggleBookmark', key, chapterId: chapter.id, page: step.page, now: Date.now() })}
            >
              <Bookmark filled={bookmarked} />
            </IconButton>
            <IconButton label="Reading settings" onPress={() => setSettings(true)}>
              <Settings />
            </IconButton>
          </LinearGradient>

          <LinearGradient colors={['rgba(11,10,9,0)', 'rgba(11,10,9,0.96)']} style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
            {mode === 'sigil' && (
              <IconButton label={direction === 'rtl' ? 'Next panel' : 'Previous panel'} onPress={() => stepBy(direction === 'rtl' ? 1 : -1)} style={styles.navBtn}>
                <T v="mono" style={{ color: color.bone, fontSize: 16 }}>
                  ‹
                </T>
              </IconButton>
            )}
            <T v="mono">P. {page?.label}</T>
            <ProgressBar value={progress} track={color.ash} height={4} style={{ flex: 1 }} />
            <T v="mono">
              {chapter.pages.length} PP
            </T>
            {mode === 'sigil' && (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel={fullPage ? 'Back to panel view' : 'Show full page'} onPress={() => setFullPage((f) => !f)} style={styles.pill}>
                  <T v="mono" style={{ color: color.bone }}>
                    {fullPage ? 'PANEL' : 'PAGE'}
                  </T>
                </Pressable>
                <IconButton label={direction === 'rtl' ? 'Previous panel' : 'Next panel'} onPress={() => stepBy(direction === 'rtl' ? -1 : 1)} style={styles.navBtn}>
                  <T v="mono" style={{ color: color.bone, fontSize: 16 }}>
                    ›
                  </T>
                </IconButton>
              </>
            )}
          </LinearGradient>
        </>
      )}

      {previewEnded && !full && (
        <View style={[styles.previewEnd, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
          <T v="kicker">End of preview</T>
          <T v="title" style={{ color: ink === color.soot ? color.bone : ink }}>
            Keep reading {chapter.label ?? chapter.title}
          </T>
          <T v="body">Choose an edition to read the complete chapter. Every edition includes the full chapter.</T>
          <Button label="See editions" onPress={() => router.replace(`/editions/${chapter.id}`)} />
          <Button kind="ghost" label="Back to preview" onPress={() => setPreviewEnded(false)} />
        </View>
      )}

      {echo && <EchoCard entryId={echo.codexEntryId} furthest={furthest} onClose={() => setEcho(null)} />}
      {settings && (
        <SettingsSheet
          modes={modes}
          mode={mode}
          onMode={setMode}
          fit={state.fit}
          onFit={(f) => dispatch({ type: 'set', patch: { fit: f } })}
          theme={state.readerTheme}
          onTheme={(t) => dispatch({ type: 'set', patch: { readerTheme: t } })}
          motion={state.motion}
          onMotion={(m) => dispatch({ type: 'set', patch: { motion: m } })}
          echoAvailable={has(caps, 'echo')}
          remember={remember}
          onRemember={(v) => dispatch({ type: 'setMode', seriesId: series.id, mode, remember: v })}
          transition={state.transition}
          onTransition={(t) => dispatch({ type: 'set', patch: { transition: t } })}
          echoEnabled={state.echoEnabled}
          onEcho={(v) => dispatch({ type: 'set', patch: { echoEnabled: v } })}
          seriesTitle={series.title}
          onClose={() => setSettings(false)}
        />
      )}
      {powOpen && verify?.status === 'mismatch' && <PowSheet result={verify} chapter={chapter} onClose={() => setPowOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingBottom: 18 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 24 },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: 1, borderColor: color.ash, minHeight: 32, justifyContent: 'center' },
  navBtn: { borderRadius: radius.full, borderWidth: 1, borderColor: color.ash },
  previewEnd: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 14, padding: 24, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: color.char, borderTopWidth: 1, borderColor: color.ash, maxWidth: 640, alignSelf: 'center', width: '100%' },
});
