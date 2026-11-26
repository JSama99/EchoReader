import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { getChapter, getSeries } from '@/content/catalog';
import { accessFor, formatCountdown, MAX_EARLY_WINDOW_MS } from '@/domain/access';
import { useNow } from '@/state/derived';
import { useDispatch, useReader } from '@/state/store';
import { color } from '@/theme/tokens';
import { Ember } from '@/ui/icons';
import { Button, T } from '@/ui/kit';

const R = 18;
const C = 2 * Math.PI * R;

export default function Unlock() {
  const { chapterId = '' } = useLocalSearchParams<{ chapterId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const now = useNow();
  const embers = useReader((s) => s.embers);
  const unlocked = useReader((s) => s.unlockedChapterIds);
  const notify = useReader((s) => s.notifySeries);

  const chapter = getChapter(chapterId);
  if (!chapter) return null;
  const series = getSeries(chapter.seriesId)!;
  const access = accessFor(chapter, now, new Set(unlocked), embers);
  const freeAt = new Date(chapter.freeAt);
  const freeLabel = freeAt.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

  const remaining = access.kind === 'early' ? access.msUntilFree : access.kind === 'unreleased' ? access.msUntilPublish : 0;
  const elapsed = access.kind === 'early' ? 1 - remaining / MAX_EARLY_WINDOW_MS : 0;
  const noPages = chapter.pages.length === 0;
  const reminded = notify.includes(series.id);

  const spend = () => {
    dispatch({ type: 'spendEmber', chapter, now });
    router.back();
    if (!noPages) router.push(`/read/${chapter.id}`);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim }]} onPress={() => router.back()} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal>
        <View style={styles.grabber} />
        <View style={{ gap: 8 }}>
          <T v="kicker">
            {access.kind === 'unreleased' ? 'Coming Friday' : 'Early access'} · Ch. {chapter.number}
          </T>
          <T v="headline">{chapter.title}</T>
          <T v="body">
            {access.kind === 'unreleased'
              ? `Arrives ${new Date(chapter.publishedAt).toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })}. Early access opens then; it’s free for everyone 24 hours later.`
              : access.kind === 'early'
                ? 'Read it now with an Ember, or wait. It’s free for everyone within 24 hours.'
                : 'This chapter is free to read.'}
          </T>
        </View>

        <View style={styles.timer} accessibilityLabel={`${formatCountdown(remaining)} remaining`}>
          <Svg width={44} height={44} viewBox="0 0 44 44">
            <Circle cx={22} cy={22} r={R} stroke={color.ash} strokeWidth={4} fill="none" />
            <Circle
              cx={22}
              cy={22}
              r={R}
              stroke={color.bone}
              strokeWidth={4}
              fill="none"
              strokeDasharray={`${C}`}
              strokeDashoffset={C * (1 - Math.max(0.02, elapsed))}
              strokeLinecap="round"
              transform="rotate(-90 22 22)"
            />
          </Svg>
          <View style={{ gap: 2 }}>
            <T v="mono" style={{ fontSize: 20, color: color.bone }}>
              {formatCountdown(remaining)}
            </T>
            <T v="caption" style={{ fontSize: 12 }}>
              {access.kind === 'unreleased' ? 'until early access' : `until free for all · ${freeLabel}`}
            </T>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          {access.kind === 'early' && (
            <Button
              label={embers > 0 ? `Use 1 Ember · ${embers} left` : 'No Embers left'}
              icon={<Ember color={color.soot} />}
              disabled={embers === 0}
              onPress={spend}
              accessibilityHint="Unlocks this chapter early. Embers never expire."
            />
          )}
          <Button
            kind="ghost"
            label={reminded ? 'We’ll remind you' : 'Remind me when it’s free'}
            onPress={() => {
              if (!reminded) dispatch({ type: 'toggleNotify', seriesId: series.id });
              router.back();
            }}
          />
        </View>
        <T v="caption" style={{ textAlign: 'center', fontSize: 12 }}>
          No ads, no paid waits. Embers are earned by reading and never expire.
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 18, paddingTop: 10, paddingHorizontal: 24, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: color.char, borderTopWidth: 1, borderColor: color.ash, maxWidth: 640, alignSelf: 'center', width: '100%' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, backgroundColor: color.ash },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: color.soot, borderWidth: 1, borderColor: color.ash },
});
