/**
 * Component catalog (dev-only).
 *
 * Why an in-app catalog instead of Storybook?
 *  Storybook for React Native is a separate runtime, slow to set up, and the
 *  ecosystem fractured between on-device and web. For a project that ships
 *  Android-only, a plain Expo Router screen rendering every component in
 *  every variant is faster: open the app in dev, navigate here, see and
 *  interact with everything in one scroll.
 *
 *  This file is guarded by __DEV__ — `RootLayout` redirects in production.
 *
 *  How to open in development:
 *    - Open dev menu (shake device or press D in terminal)
 *    - Or go to crialook://__catalog via the linking deep-link
 *    - Or call router.push('/__catalog') from anywhere
 */
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Button, Card, Input, Skeleton } from '@/components/ui';
import { OfflineBanner } from '@/components/OfflineBanner';
import { QuotaExceededModal } from '@/components/QuotaExceededModal';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT, type Locale } from '@/lib/i18n';

if (!__DEV__) {
  throw new Error('Catalog screen must not load in production builds.');
}

interface StoryProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function Story({ title, description, children }: StoryProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={[styles.story, { borderColor: colors.border }]}>
      <Text style={[styles.storyTitle, { color: colors.text }]}>{title}</Text>
      {description && (
        <Text style={[styles.storyDesc, { color: colors.textSecondary }]}>{description}</Text>
      )}
      <View style={styles.storyBody}>{children}</View>
    </View>
  );
}

