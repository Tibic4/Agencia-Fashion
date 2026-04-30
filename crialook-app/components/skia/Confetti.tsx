/**
 * Confetti — burst de celebração GPU-accelerated via Skia.
 *
 * Por que Skia em vez de Lottie / Reanimated: Skia desenha todas as
 * partículas em 1 canvas pass no GPU thread, sem JS por frame. Lottie
 * faria parse de JSON cada frame (gargalo em Android mid-range) e
 * `Animated.View × 80` cria 80 native nodes — Yoga layout pesa.
 *
 * Mount → partículas estouram do centro pra fora com gravidade leve.
 * Auto-dismiss via `onComplete` após `durationMs` (default 2200ms). Bate
 * ~60 partículas confortavelmente em Android 2020+; cair pra 40 em devices
 * mais antigos.
 */
import { useEffect, useMemo } from 'react';
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withTiming,
  Easing,
  useDerivedValue,
  useReducedMotion,
} from 'react-native-reanimated';
import Colors from '@/constants/Colors';

interface Particle {
  id: number;
  /** Offset x/y inicial a partir do centro */
  x0: number;
  y0: number;
  /** Vetor de velocidade */
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

interface ConfettiProps {
  /** Número de partículas. Default 60 — abaixa em devices antigos. */
  count?: number;
  /** Duração total do burst em ms. */
  durationMs?: number;
  /** Paleta de partículas. */
  colors?: readonly string[];
  /** Disparado uma vez quando o burst termina. */
  onComplete?: () => void;
  /** Style do container — normalmente absolute-fill sobre a tela. */
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_PALETTE: readonly string[] = [
  Colors.brand.primary,    // fuchsia
  Colors.brand.secondary,  // hot pink
  Colors.brand.violet,     // violet
  Colors.brand.accent,     // amber
  '#FFFFFF',               // white pop em fundo escuro
];

function makeParticles(count: number, palette: readonly string[]): Particle[] {
  return Array.from({ length: count }, (_, id) => {
    // Burst polar: ângulo random ∈ [0, 2π), velocidade ∈ [120, 320] dp/s
    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 200;
    return {
      id,
      x0: (Math.random() - 0.5) * 20,    // jitter inicial pequeno em torno do centro
      y0: (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 3 + Math.random() * 4,     // 3-7 dp
      color: palette[id % palette.length],
    };
  });
}

const GRAVITY = 380; // dp/s² — puxa pra baixo pra arquear em vez de dispersar

export function Confetti({
  count = 60,
  durationMs = 2200,
  colors = DEFAULT_PALETTE,
  onComplete,
  style,
}: ConfettiProps) {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const cy = height / 2;
  // A11y WCAG 2.2.2 — com "reduce motion" no OS pulamos o burst inteiro e
  // disparamos onComplete no tick seguinte pro fluxo do pai continuar. O
  // haptic de comemoração ainda dispara (é ele, não o visual, que sinaliza
  // sucesso aqui).
  const reducedMotion = useReducedMotion();

  // particles ficam estáveis durante o lifetime do burst
  const particles = useMemo(() => makeParticles(count, colors), [count, colors]);

  // t vai 0 → 1 ao longo de durationMs. Alimenta posições no worklet.
  const t = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      // Cede 1 tick pro setState do caller (ex: setShowConfetti(false))
      // não disparar dentro do próprio render path.
      const timer = setTimeout(() => onComplete?.(), 0);
      return () => clearTimeout(timer);
    }
    t.value = withTiming(1, {
      duration: durationMs,
      easing: Easing.linear,
    });
    const timer = setTimeout(() => onComplete?.(), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onComplete, reducedMotion, t]);

  if (reducedMotion) return null;

  // Pra cada partícula, derivamos x/y/opacity a partir de t. Um `time`
  // compartilhado e o Skia faz a matemática no render path.
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, style]}>
      <Canvas style={{ flex: 1 }}>
        <Group>
          {particles.map((p) => (
            <ConfettiParticle key={p.id} p={p} cx={cx} cy={cy} t={t} totalSec={durationMs / 1000} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

interface ParticleProps {
  p: Particle;
  cx: number;
  cy: number;
  t: ReturnType<typeof useSharedValue<number>>;
  totalSec: number;
}

function ConfettiParticle({ p, cx, cy, t, totalSec }: ParticleProps) {
  const cxAnim = useDerivedValue(() => {
    const elapsed = t.value * totalSec;
    return cx + p.x0 + p.vx * elapsed;
  });

  const cyAnim = useDerivedValue(() => {
    const elapsed = t.value * totalSec;
    return cy + p.y0 + p.vy * elapsed + 0.5 * GRAVITY * elapsed * elapsed;
  });

  // Fade out nos últimos 30% do lifetime.
  const opacityAnim = useDerivedValue(() => {
    if (t.value < 0.7) return 1;
    return Math.max(0, 1 - (t.value - 0.7) / 0.3);
  });

  return <Circle cx={cxAnim} cy={cyAnim} r={p.radius} color={p.color} opacity={opacityAnim} />;
}
