import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fragments } from '@/content/catalog';
import { earnedAchievements } from '@/domain/achievements';
import { fragmentProgress } from '@/domain/fragments';
import { readingStreak } from '@/domain/rewards';
import { furthestOf, useNow } from '@/state/derived';
import { useDispatch, useReader } from '@/state/store';
import { color, font } from '@/theme/tokens';
import { TabDiscover, TabHome, TabLibrary, TabProfile, TabVault } from '@/ui/icons';
import { tap } from '@/ui/kit';

const TABS = [
  { name: 'index', label: 'Home', Icon: TabHome },
  { name: 'discover', label: 'Discover', Icon: TabDiscover },
  { name: 'library', label: 'Library', Icon: TabLibrary },
  { name: 'vault', label: 'Vault', Icon: TabVault },
  { name: 'profile', label: 'Profile', Icon: TabProfile },
] as const;

/** Unlock achievements the reader has earned (each awards Embers once). */
function useAchievementSync() {
  const dispatch = useDispatch();
  const state = useReader((s) => s);
  const now = useNow(60_000);
  const earned = earnedAchievements({
    finishedOriginals: state.finishedChapterIds.filter((id) => !id.startsWith('local:')).length,
    discoveredGlyphs: state.discoveredGlyphIds.length,
    imported: state.library.length,
    streak: readingStreak(state.readingDays, now),
    fragments: fragmentProgress(fragments, furthestOf(state, 'flame-sigil')).count,
    collections: state.collections.length,
    bookmarks: state.bookmarks.length,
  });
  const missing = earned.filter((id) => !state.achievements.some((a) => a.id === id)).join(',');
  useEffect(() => {
    if (!missing) return;
    for (const id of missing.split(',')) dispatch({ type: 'unlockAchievement', id, now: Date.now() });
  }, [missing, dispatch]);
}

export default function TabsLayout() {
  const onboarded = useReader((s) => s.onboarded);
  useAchievementSync();
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.soot } }}
      tabBar={(props) => <KilnTabBar {...props} />}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

function KilnTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.index === i;
        const tint = focused ? color.ember : color.smoke;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) {
                tap();
                navigateToTab(route.key);
              }
            }}
            style={styles.item}
          >
            <tab.Icon color={tint} />
            <Text style={[styles.label, { color: tint, fontFamily: focused ? font.uiSemibold : font.uiMedium }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, paddingHorizontal: 12, backgroundColor: color.soot, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.ash },
  item: { alignItems: 'center', gap: 5, minWidth: 56, minHeight: 44, flex: 1 },
  label: { fontSize: 11 },
});
