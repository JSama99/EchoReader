import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { color, font, HIT, radius } from '@/theme/tokens';

// ── Type ────────────────────────────────────────────────────────────────────

type Variant = 'display' | 'headline' | 'title' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'mono' | 'kicker' | 'lettering';

const typeStyles: Record<Variant, TextStyle> = {
  display: { fontFamily: font.display, fontSize: 48, lineHeight: 48, letterSpacing: -1.8, color: color.bone },
  headline: { fontFamily: font.display, fontSize: 28, lineHeight: 30, letterSpacing: -0.9, color: color.bone },
  title: { fontFamily: font.display, fontSize: 18, lineHeight: 22, letterSpacing: -0.3, color: color.bone },
  body: { fontFamily: font.ui, fontSize: 15, lineHeight: 22, color: color.boneDim },
  bodyStrong: { fontFamily: font.uiSemibold, fontSize: 15, lineHeight: 20, color: color.bone },
  caption: { fontFamily: font.ui, fontSize: 13, lineHeight: 18, color: color.smoke },
  label: { fontFamily: font.uiSemibold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: color.smoke },
  mono: { fontFamily: font.mono, fontSize: 12, color: color.smoke },
  kicker: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: color.ember },
  lettering: { fontFamily: font.uiSemibold, fontSize: 14, textTransform: 'uppercase', color: color.soot },
};

export function T({ v = 'body', style, ...rest }: TextProps & { v?: Variant }) {
  return <Text {...rest} style={[typeStyles[v], style]} maxFontSizeMultiplier={1.6} />;
}

// ── Buttons ─────────────────────────────────────────────────────────────────

export const tap = () => {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
};

type ButtonKind = 'ember' | 'glyph' | 'storm' | 'bone' | 'ghost';

const fills: Record<ButtonKind, { bg: string; fg: string; border?: string }> = {
  ember: { bg: color.ember, fg: color.soot },
  glyph: { bg: color.glyph, fg: color.soot },
  storm: { bg: color.storm, fg: color.soot },
  bone: { bg: color.bone, fg: color.soot },
  ghost: { bg: 'transparent', fg: color.bone, border: color.ash },
};

export function Button({
  kind = 'ember',
  label,
  icon,
  onPress,
  disabled,
  style,
  height = 52,
  accessibilityHint,
}: {
  kind?: ButtonKind;
  label: string;
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  height?: number;
  accessibilityHint?: string;
}) {
  const f = fills[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          backgroundColor: f.bg,
          borderColor: f.border ?? f.bg,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.buttonLabel, { color: f.fg, fontFamily: kind === 'ghost' ? font.uiMedium : font.uiSemibold }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ onPress, label, children, style }: { onPress?: () => void; label: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

// ── Chips, toggles, segmented ───────────────────────────────────────────────

export function Chip({ label, active, tone = 'bone', onPress, style }: { label: string; active?: boolean; tone?: 'bone' | 'ember' | 'storm' | 'glyph'; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const toneColor = tone === 'bone' ? color.bone : color[tone];
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.chip,
        active ? { backgroundColor: toneColor, borderColor: toneColor } : { borderColor: tone === 'bone' ? color.ash : `${toneColor}66` },
        style,
      ]}
    >
      <Text style={{ fontFamily: active ? font.uiSemibold : font.ui, fontSize: 13, color: active ? color.soot : tone === 'bone' ? color.bone : toneColor }}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({ value, onChange, tone = 'ember', label }: { value: boolean; onChange: (v: boolean) => void; tone?: 'ember' | 'glyph' | 'storm'; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        tap();
        onChange(!value);
      }}
      style={[styles.toggle, { backgroundColor: value ? color[tone] : color.ash, alignItems: value ? 'flex-end' : 'flex-start' }]}
    >
      <View style={[styles.knob, { backgroundColor: value ? color.soot : color.smoke }]} />
    </Pressable>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.key);
            }}
            style={[styles.segment, on && { backgroundColor: color.bone }]}
          >
            <Text style={{ fontFamily: on ? font.uiSemibold : font.uiMedium, fontSize: 14, color: on ? color.soot : color.smoke }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Progress & lore ─────────────────────────────────────────────────────────

export function ProgressBar({ value, tone = color.ember, track = 'rgba(242,235,221,0.16)', height = 3, style }: { value: number; tone?: string; track?: string; height?: number; style?: StyleProp<ViewStyle> }) {
  const pct = `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` as const;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[{ height, borderRadius: radius.full, backgroundColor: track, overflow: 'hidden' }, style]}
    >
      <View style={{ width: pct, height, backgroundColor: tone, borderRadius: radius.full }} />
    </View>
  );
}

export function Diamonds({ count, total = 9, size = 12, glowIndex }: { count: number; total?: number; size?: number; glowIndex?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.55 }} accessibilityLabel={`${count} of ${total} fragments found`} accessible>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            transform: [{ rotate: '45deg' }],
            backgroundColor: i < count ? (i === glowIndex ? '#F7E2B0' : color.glyph) : 'transparent',
            borderWidth: i < count ? 0 : 1.5,
            borderColor: color.ash,
          }}
        />
      ))}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: color.ash }, style]} />;
}

/**
 * A list row. `trailing` holds a secondary control (Follow, Remove…). It is
 * rendered beside the row's pressable area, never inside it: nesting one
 * button in another is invalid HTML on web and splits taps unpredictably on
 * native.
 */
export function Row({
  children,
  style,
  trailing,
  ...rest
}: PressableProps & { children: ReactNode; style?: StyleProp<ViewStyle>; trailing?: ReactNode }) {
  if (!trailing) {
    return (
      <Pressable {...rest} style={({ pressed }) => [styles.row, { opacity: pressed && rest.onPress ? 0.7 : 1 }, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.row, style]}>
      <Pressable {...rest} style={({ pressed }) => [styles.row, { flex: 1, minHeight: 0, opacity: pressed && rest.onPress ? 0.7 : 1 }]}>
        {children}
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 22 },
  buttonLabel: { fontSize: 16 },
  iconButton: { minWidth: HIT, minHeight: HIT, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1 },
  toggle: { width: 50, height: 30, borderRadius: radius.full, padding: 3, justifyContent: 'center' },
  knob: { width: 24, height: 24, borderRadius: radius.full },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.full, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash },
  segment: { flex: 1, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56 },
});
