import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { chaptersOf, fragments, getSeries } from '@/content/catalog';
import { accessFor, formatCountdown } from '@/domain/access';
import { toRoman } from '@/domain/fragments';
import { isReached } from '@/domain/position';
import { resolveMode } from '@/domain/reading-mode';
import { chapterProgress } from '@/domain/sigil';
import type { ReadingMode } from '@/domain/types';
import { furthestOf, useNow } from '@/state/derived';
import { useDispatch, useReader } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Back, Check, Ember, Lock } from '@/ui/icons';
import { Button, Chip, IconButton, ProgressBar, Row, Segmented, T } from '@/ui/kit';

export default function SeriesScreen() {
  const { id = 'flame-sigil' } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const state = useReader((s) => s);
  const now = useNow();
  const series = getSeries(id);
  if (!series) return null;

  const list = chaptersOf(series.id);
  const furthest = furthestOf(state, series.id);
  const current = state.current[series.id];
  const mode = resolveMode(series, state.seriesModes, state.globalMode);
  const following = state.following.includes(series.id);

  return (
    <View style={{ flex: 1, backgroundColor: color.soot }}>
      <LinearGradient colors={['rgba(255,91,31,0.30)', 'rgba(255,91,31,0.05)', 'rgba(255,91,31,0)']} style={styles.wash} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 32 }}>
        <View style={styles.nav}>
          <IconButton label="Back" onPress={() => router.back()}>
            <Back />
          </IconButton>
          <Chip label={following ? 'Following' : 'Follow'} active={!following} onPress={() => dispatch({ type: 'toggleFollow', seriesId: series.id })} />
        </View>

        <View style={{ paddingHorizontal: 24, gap: 12, paddingTop: 8 }}>
          <T v="kicker">An Echoverse original</T>
          <T v="display">{series.title.toUpperCase().replace(' ', '\n')}</T>
          <T v="body">{series.tagline}</T>
          <T v="mono">
            {list.length} CH / NEW FRIDAYS / TALONSIGHT
          </T>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 10 }}>
          <T v="label">Read this series in</T>
          <Segmented<ReadingMode>
            value={mode}
            onChange={(m) => dispatch({ type: 'setMode', seriesId: series.id, mode: m, remember: true })}
            options={[
              { key: 'sigil', label: 'Sigil View' },
              { key: 'scroll', label: 'Scroll' },
              { key: 'pages', label: 'Pages' },
            ]}
          />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 28 }}>
          <View style={styles.arcHead}>
            <T v="title" style={{ fontSize: 16 }}>
              Book One
            </T>
            <T v="mono">CH 1–{list.length}</T>
          </View>

          {list.map((ch) => {
            const access = accessFor(ch, now, new Set(state.unlockedChapterIds), state.embers);
            const finished = state.finishedChapterIds.includes(ch.id);
            const isCurrent = current?.chapter === ch.number && !finished;
            const fragmentHere = fragments.find((f) => f.foundAt.chapter === ch.number);
            const fragFound = fragmentHere && isReached(fragmentHere.foundAt, furthest);
            const progress =
              isCurrent && current ? chapterProgress(ch.pages, { page: current.page, panel: current.panel }) : 0;
            const empty = ch.pages.length === 0;

            const open = () => {
              if (access.kind === 'early' || access.kind === 'unreleased') router.push(`/unlock/${ch.id}`);
              else if (!empty) router.push(`/read/${ch.id}`);
            };

            let sub = `${ch.pages.length} pages`;
            let subColor: string = color.smoke;
            if (finished) sub = 'Read';
            if (access.kind === 'early') {
              sub = `Early access · free for all in ${formatCountdown(access.msUntilFree).slice(0, 5).replace(':', 'h ')}m`;
            } else if (access.kind === 'unreleased') {
              sub = `Arrives Friday · free 24h later`;
              subColor = color.storm;
            } else if (fragmentHere && !fragFound) {
              sub = `Fragment ${toRoman(fragmentHere.ordinal)} inside`;
              subColor = color.glyph;
            } else if (empty) {
              sub = 'Pages arrive Friday';
            }

            return (
              <Row
                key={ch.id}
                onPress={open}
                accessibilityRole="button"
                accessibilityLabel={`Chapter ${ch.number}, ${ch.title}. ${sub}`}
                style={[styles.chapterRow, isCurrent && { minHeight: 72 }]}
              >
                <T v="mono" style={{ width: 28, fontSize: 14, color: isCurrent ? color.ember : finished ? color.smoke : color.bone }}>
                  {ch.number}
                </T>
                <View style={{ flex: 1, gap: isCurrent ? 6 : 3 }}>
                  <T v="bodyStrong" style={{ color: finished ? color.smoke : color.bone, fontFamily: isCurrent ? undefined : 'InterTight_500Medium' }}>
                    {ch.title}
                  </T>
                  {isCurrent ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ProgressBar value={progress} track={color.ash} style={{ width: 88 }} />
                      <T v="caption" style={{ fontSize: 12 }}>
                        p. {ch.pages[current!.page]?.label} of {ch.pages.length}
                      </T>
                    </View>
                  ) : (
                    <T v="caption" style={{ fontSize: 12, color: subColor }}>
                      {sub}
                    </T>
                  )}
                </View>
                <View style={{ width: 92, alignItems: 'flex-end' }}>
                  {isCurrent ? (
                    <Button label="Resume" height={32} style={{ paddingHorizontal: 14 }} onPress={open} />
                  ) : access.kind === 'early' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ember />
                      <T v="mono" style={{ color: color.bone, fontSize: 13 }}>
                        1
                      </T>
                    </View>
                  ) : access.kind === 'unreleased' ? (
                    <Lock />
                  ) : finished ? (
                    <Check color={color.smoke} />
                  ) : fragmentHere && !fragFound ? (
                    <View style={styles.diamond} />
                  ) : null}
                </View>
              </Row>
            );
          })}
        </View>

        {!current && list[0] && list[0].pages.length > 0 && (
          <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
            <Button label="Start Chapter 1" onPress={() => router.push(`/read/${list[0].id}`)} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { position: 'absolute', left: 0, right: 0, top: 0, height: 380 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingRight: 24 },
  arcHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
  chapterRow: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
  diamond: { width: 10, height: 10, transform: [{ rotate: '45deg' }], borderWidth: 1.5, borderColor: color.glyph, borderRadius: radius.sm / 6 },
});
