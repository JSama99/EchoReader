import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { allEditions, getChapter, provenanceOf } from '@/content/catalog';
import { ACHIEVEMENTS } from '@/domain/achievements';
import { collectibleTrust } from '@/domain/commerce/ledger';
import { toRoman } from '@/domain/fragments';
import { shortHash } from '@/domain/pow';
import { chapterName } from '@/domain/library';
import { useEmbers, useFragments } from '@/state/derived';
import { useReader } from '@/state/store';
import { color, radius } from '@/theme/tokens';
import { Ember } from '@/ui/icons';
import { Diamonds, Row, T } from '@/ui/kit';
import { useVerification } from '@/ui/pow-seal';

const EVENT_LABEL: Record<string, string> = {
  'chapter-complete': 'Finished a chapter',
  'glyph-discovered': 'Discovered a glyph',
  'streak-7': 'Reading streak',
  'collection-complete': 'Completed a collection',
  achievement: 'Achievement',
  grant: 'Welcome gift',
  legacy: 'Carried over from v0.1',
};

const TONE = { verified: color.ember, owned: color.bone, pending: color.storm, demo: color.smoke } as const;

/**
 * Everything the reader owns or has earned, each labeled for exactly what it
 * is: a purchase, an earned reward, a sandbox test, or (in future) a
 * verified on-chain collectible. Nothing simulated is presented as owned.
 */
