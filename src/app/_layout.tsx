import { InterTight_400Regular } from '@expo-google-fonts/inter-tight/400Regular';
import { InterTight_500Medium } from '@expo-google-fonts/inter-tight/500Medium';
import { InterTight_600SemiBold } from '@expo-google-fonts/inter-tight/600SemiBold';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded/800ExtraBold';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { StoreProvider, useHydrated } from '@/state/store';
import { color } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.soot, card: color.soot, text: color.bone, border: color.ash, primary: color.ember },
};

function Navigator() {
  const hydrated = useHydrated();
  const [fontsLoaded] = useFonts({
    Unbounded_800ExtraBold,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  const ready = hydrated && fontsLoaded;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.soot }, animation: 'fade_from_bottom' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="series/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="read/[chapterId]" options={{ animation: 'fade', gestureEnabled: true }} />
      <Stack.Screen name="codex/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="thread/[key]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="downloads" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="unlock/[chapterId]" options={{ presentation: 'transparentModal', animation: 'fade' }} />
      <Stack.Screen name="fragment/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.soot }}>
      <ThemeProvider value={theme}>
        <StoreProvider>
          <StatusBar style="light" />
          <Navigator />
        </StoreProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