export default function CatalogScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const { t, locale, setLocale } = useT();

  const [inputValue, setInputValue] = useState('');
  const [errorInput, setErrorInput] = useState('not-an-email');
  const [quotaOpen, setQuotaOpen] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: '🧪 Catalog (dev)', headerBackVisible: true }} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Component Catalog</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Dev-only · scheme: {colorScheme} · locale: {locale}
          </Text>
        </View>

        {/* Toggles */}
        <Story title="🌐 Locale toggle" description="Mudança ao vivo via useT()">
          <View style={styles.toggleRow}>
            {(['pt-BR', 'en'] as Locale[]).map(code => (
              <Pressable
                key={code}
                onPress={() => setLocale(code)}
                style={[
                  styles.langPill,
                  { borderColor: colors.border },
                  locale === code && {
                    backgroundColor: Colors.brand.primary,
                    borderColor: Colors.brand.primary,
                  },
                ]}
              >
                <Text
                  style={{
                    color: locale === code ? '#fff' : colors.text,
                    fontWeight: '600',
                  }}
                >
                  {code === 'pt-BR' ? '🇧🇷 PT-BR' : '🇺🇸 EN'}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.sample, { color: colors.text }]}>
            Sample · {t('plan.title')} · {t('common.save')} · {t('history.emptyTitle')}
          </Text>
        </Story>

        {/* Buttons */}
        <Story title="Button · variants">
          <View style={styles.buttonStack}>
            <Button title="Primary (gradient)" onPress={() => {}} />
            <Button title="Secondary" variant="secondary" onPress={() => {}} />
            <Button title="Outline" variant="outline" onPress={() => {}} />
            <Button title="Glass" variant="glass" onPress={() => {}} />
            <Button title="Ghost" variant="ghost" onPress={() => {}} />
          </View>
        </Story>

        <Story title="Button · states">
          <View style={styles.buttonStack}>
            <Button title="Default" onPress={() => {}} />
            <Button title="Loading" loading onPress={() => {}} />
            <Button title="Disabled" disabled onPress={() => {}} />
            <Button title="Long label that should still fit" onPress={() => {}} />
          </View>
        </Story>

        {/* Inputs */}
        <Story title="Input · states">
          <Input label="Empty" value="" onChangeText={() => {}} placeholder="Digite algo" />
          <Input label="Filled" value={inputValue || 'Bella Moda'} onChangeText={setInputValue} />
          <Input
            label="With error"
            value={errorInput}
            onChangeText={setErrorInput}
            error="Email inválido"
          />
          <Input
            label="Multiline"
            value="Lorem ipsum dolor sit amet, consectetur."
            onChangeText={() => {}}
            multiline
          />
        </Story>

        {/* Cards */}
        <Story title="Card · variants">
          <Card style={{ padding: 16 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Default Card</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
              Solid background, subtle shadow.
            </Text>
          </Card>
          <View style={{ height: 12 }} />
          <Card variant="glass" style={{ padding: 0 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Glass Card</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
              Translucent with backdrop blur.
            </Text>
          </Card>
        </Story>

        {/* Skeletons */}
        <Story title="Skeleton · sizes">
          <Skeleton width="100%" height={20} />
          <View style={{ height: 8 }} />
          <Skeleton width="80%" height={14} />
          <View style={{ height: 8 }} />
          <Skeleton width="60%" height={14} />
          <View style={{ height: 12 }} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton width={80} height={80} borderRadius={16} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="70%" height={16} />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
        </Story>

        {/* Banners / overlays */}
        <Story title="OfflineBanner" description="Render only when device is offline">
          <Text style={[styles.muted, { color: colors.textSecondary }]}>
            Render real precisa de NetInfo. Aqui mostramos a versão "always on":
          </Text>
          <View style={{ marginTop: 8 }}>
            <OfflineBanner />
          </View>
        </Story>

        {/* Modals */}
        <Story title="QuotaExceededModal">
          <Button title="Open quota modal" onPress={() => setQuotaOpen(true)} />
        </Story>

        {quotaOpen && (
          <QuotaExceededModal
            visible
            used={15}
            limit={15}
            credits={0}
            currentPlan="essencial"
            onClose={() => setQuotaOpen(false)}
          />
        )}

        {/* Color tokens */}
        <Story title="Color tokens">
          <View style={styles.swatchRow}>
            <Swatch label="primary" color={Colors.brand.primary} />
            <Swatch label="secondary" color={Colors.brand.secondary} />
            <Swatch label="success" color={Colors.brand.success} />
            <Swatch label="warning" color={Colors.brand.warning} />
            <Swatch label="error" color={Colors.brand.error} />
          </View>
        </Story>

        {/* Typography */}
        <Story title="Typography (Inter)">
          <Text style={[styles.fontLine, { color: colors.text, fontFamily: 'Inter_400Regular' }]}>
            Inter 400 — The quick brown fox jumps over the lazy dog
          </Text>
          <Text style={[styles.fontLine, { color: colors.text, fontFamily: 'Inter_500Medium' }]}>
            Inter 500 — The quick brown fox jumps over the lazy dog
          </Text>
          <Text style={[styles.fontLine, { color: colors.text, fontFamily: 'Inter_600SemiBold' }]}>
            Inter 600 — The quick brown fox jumps over the lazy dog
          </Text>
          <Text style={[styles.fontLine, { color: colors.text, fontFamily: 'Inter_700Bold' }]}>
            Inter 700 — The quick brown fox jumps over the lazy dog
          </Text>
        </Story>

        <Pressable onPress={() => router.back()} style={styles.exit} hitSlop={12}>
          <Text style={[styles.exitText, { color: Colors.brand.primary }]}>← Sair do catalog</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Swatch({ label, color }: { label: string; color: string }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  return (
    <View style={styles.swatch}>
      <View style={[styles.swatchBox, { backgroundColor: color }]} />
      <Text style={[styles.swatchLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.swatchHex, { color: colors.textSecondary }]}>{color}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, gap: 16, paddingBottom: 60 },
  header: { gap: 4, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  story: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  storyTitle: { fontSize: 15, fontWeight: '700' },
  storyDesc: { fontSize: 12 },
  storyBody: { gap: 10, marginTop: 4 },
  buttonStack: { gap: 10 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  langPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 40,
  },
  sample: { fontSize: 13, marginTop: 8 },
  muted: { fontSize: 12, fontStyle: 'italic' },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { alignItems: 'center', gap: 4, width: 80 },
  swatchBox: { width: 64, height: 64, borderRadius: 12 },
  swatchLabel: { fontSize: 12, fontWeight: '600' },
  swatchHex: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  fontLine: { fontSize: 14, marginVertical: 2 },
  exit: { alignItems: 'center', paddingVertical: 16, minHeight: 48, justifyContent: 'center' },
  exitText: { fontSize: 14, fontWeight: '700' },
});
