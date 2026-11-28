import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ReadingMode } from '@/domain/types';
import { useDispatch } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Check, FlameMark, ModeIcon } from '@/ui/icons';
import { Button, T, tap } from '@/ui/kit';

const STEPS = 3;

const MODES: { key: ReadingMode; title: string; sub: string }[] = [
  { key: 'sigil', title: 'Sigil View', sub: 'One panel at a time, the way the artist framed it' },
  { key: 'scroll', title: 'Scroll', sub: 'One long strip, built for one thumb' },
  { key: 'pages', title: 'Pages', sub: 'Turn full pages. Manga reads right to left on its own' },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<ReadingMode>('sigil');

  const finish = () => {
    dispatch({ type: 'onboard', mode });
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.soot, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }}>
      <LinearGradient colors={['rgba(255,91,31,0.3)', 'rgba(255,91,31,0)']} style={styles.wash} />
      <View style={styles.top}>
        <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.dash, { backgroundColor: i < step ? color.bone : i === step ? color.ember : color.ash }]} />
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={finish} hitSlop={12}>
          <T v="bodyStrong" style={{ color: color.smoke }}>
            Skip
          </T>
        </Pressable>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 44, gap: 12 }}>
        {step === 0 && (
          <>
            <FlameMark size={44} />
            <T v="kicker" style={{ paddingTop: 12 }}>
              1 of 3 · Welcome
            </T>
            <T v="display" style={{ fontSize: 40, lineHeight: 42 }}>
              Read the world behind the page.
            </T>
            <T v="body">
              EchoReader is home to Flame Sigil and the Echoverse. Glyphs in the art open the lore, fragments track the prophecy,
              and every edition is verified.
            </T>
          </>
        )}

        {step === 1 && (
          <>
            <T v="kicker">2 of 3 · Your reading style</T>
            <T v="display" style={{ fontSize: 36, lineHeight: 38 }}>
              How should pages move?
            </T>
            <T v="caption" style={{ fontSize: 15 }}>
              You can change this for any series later.
            </T>
            <View style={{ gap: 12, paddingTop: 16 }} accessibilityRole="radiogroup">
              {MODES.map((m) => {
                const on = m.key === mode;
                return (
                  <Pressable
                    key={m.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${m.title}. ${m.sub}`}
                    onPress={() => {
                      tap();
                      setMode(m.key);
                    }}
                    style={[styles.option, on && styles.optionOn]}
                  >
                    <ModeIcon mode={m.key} size={34} color={on ? color.ember : color.smoke} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <T v="bodyStrong" style={{ fontSize: 16 }}>
                        {m.title}
                      </T>
                      <T v="caption">{m.sub}</T>
                    </View>
                    <View style={[styles.radio, on && { backgroundColor: color.ember, borderColor: color.ember }]}>{on && <Check size={12} color={color.soot} />}</View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <T v="kicker">3 of 3 · Beyond the page</T>
            <T v="display" style={{ fontSize: 36, lineHeight: 38 }}>
              Your reader. Free.
            </T>
            <T v="body">
              Import your own comics (PDF, CBZ or images) and read them free, offline, with no account. The Flame Sigil Prologue and Chapter One
              are free; later chapters offer a preview and editions you can buy.
            </T>
            <T v="body">Earn Embers as you read and discover. They’re rewards, not money.</T>
            <T v="body">Nothing in the Codex or the Cypher will spoil past the panel you’ve reached.</T>
          </>
        )}
      </View>

      <View style={{ paddingHorizontal: 24 }}>
        <Button kind="bone" label={step < STEPS - 1 ? 'Continue' : 'Start reading'} onPress={() => (step < STEPS - 1 ? setStep(step + 1) : finish())} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wash: { position: 'absolute', left: 0, right: 0, top: 0, height: 340 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  dash: { width: 22, height: 4, borderRadius: radius.full },
  option: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: color.ash },
  optionOn: { borderWidth: 1.5, borderColor: color.ember, backgroundColor: 'rgba(255,91,31,0.08)' },
  radio: { width: 22, height: 22, borderRadius: radius.full, borderWidth: 1.5, borderColor: color.ash, alignItems: 'center', justifyContent: 'center' },
});
