import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fragments, getChapter, getSeries } from '@/content/catalog';
import { accessFor, canRead } from '@/domain/access';
import { newlyFound } from '@/domain/fragments';
import { resolveMode } from '@/domain/reading-mode';
import { chapterProgress, type Step } from '@/domain/sigil';
import type { GlyphHotspot, ReadingMode } from '@/domain/types';
import { PagesReader } from '@/reader/pages-reader';
import { EchoCard, PowSheet, SettingsSheet } from '@/reader/sheets';
import { ScrollReader } from '@/reader/scroll-reader';
import { SigilReader } from '@/reader/sigil-reader';
import { furthestOf, useNow } from '@/state/derived';
import { useDispatch, useReader } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Back, Settings } from '@/ui/icons';
import { IconButton, ProgressBar, T } from '@/ui/kit';
import { PowSeal, useVerification } from '@/ui/pow-seal';

export default function Reader() {
  const { chapterId = '' } = useLocalSearchParams<{ chapterId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const state = useReader((s) => s);

  const chapter = getChapter(chapterId);
  const series = chapter ? getSeries(chapter.seriesId) : undefined;
  const verify = useVerification(chapter?.id);
  const now = useNow(30_000);

  const saved = chapter && state.current[chapter.seriesId];
  const [step, setStep] = useState<Step>(
    saved && saved.chapter === chapter?.number ? { page: saved.page, panel: saved.panel } : { page: 0, panel: 0 },
  );
  const [chrome, setChrome] = useState(true);
  const [settings, setSettings] = useState(false);
  const [echo, setEcho] = useState<GlyphHotspot | null>(null);
  const [powOpen, setPowOpen] = useState(false);
  const [fullPage, setFullPage] = useState(false);
  const powShown = useRef(false);

  useEffect(() => {
    if (verify?.status === 'mismatch' && !powShown.current) {
      powShown.current = true;
      setPowOpen(true);
    }
  }, [verify]);

  if (!chapter || !series) return <Redirect href="/" />;
  const access = accessFor(chapter, now, new Set(state.unlockedChapterIds), state.embers);
  if (!canRead(access)) return <Redirect href={`/unlock/${chapter.id}`} />;
  if (chapter.pages.length === 0) return <Redirect href={`/series/${series.id}`} />;

  const mode = resolveMode(series, state.seriesModes, state.globalMode);
  const remember = series.id in state.seriesModes;
  const furthest = furthestOf(state, series.id);
  const page = chapter.pages[step.page];
  const progress = chapterProgress(chapter.pages, step);

  const report = (s: Step) => {
    setStep(s);
    const before = furthestOf(state, series.id);
    const position = { chapter: chapter.number, page: s.page, panel: s.panel };
    dispatch({ type: 'advance', seriesId: series.id, position });

    const lastPage = chapter.pages.length - 1;
    if (s.page === lastPage && s.panel >= chapter.pages[lastPage].panels.length - 1) {
      dispatch({ type: 'finishChapter', chapterId: chapter.id, now: Date.now() });
    }

    const found = newlyFound(fragments.filter((f) => f.seriesId === series.id), before, position).filter(
      (f) => !state.celebratedFragmentIds.includes(f.id),
    );
    if (found[0]) {
      dispatch({ type: 'celebrate', fragmentId: found[0].id });
      router.push(`/fragment/${found[0].id}`);
    }
  };

  const setMode = (m: ReadingMode) => dispatch({ type: 'setMode', seriesId: series.id, mode: m, remember });
  const onGlyph = (g: GlyphHotspot) => setEcho(g);

  return (
    <View style={{ flex: 1, backgroundColor: color.black }}>
      {mode === 'sigil' && (
        <SigilReader
          chapter={chapter}
          step={step}
          direction={series.direction}
          transition={state.transition}
          furthest={furthest}
          echoEnabled={state.echoEnabled}
          fullPage={fullPage}
          onStep={report}
          onGlyph={onGlyph}
          onMenu={() => setChrome((c) => !c)}
          onEnd={() => router.back()}
        />
      )}
      {mode === 'scroll' && (
        <ScrollReader
          chapter={chapter}
          initial={step}
          furthest={furthest}
          echoEnabled={state.echoEnabled}
          onStep={report}
          onGlyph={onGlyph}
          onTap={() => setChrome((c) => !c)}
        />
      )}
      {mode === 'pages' && (
        <PagesReader
          chapter={chapter}
          initialPage={step.page}
          direction={series.direction}
          furthest={furthest}
          echoEnabled={state.echoEnabled}
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
                {chapter.number} · {chapter.title}
              </T>
              <T v="mono" style={{ fontSize: 11 }}>
                {series.title.toUpperCase()} · PAGE {page?.label} · PANEL {step.panel + 1}/{page?.panels.length}
              </T>
            </View>
            <PowSeal result={verify} onPress={verify?.status === 'mismatch' ? () => setPowOpen(true) : undefined} />
            <IconButton label="Reading settings" onPress={() => setSettings(true)}>
              <Settings />
            </IconButton>
          </LinearGradient>

          <LinearGradient colors={['rgba(11,10,9,0)', 'rgba(11,10,9,0.96)']} style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
            <T v="mono">P. {page?.label}</T>
            <ProgressBar value={progress} track={color.ash} height={4} style={{ flex: 1 }} />
            <T v="mono">{chapter.pages.length} PP</T>
            {mode === 'sigil' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={fullPage ? 'Back to panel view' : 'Show full page'}
                onPress={() => setFullPage((f) => !f)}
                style={styles.pill}
              >
                <T v="mono" style={{ color: color.bone }}>
                  {fullPage ? 'PANEL' : 'PAGE'}
                </T>
              </Pressable>
            )}
          </LinearGradient>
        </>
      )}

      {echo && <EchoCard entryId={echo.codexEntryId} furthest={furthest} onClose={() => setEcho(null)} />}
      {settings && (
        <SettingsSheet
          mode={mode}
          onMode={setMode}
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
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingBottom: 18 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 24 },
  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: 1, borderColor: color.ash, minHeight: 32, justifyContent: 'center' },
});
