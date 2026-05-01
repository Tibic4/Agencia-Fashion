/**
 * Banner em /gerar pra reivindicar 1 campanha grátis (Beta).
 *
 * Espelha o `<ClaimMiniTrialBanner>` do site (campanha-ia/src/components/
 * ClaimMiniTrialBanner.tsx). Aparece quando usuário ainda é eligible —
 * sem isso, usuários mobile nunca recebem o trial credit, ficam com 0/0
 * e o flow de "primeira campanha grátis" só existe no site.
 *
 * Após reivindicar:
 *  1. Invalida cache de /store/usage e /store/credits (TanStack Query)
 *  2. Banner some — proximo ciclo do useQuery vai retornar `eligible: false`
 *  3. Toast de sucesso
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { apiGet, apiPost } from '@/lib/api';
import { qk } from '@/lib/query-client';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useT } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { toast } from '@/lib/toast';

interface Status {
  enabled: boolean;
  total_slots: number;
  total_used: number;
  remaining: number;
  eligible: boolean | null;
  already_used: boolean;
}

interface ClaimResponse {
  granted: boolean;
  reason?: string;
  remaining?: number;
}

const REASONS_PT: Record<string, string> = {
  already_used: 'Você já reivindicou sua vaga grátis 🙂',
  slots_full: 'As 50 vagas grátis acabaram. Dá uma olhada nos planos.',
  killswitch: 'Beta encerrado.',
  no_store: 'Complete o onboarding primeiro.',
  internal_error: 'Erro ao reivindicar. Tenta de novo em alguns minutos.',
};

export function ClaimMiniTrialBanner() {
  const scheme = useColorScheme();
  const colors = Colors[scheme];
  const queryClient = useQueryClient();
  const { t: _t } = useT();

  const [status, setStatus] = useState<Status | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiGet<Status>('/credits/mini-trial-status')
      .then(s => { if (!cancelled) setStatus(s); })
      .catch(() => { /* silent — banner só some */ });
    return () => { cancelled = true; };
  }, []);

  if (!status || !status.enabled || !status.eligible) return null;

  const onPress = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      haptic.tap();
      const res = await apiPost<ClaimResponse>('/credits/claim-mini-trial');
      if (res.granted) {
        haptic.confirm();
        toast.success('Crédito liberado! Sua campanha grátis está pronta. 🎁', {
          durationMs: 4000,
        });
        // Invalida o saldo + status do trial. Próximo useQuery refetch
        // mostra o crédito novo e o banner some (eligible vira false).
        queryClient.invalidateQueries({ queryKey: qk.store.usage() });
        queryClient.invalidateQueries({ queryKey: qk.store.credits() });
        setStatus({ ...status, eligible: false, already_used: true });
      } else {
        const msg = REASONS_PT[res.reason ?? ''] ?? 'Não foi possível reivindicar agora.';
        toast.warning(msg);
      }
    } catch {
      toast.error('Erro de conexão. Tenta de novo.');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <LinearGradient
        colors={[
          'rgba(217, 70, 239, 0.12)',
          'rgba(168, 85, 247, 0.10)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { borderColor: Colors.brand.primary + '80' }]}
      >
        <View style={styles.iconBox}>
          <Text style={styles.iconEmoji}>🎁</Text>
        </View>
        <View style={styles.content}>
          <Text style={[styles.eyebrow, { color: Colors.brand.primary }]}>
            Beta · {status.remaining} de {status.total_slots} vagas restantes
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Sua 1ª campanha é por nossa conta
          </Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]}>
            1 foto com modelo virtual + legendas prontas. Sem cartão, sem pegadinha.
          </Text>
          <Pressable
            onPress={onPress}
            disabled={claiming}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            style={({ pressed }) => [
              styles.cta,
              { opacity: pressed || claiming ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Pegar minha vaga grátis"
          >
            <LinearGradient
              colors={Colors.brand.gradientPrimary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {claiming ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.ctaText}>Pegar minha vaga grátis →</Text>
            )}
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: Colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 26 },
  content: { flex: 1, gap: 4 },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', lineHeight: 20 },
  desc: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  cta: {
    marginTop: 10,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderCurve: 'continuous',
    alignSelf: 'flex-start',
    overflow: 'hidden',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
});
