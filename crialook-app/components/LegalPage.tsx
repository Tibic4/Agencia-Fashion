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
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

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
  /** Body content (in order). */
  blocks: LegalBlock[];
}

export function LegalPage({ title, subtitle, lastUpdated, blocks }: Props) {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {lastUpdated && (
        <Text style={[styles.kicker, { color: colors.textSecondary }]}>
          Atualizado em {lastUpdated}
        </Text>
      )}
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle && (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      )}

      <View style={{ height: 24 }} />

      {blocks.map((block, i) => renderBlock(block, i, colors))}
    </ScrollView>
  );
}

type SchemeColors = (typeof Colors)['light'];

function renderBlock(block: LegalBlock, key: number, colors: SchemeColors) {
  switch (block.type) {
    case 'kicker':
      return (
        <Text key={key} style={[styles.kicker, { color: colors.textSecondary, marginTop: 16 }]}>
          {block.text}
        </Text>
      );
    case 'heading':
      return (
        <Text
          key={key}
          style={[styles.heading, { color: colors.text }]}
          accessibilityRole="header"
        >
          {block.text}
        </Text>
      );
    case 'paragraph':
      return (
        <Text key={key} style={[styles.paragraph, { color: colors.text }]}>
          {block.text}
        </Text>
      );
    case 'list':
      return (
        <View key={key} style={styles.list}>
          {block.items.map((item, j) => (
            <View key={j} style={styles.listItem}>
              <Text style={[styles.bullet, { color: Colors.brand.primary }]}>•</Text>
              <Text style={[styles.listText, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'link':
      return (
        <Text
          key={key}
          style={[styles.link, { color: Colors.brand.primary }]}
          onPress={() => Linking.openURL(block.href).catch(() => {})}
          accessibilityRole="link"
        >
          {block.label}
        </Text>
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
});
