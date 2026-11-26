import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getEntry } from '@/content/catalog';
import { shortHash, type VerifyResult } from '@/domain/pow';
import { shieldEntry } from '@/domain/spoilers';
import type { Chapter, Position, ReadingMode } from '@/domain/types';
import { color, radius } from '@/theme/tokens';
import { GlyphMark, Lock, ModeIcon, Shield } from '@/ui/icons';
import { Button, Segmented, T, Toggle } from '@/ui/kit';

export function Sheet({ children, onClose, accent }: { children: ReactNode; onClose: () => void; accent?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,4,3,0.5)' }]} onPress={onClose} accessibilityLabel="Close" />
      <View
        accessibilityViewIsModal
        style={[styles.sheet, { paddingBottom: insets.bottom + 20, borderColor: accent ?? color.ash }]}
      >
        <View style={styles.grabber} />
        {children}
      </View>
    </View>
  );
}

export function EchoCard({ entryId, furthest, onClose }: { entryId: string; furthest: Position; onClose: () => void }) {
  const router = useRouter();
  const entry = getEntry(entryId);
  if (!entry) return null;
  const s = shieldEntry(entry, furthest);
  return (
    <Sheet onClose={onClose} accent="rgba(233,180,76,0.4)">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={styles.glyphTile}>
          <GlyphMark />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <T v="kicker" style={{ color: color.glyph }}>
            Echo · Codex entry
          </T>
          <T v="title">{entry.name}</T>
        </View>
      </View>
      <T v="body">{s.visibleLines[s.visibleLines.length - 1] ?? 'Keep reading to learn more.'}</T>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          kind="glyph"
          label="Open in Codex"
          height={46}
          style={{ flex: 1 }}
          onPress={() => {
            onClose();
            router.push(`/codex/${entry.id}`);
          }}
        />
        <Button kind="ghost" label="Keep reading" height={46} onPress={onClose} />
      </View>
      {s.sealedCount > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Lock size={12} />
          <T v="caption" style={{ fontSize: 12 }}>
            {s.sealedCount} more {s.sealedCount === 1 ? 'line unlocks' : 'lines unlock'}
            {s.nextReveal ? (s.nextReveal.chapter > furthest.chapter ? ` in Ch. ${s.nextReveal.chapter}` : ' later this chapter') : ''}. Spoiler-safe.
          </T>
        </View>
      )}
    </Sheet>
  );
}

export function SettingsSheet({
  mode,
  onMode,
  remember,
  onRemember,
  transition,
  onTransition,
  echoEnabled,
  onEcho,
  seriesTitle,
  onClose,
}: {
  mode: ReadingMode;
  onMode: (m: ReadingMode) => void;
  remember: boolean;
  onRemember: (v: boolean) => void;
  transition: 'glide' | 'cut';
  onTransition: (t: 'glide' | 'cut') => void;
  echoEnabled: boolean;
  onEcho: (v: boolean) => void;
  seriesTitle: string;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <View style={styles.head}>
        <T v="headline" style={{ fontSize: 20 }}>
          Reading
        </T>
        <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
          <T v="bodyStrong" style={{ color: color.ember }}>
            Done
          </T>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['sigil', 'scroll', 'pages'] as const).map((m) => {
          const on = m === mode;
          return (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onMode(m)}
              style={[styles.tile, on && { borderColor: color.ember, backgroundColor: 'rgba(255,91,31,0.08)', borderWidth: 1.5 }]}
            >
              <ModeIcon mode={m} color={on ? color.ember : color.smoke} />
              <T v="bodyStrong" style={{ fontSize: 14, color: on ? color.bone : color.smoke }}>
                {m === 'sigil' ? 'Sigil View' : m === 'scroll' ? 'Scroll' : 'Pages'}
              </T>
            </Pressable>
          );
        })}
      </View>
      <View>
        <SettingRow label="Transition">
          <View style={{ width: 150 }}>
            <Segmented
              value={transition}
              onChange={onTransition}
              options={[
                { key: 'glide', label: 'Glide' },
                { key: 'cut', label: 'Cut' },
              ]}
            />
          </View>
        </SettingRow>
        <SettingRow label="Echo Layer glyphs" sub="Spoiler-safe to your position">
          <Toggle label="Echo Layer glyphs" value={echoEnabled} onChange={onEcho} tone="glyph" />
        </SettingRow>
        <SettingRow label={`Remember for ${seriesTitle} only`} sub="Other series keep their own settings" last>
          <Toggle label={`Remember for ${seriesTitle} only`} value={remember} onChange={onRemember} />
        </SettingRow>
      </View>
    </Sheet>
  );
}

function SettingRow({ label, sub, children, last }: { label: string; sub?: string; children: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.setRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="body" style={{ color: color.bone }}>
          {label}
        </T>
        {sub && (
          <T v="caption" style={{ fontSize: 12 }}>
            {sub}
          </T>
        )}
      </View>
      {children}
    </View>
  );
}

export function PowSheet({ result, chapter, onClose }: { result: Extract<VerifyResult, { status: 'mismatch' }>; chapter: Chapter; onClose: () => void }) {
  const pages = result.mismatchedPages.map((i) => chapter.pages[i]?.label ?? String(i + 1));
  return (
    <Sheet onClose={onClose} accent="rgba(255,91,31,0.4)">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={[styles.glyphTile, { backgroundColor: 'rgba(255,91,31,0.12)' }]}>
          <Shield ok={false} size={26} color={color.ember} />
        </View>
        <View style={{ gap: 3, flex: 1 }}>
          <T v="kicker">POW check · Ch. {chapter.number}</T>
          <T v="title">This copy didn’t verify</T>
        </View>
      </View>
      <T v="body">
        {pages.length > 0
          ? `${pages.length === 1 ? '1 page doesn’t' : `${pages.length} pages don’t`} match the official ledger record. It’s most likely an interrupted download, not tampering. You can still read it.`
          : 'The credits on this copy don’t match the ledger record. You can still read it.'}
      </T>
      <View style={styles.hashes}>
        <HashRow label="Ledger" value={shortHash(result.ledgerHash)} />
        <HashRow label="This device" value={shortHash(result.localHash)} tone={color.ember} />
        {pages.length > 0 && <HashRow label="Pages affected" value={pages.join(', ')} />}
      </View>
      <Button kind="ember" label="Read anyway" onPress={onClose} />
    </Sheet>
  );
}

const HashRow = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
    <T v="caption" style={{ fontSize: 12 }}>
      {label}
    </T>
    <T v="mono" style={{ color: tone ?? color.bone }}>
      {value}
    </T>
  </View>
);

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 18,
    paddingTop: 10,
    paddingHorizontal: 24,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: color.char,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: radius.full, backgroundColor: color.ash },
  glyphTile: { width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(233,180,76,0.12)', alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tile: { flex: 1, gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: color.ash },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 58, gap: 12 },
  hashes: { gap: 8, padding: 14, borderRadius: 12, backgroundColor: color.soot, borderWidth: 1, borderColor: color.ash },
});
