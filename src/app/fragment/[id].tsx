import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { allChapters, fragments } from '@/content/catalog';
import { toRoman } from '@/domain/fragments';
import { useFragments } from '@/state/derived';
import { color, font } from '@/theme/tokens';
import { Close } from '@/ui/icons';
import { Button, Diamonds, IconButton, T } from '@/ui/kit';

export default function FragmentEarned() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fragment = fragments.find((f) => f.id === id);
  const progress = useFragments(fragment?.seriesId ?? 'flame-sigil');

  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withDelay(120, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [rise]);
  const glyphStyle = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: (1 - rise.value) * 24 }, { scale: 0.9 + rise.value * 0.1 }] }));

  if (!fragment) return null;
  const chapter = allChapters().find((c) => c.number === fragment.foundAt.chapter && c.seriesId === fragment.seriesId);
  const page = chapter?.pages[fragment.foundAt.page];
  const remaining = progress.total - progress.count;

  return (
    <View style={{ flex: 1, backgroundColor: color.soot, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }}>
      <LinearGradient colors={['rgba(233,180,76,0.32)', 'rgba(233,180,76,0.05)', 'rgba(233,180,76,0)']} style={StyleSheet.absoluteFill} />
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 8 }}>
        <IconButton label="Close" onPress={() => router.back()}>
          <Close />
        </IconButton>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: 32 }}>
        <Animated.View style={glyphStyle} accessible accessibilityLabel={`Fragment ${toRoman(fragment.ordinal)}`}>
          <Svg width={150} height={190} viewBox="0 0 150 190">
            <Path d="M75 6 140 70 112 180H38L10 70Z" fill="#1A140A" stroke={color.glyph} strokeWidth={2} />
            <Path d="M75 6 75 180M10 70h130M38 180 75 70l37 110" stroke={color.glyph} strokeOpacity={0.45} strokeWidth={1.2} fill="none" />
            <SvgText x={75} y={134} textAnchor="middle" fontFamily={font.display} fontSize={34} fill="#F7E2B0">
              {toRoman(fragment.ordinal)}
            </SvgText>
          </Svg>
        </Animated.View>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <T v="kicker" style={{ color: color.glyph }}>
            Fragment {toRoman(fragment.ordinal)} of IX · Found
          </T>
          <T v="headline" style={{ textAlign: 'center', fontSize: 30, lineHeight: 32 }}>
            {fragment.title}
          </T>
          <T v="body" style={{ textAlign: 'center' }}>
            Found in Ch. {fragment.foundAt.chapter}, page {page?.label ?? fragment.foundAt.page + 1}. Akasha has added it to your Codex.
            {remaining > 0 ? ` ${remaining} more, and the Origin prequel opens.` : ' The Origin prequel is open.'}
          </T>
        </View>
        <Diamonds count={progress.count} glowIndex={fragment.ordinal - 1} size={13} />
      </View>

      <View style={{ paddingHorizontal: 24, gap: 10 }}>
        <Button kind="glyph" label="Open the Codex" onPress={() => {
          router.back();
          router.push('/codex');
        }} />
        <Button kind="ghost" label="Keep reading" onPress={() => router.back()} />
      </View>
    </View>
  );
}
