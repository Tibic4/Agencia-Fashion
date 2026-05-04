/**
 * LegalPage — opinionated renderer for the legal screens (terms, privacy,
 * dpo, subprocessadores, consentimento biometrico).
 *
 * Why a structured renderer instead of markdown:
 *   - The legal copy is static and finite (5 documents). Shipping a markdown
 *     parser (react-native-markdown-display) adds ~80 KB to the bundle for
 *     content we control end-to-end. A Text/View renderer is lighter and
 *     renders identically across iOS/Android, with full StyleSheet control.
 *   - We can hot-swap individual sections without re-parsing markdown.
 *   - Accessibility: each section gets the right `accessibilityRole`
 *     (header for headings, text for paragraphs).
 *
 * Block grammar:
 *   { heading: string }                 → h2-style section title
 *   { paragraph: string }               → body text
 *   { list: string[] }                  → bulleted list
 *   { kicker: string }                  → uppercase 10-px label above heading
 *   { spacer: number }                  → vertical gap (px)
 */
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { SITE_BASE } from '@/lib/legal/content';

export type LegalBlock =
  | { type: 'kicker'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'link'; label: string; href: string }
  | { type: 'spacer'; size?: number };

interface Props {
  /** Big H1 at the top of the page. */
  title: string;
  /** Optional intro line right under the title. */
  subtitle?: string;
  /** Last-updated date — shown as a kicker below the title. */
  lastUpdated?: string;
  /**
   * Site slug for the canonical version of this legal text. Render a
   * prominent "Versão completa" CTA at the top that opens
   * `${SITE_BASE}/${siteSlug}` in the system browser.
   *
   * Required by the M2-02 Option B drift policy: the in-app text is a
   * SUMMARY; the canonical version lives on the marketing site, and
   * the user must always be able to reach it in one tap.
   */
  siteSlug?: string;
  /** Body content (in order). */
  blocks: LegalBlock[];
}

export function LegalPage({ title, subtitle, lastUpdated, siteSlug, blocks }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();

  const fullUrl = siteSlug ? `${SITE_BASE}/${siteSlug}` : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {lastUpdated && (
        <Animated.Text
          entering={FadeIn.duration(280)}
          style={[styles.kicker, { color: colors.textSecondary }]}
          selectable
        >
          Atualizado em {lastUpdated}
        </Animated.Text>
      )}
      <Animated.Text
        entering={FadeInDown.duration(360).delay(40)}
        style={[styles.title, { color: colors.text }]}
        accessibilityRole="header"
        selectable
      >
        {title}
      </Animated.Text>
      {subtitle && (
        <Animated.Text
          entering={FadeInDown.duration(360).delay(80)}
          style={[styles.subtitle, { color: colors.textSecondary }]}
          selectable
        >
          {subtitle}
        </Animated.Text>
      )}

      {fullUrl && (
        <Animated.View
          entering={FadeInDown.duration(360).delay(120)}
          style={[
            styles.fullVersionCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.fullVersionLabel, { color: colors.textSecondary }]}>
            Esta é uma versão resumida.
          </Text>
          <Pressable
            onPress={() => {
              Linking.openURL(fullUrl).catch(() => {});
            }}
            accessibilityRole="link"
            accessibilityLabel={`Abrir versão completa em ${fullUrl}`}
            accessibilityHint="Abre a versão canônica desta política no navegador"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.fullVersionLink, { color: Colors.brand.primary }]}>
              Ver versão completa em {fullUrl}
            </Text>
          </Pressable>
        </Animated.View>
      )}

      <View style={{ height: 24 }} />

      {blocks.map((block, i) => renderBlock(block, i, colors))}
    </ScrollView>
  );
}

type SchemeColors = (typeof Colors)['light'];

function renderBlock(block: LegalBlock, key: number, colors: SchemeColors) {
  // Subtle stagger so the page paints in waves rather than slamming all at
  // once. Cap the delay so deep documents don't make the bottom blocks feel
  // laggy. 120ms cap keeps everything visible within ~500ms.
  const delay = Math.min(120 + key * 30, 360);

  switch (block.type) {
    case 'kicker':
      return (
        <Animated.Text
          key={key}
          entering={FadeIn.duration(260).delay(delay)}
          style={[styles.kicker, { color: colors.textSecondary, marginTop: 16 }]}
          selectable
        >
          {block.text}
        </Animated.Text>
      );
    case 'heading':
      return (
        <Animated.Text
          key={key}
          entering={FadeInDown.duration(300).delay(delay)}
          style={[styles.heading, { color: colors.text }]}
          accessibilityRole="header"
          selectable
        >
          {block.text}
        </Animated.Text>
      );
    case 'paragraph':
      return (
        <Animated.Text
          key={key}
          entering={FadeIn.duration(280).delay(delay)}
          style={[styles.paragraph, { color: colors.text }]}
          selectable
        >
          {block.text}
        </Animated.Text>
      );
    case 'list':
      return (
        <Animated.View
          key={key}
          entering={FadeIn.duration(300).delay(delay)}
          style={styles.list}
        >
          {block.items.map((item, j) => (
            <View key={j} style={styles.listItem}>
              <Text style={[styles.bullet, { color: Colors.brand.primary }]}>•</Text>
              <Text style={[styles.listText, { color: colors.text }]} selectable>
                {item}
              </Text>
            </View>
          ))}
        </Animated.View>
      );
    case 'link':
      return (
        <Animated.Text
          key={key}
          entering={FadeIn.duration(280).delay(delay)}
          style={[styles.link, { color: Colors.brand.primary }]}
          onPress={() => Linking.openURL(block.href).catch(() => {})}
          accessibilityRole="link"
          selectable
        >
          {block.label}
        </Animated.Text>
      );
    case 'spacer':
      return <View key={key} style={{ height: block.size ?? 16 }} />;
  }
}

// Keep style named keys aligned with site typography rhythm
const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 16,
  },
  kicker: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
    marginTop: 6,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    marginTop: 6,
  },
  heading: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
    marginTop: 28,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 24,
    marginBottom: 12,
  },
  list: {
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingRight: 8,
  },
  bullet: {
    fontSize: 16,
    width: 16,
    fontFamily: 'Inter_700Bold',
    lineHeight: 22,
  },
  listText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  link: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    textDecorationLine: 'underline',
    marginBottom: 12,
  },
  fullVersionCard: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fullVersionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 4,
  },
  fullVersionLink: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textDecorationLine: 'underline',
    lineHeight: 20,
  },
});
