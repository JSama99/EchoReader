import { Redirect } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReader } from '@/state/store';
import { color, font } from '@/theme/tokens';
import { TabCodex, TabCypher, TabDiscover, TabLibrary } from '@/ui/icons';
import { tap } from '@/ui/kit';

const TABS = [
  { name: 'index', label: 'Library', Icon: TabLibrary },
  { name: 'discover', label: 'Discover', Icon: TabDiscover },
  { name: 'codex', label: 'Codex', Icon: TabCodex },
  { name: 'cypher', label: 'Cypher', Icon: TabCypher },
] as const;

export default function TabsLayout() {
  const onboarded = useReader((s) => s.onboarded);
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
  item: { alignItems: 'center', gap: 5, minWidth: 64, minHeight: 44 },
  label: { fontSize: 11 },
});
