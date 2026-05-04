/**
 * BiometricConsentModal — gates the first photo upload of a user/version.
 *
 * Why this exists:
 *   - LGPD art. 11 requires explicit, specific consent for biometric data.
 *   - When the user uploads a photo containing a person (model VTO flow,
 *     close-up, etc.), we must show what we'll do with the data BEFORE
 *     processing it, and persist the consent decision.
 *   - The persisted record is bumped with `CONSENT_VERSION` whenever the
 *     legal text changes — older accepts are invalidated automatically and
 *     the user is asked again.
 *
 * Public API:
 *   ensureBiometricConsent(): Promise<boolean>
 *     Resolves true if consent is already granted (or just granted now).
 *     Resolves false if the user cancelled.
 *
 *   <BiometricConsentMount />  — render once near the app root so the
 *     modal can be summoned from anywhere via the imperative call above.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Button } from '@/components/ui';
import { haptic } from '@/lib/haptics';

const STORAGE_KEY = 'biometric_consent';
const CONSENT_VERSION = 'v1-2026-04-27';

interface ConsentRecord {
  version: string;
  acceptedAt: string;
}

// ---------- Persistence -----------------------------------------------------
async function readConsent(): Promise<ConsentRecord | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed.version !== CONSENT_VERSION) return null; // stale
    return parsed;
  } catch {
    return null;
  }
}

async function writeConsent() {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Best-effort — silently swallow disk errors.
  }
}

// ---------- Imperative API --------------------------------------------------
let summon: ((cb: (granted: boolean) => void) => void) | null = null;

export async function ensureBiometricConsent(): Promise<boolean> {
  const existing = await readConsent();
  if (existing) return true;
  return new Promise((resolve) => {
    if (!summon) {
      // No mount in tree — fail closed (user must mount BiometricConsentMount).
      resolve(false);
      return;
    }
    summon((granted) => {
      if (granted) {
        writeConsent();
      }
      resolve(granted);
    });
  });
}

// ---------- Mount -----------------------------------------------------------
export function BiometricConsentMount() {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const router = useRouter();

  const [visible, setVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const callbackRef = useRef<((granted: boolean) => void) | null>(null);

  useEffect(() => {
    summon = (cb) => {
      callbackRef.current = cb;
      setAgreed(false);
      setVisible(true);
    };
    return () => {
      summon = null;
    };
  }, []);

  const close = (granted: boolean) => {
    setVisible(false);
    const cb = callbackRef.current;
    callbackRef.current = null;
    cb?.(granted);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'overFullScreen'}
      onRequestClose={() => close(false)}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            Antes de continuar
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Quando você envia fotos com pessoas, precisamos do seu consentimento explícito (LGPD art. 11).
          </Text>

          <View style={styles.bullets}>
            {[
              'A foto será processada por IA (Google Gemini) para gerar a campanha.',
              'A imagem fica criptografada e é apagada após 30 dias sem acesso.',
              'Sua foto NÃO é usada para treinar nosso modelo de IA.',
              'Você confirma ter autorização da pessoa fotografada.',
              'A pessoa pode revogar o consentimento a qualquer momento (basta pedir).',
            ].map((line, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bulletDot, { color: Colors.brand.primary }]}>•</Text>
                <Text style={[styles.bulletText, { color: colors.text }]}>{line}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => {
              haptic.tap();
              close(false);
              setTimeout(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- expo-router typed routes don't cover dynamic-params href
                () => router.push('/(legal)/consentimento-biometrico' as any),
                250,
              );
            }}
            style={({ pressed }) => [
              styles.readMore,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityRole="link"
            accessibilityLabel="Ler consentimento completo"
          >
            <Text style={[styles.readMoreText, { color: Colors.brand.primary }]}>
              Ler consentimento completo →
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              haptic.selection();
              setAgreed((v) => !v);
            }}
            style={styles.checkboxRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel="Li e concordo com o tratamento dos dados"
            hitSlop={8}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: agreed ? Colors.brand.primary : 'transparent',
                  borderColor: agreed ? Colors.brand.primary : colors.border,
                },
              ]}
            >
              {agreed && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.text }]}>
              Li e concordo com o tratamento dos dados.
            </Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Button
            title="Aceitar e continuar"
            disabled={!agreed}
            onPress={() => {
              haptic.confirm();
              close(true);
            }}
            shimmerOnEnable
            haptic="confirm"
          />
          <Pressable
            onPress={() => {
              haptic.tap();
              close(false);
            }}
            style={styles.cancel}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            hitSlop={8}
          >
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              Cancelar
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 16 },
  title: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  bullets: { marginTop: 24, gap: 12 },
  bulletRow: { flexDirection: 'row', gap: 10 },
  bulletDot: { fontSize: 18, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  readMore: { marginTop: 16, paddingVertical: 8 },
  readMoreText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  checkboxRow: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxTick: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  checkboxLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  footer: {
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  cancel: { paddingVertical: 12, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  cancelText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
