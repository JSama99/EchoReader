import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { shortHash, type VerifyResult } from '@/domain/pow';
import { verifyBundledChapter } from '@/services/pow-device';
import { color, font, radius } from '@/theme/tokens';

import { Shield } from './icons';

export function useVerification(chapterId: string | undefined): VerifyResult | undefined {
  const [result, setResult] = useState<VerifyResult>();
  useEffect(() => {
    let alive = true;
    if (!chapterId) return;
    verifyBundledChapter(chapterId).then((r) => alive && setResult(r));
    return () => {
      alive = false;
    };
  }, [chapterId]);
  return result;
}

export function PowSeal({ result, onPress }: { result: VerifyResult | undefined; onPress?: () => void }) {
  const state = !result ? 'checking' : result.status;
  const label =
    state === 'verified' ? 'POW VERIFIED' : state === 'mismatch' ? 'POW MISMATCH' : state === 'checking' ? 'VERIFYING' : 'UNVERIFIED';
  const tone = state === 'mismatch' ? color.ember : color.bone;
  const a11y =
    result?.status === 'verified'
      ? `Pages match the publisher’s record, hash ${shortHash(result.chapterHash)}`
      : result?.status === 'mismatch'
        ? 'This copy does not match the publisher’s record. Tap for details.'
        : 'Edition verification';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={a11y}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 5,
        paddingLeft: 8,
        paddingRight: 10,
        borderRadius: radius.full,
        backgroundColor: 'rgba(11,10,9,0.7)',
        borderWidth: 1,
        borderColor: state === 'mismatch' ? 'rgba(255,91,31,0.6)' : 'rgba(242,235,221,0.18)',
        alignSelf: 'flex-start',
      }}
    >
      <Shield ok={state !== 'mismatch'} color={tone} />
      <View>
        <Text style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: 0.6, color: tone }}>{label}</Text>
      </View>
    </Pressable>
  );
}