export default function Vault() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useReader((st) => st);
  const embers = useEmbers();
  const frags = useFragments('flame-sigil');
  const provenance = provenanceOf('flame-sigil');
  const verify = useVerification('flame-sigil-1');
  const purchases = s.commerce.entitlements.filter((e) => e.source === 'purchase');
  const events = [...s.rewards.events].filter((e) => e.amount > 0).reverse().slice(0, 8);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.soot }} contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 40, paddingHorizontal: 24, gap: 28 }}>
      <View style={{ gap: 6 }}>
        <T v="headline" style={{ fontSize: 32, lineHeight: 36 }}>
          Vault
        </T>
        <T v="caption">Your editions, rewards and discoveries, each labeled for exactly what it is.</T>
      </View>

      <Section title="Embers">
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ember size={26} />
            <T v="headline" style={{ fontSize: 30 }}>
              {embers}
            </T>
            <T v="caption" style={{ flex: 1, textAlign: 'right' }}>
              Earned rewards · not money
            </T>
          </View>
          {events.map((e) => (
            <View key={e.id} style={styles.line}>
              <T v="caption" style={{ flex: 1 }}>
                {e.ruleId === 'achievement' ? `Achievement · ${ACHIEVEMENTS.find((a) => a.id === e.key)?.title ?? e.key}` : (EVENT_LABEL[e.ruleId] ?? e.ruleId)}
              </T>
              <T v="mono">+{e.amount}</T>
            </View>
          ))}
          <T v="caption" style={{ fontSize: 12 }}>
            No rewards are offered for Embers yet. When they are (artwork, badges, selected fragments), they’ll appear here.
          </T>
        </View>
      </Section>

      <Section title="Editions">
        {purchases.length === 0 ? (
          <T v="caption">Editions you buy appear here. Every edition includes the readable chapter.</T>
        ) : (
          purchases.map((e) => {
            const ch = getChapter(e.chapterId);
            const ed = allEditions().find((x) => x.id === e.editionId);
            return (
              <Row key={e.id} style={styles.row} onPress={() => router.push(`/editions/${e.chapterId}`)} accessibilityRole="button">
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="body" style={{ color: color.bone }}>
                    {ch ? chapterName(ch) : e.chapterId}
                  </T>
                  <T v="mono" style={{ fontSize: 10 }}>
                    {(ed?.title ?? 'Edition').toUpperCase()} · {e.status === 'active' ? 'READING LICENSE' : e.status.toUpperCase()}
                    {e.verification === 'sandbox' ? ' · SANDBOX' : ''}
                  </T>
                </View>
              </Row>
            );
          })
        )}
      </Section>

      <Section title="Collectibles">
        {s.commerce.collectibles.length === 0 ? (
          <T v="caption">Collector and Legendary editions record a numbered collectible here. Minting on a blockchain isn’t live yet.</T>
        ) : (
          s.commerce.collectibles.map((c) => {
            const trust = collectibleTrust(c);
            const ch = getChapter(c.chapterId);
            const ed = allEditions().find((x) => x.id === c.editionId);
            return (
              <View key={c.id} style={styles.collectible}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <T v="bodyStrong" style={{ flex: 1 }}>
                    {ed?.title ?? 'Collectible'} · {ch?.title}
                  </T>
                  <View style={[styles.badge, { borderColor: TONE[trust.tone] }]}>
                    <T v="mono" style={{ fontSize: 10, color: TONE[trust.tone] }}>
                      {trust.label.toUpperCase()}
                    </T>
                  </View>
                </View>
                <T v="caption">{trust.detail}</T>
                <T v="mono" style={{ fontSize: 10 }}>
                  {c.serial != null ? `NO. ${c.serial}${c.supply ? ` OF ${c.supply}` : ''}` : 'NUMBER ASSIGNED AT MINTING'}
                </T>
              </View>
            );
          })
        )}
      </Section>

      <Section title="Sigils">
        <View style={styles.card}>
          <T v="bodyStrong">Genesis Sigils</T>
          <T v="caption">Founding-supporter collectibles. Not yet issued; benefits will be published before they are.</T>
        </View>
        <View style={[styles.card, { marginTop: 10 }]}>
          <T v="bodyStrong">Elemental Sigils</T>
          <T v="caption">Artifacts of the nine Elementals, released as the story reveals them. Not yet issued.</T>
        </View>
      </Section>

      <Section title="Memory Fragments">
        <View style={[styles.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ gap: 4, flex: 1 }}>
            <T v="bodyStrong">
              {frags.count} of 9 found
            </T>
            <T v="caption">{frags.found.length ? frags.found.map((f) => `${toRoman(f.ordinal)} · ${f.title}`).join('\n') : 'Found by reading Flame Sigil'}</T>
          </View>
          <Diamonds count={frags.count} />
        </View>
      </Section>

      <Section title="Achievements">
        <View style={styles.grid}>
          {ACHIEVEMENTS.map((a) => {
            const got = s.achievements.some((x) => x.id === a.id);
            return (
              <View key={a.id} style={[styles.ach, got && { borderColor: color.ember }]} accessibilityLabel={`${a.title}. ${a.detail}. ${got ? 'Earned' : 'Not yet earned'}`}>
                <T v="bodyStrong" style={{ color: got ? color.bone : color.smoke, fontSize: 14 }}>
                  {a.title}
                </T>
                <T v="caption" style={{ fontSize: 12 }}>
                  {a.detail}
                </T>
              </View>
            );
          })}
        </View>
      </Section>

      <Section title="Verification records">
        <View style={styles.card}>
          <T v="bodyStrong">Flame Sigil catalog</T>
          <T v="mono" style={{ fontSize: 10 }}>
            MANIFEST v{provenance?.version} · {provenance?.publisher.name.toUpperCase()}
          </T>
          <T v="caption">
            {provenance?.signature.status === 'trusted'
              ? `Signed by ${provenance.signature.issuer.name}.`
              : provenance?.signature.status === 'development-key'
                ? 'Signed with a development key. Release builds need a production signing key.'
                : 'Signature not verified.'}
          </T>
          <T v="mono" style={{ fontSize: 10, paddingTop: 6 }}>
            CHAPTER ONE PAGES · {verify ? (verify.status === 'verified' ? `MATCH ${shortHash(verify.chapterHash)}` : verify.status.toUpperCase()) : 'CHECKING'}
          </T>
          <T v="caption" style={{ fontSize: 12, paddingTop: 6 }}>
            A match means the page files on this device are identical to what the publisher recorded and signed. It isn’t proof of copyright,
            authorship or ownership of anything.
          </T>
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <T v="label" style={{ paddingBottom: 10 }}>
        {title}
      </T>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 16, borderRadius: radius.md, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash },
  line: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.ash, paddingTop: 8 },
  row: { minHeight: 58, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.ash },
  collectible: { gap: 8, padding: 16, borderRadius: radius.md, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash, marginBottom: 10 },
  badge: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ach: { width: '47%', gap: 4, padding: 12, borderRadius: radius.md, backgroundColor: color.char, borderWidth: 1, borderColor: color.ash, minHeight: 76 },
});
