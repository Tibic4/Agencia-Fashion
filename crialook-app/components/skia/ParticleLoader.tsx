/**
 * ParticleLoader — companion visual procedural pra operações longas.
 *
 * O pipeline de geração leva ~95s. Spinner de 95 segundos lê como "o app
 * travou". Animação procedural com cara de "a IA está pensando" transforma
 * tempo morto em entretenimento.
 *
 * 24 partículas orbitam um centro em paths levemente elípticos. Paleta
 * fuchsia → hot pink → violet cicla por partícula. Inhale/exhale lento no
 * raio da órbita (8s) dá qualidade de respiração — "pensando", não
 * "girando".
 *
 * GPU-thread, Canvas único, ~zero custo de JS thread.
 */
import { useEffect, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Circle, Group } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
  useReducedMotion,
} from 'react-native-reanimated';
import Colors from '@/constants/Colors';

interface ParticleLoaderProps {
  /** Tamanho do container (quadrado). O loader preenche. */
  size?: number;
  /** Número de partículas. 24 = balanço entre densidade e clareza. */
  count?: number;
  style?: StyleProp<ViewStyle>;
}

const PALETTE = [Colors.brand.primary, Colors.brand.secondary, Colors.brand.violet] as const;

export function ParticleLoader({ size = 200, count = 24, style }: ParticleLoaderProps) {
  // Phase da órbita — 1 revolução / 4s
  const phase = useSharedValue(0);
  // Breathing — modulação do raio da órbita / 8s
  const breath = useSharedValue(0);
  // A11y: com reduce motion as partículas congelam na posição inicial. O
  // visual ainda lê como "pensando" (anel de dots) sem o spin que alguns
  // usuários acham desorientador.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    phase.value = withRepeat(withTiming(1, { duration: 4000, easing: Easing.linear }), -1, false);
    breath.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [phase, breath, reducedMotion]);

  // Config estática por partícula — angle offset e elipse da órbita
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      angleOffset: (i / count) * Math.PI * 2,
      // Elipse leve: rx ≠ ry pro anel respirar assimétrico
      rx: 0.36 + (i % 3) * 0.02,
      ry: 0.32 + (i % 3) * 0.02,
      // Raio da partícula varia sutil — adiciona textura
      r: 4 + (i % 4),
      color: PALETTE[i % PALETTE.length],
    }));
  }, [count]);

  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Canvas style={{ flex: 1 }}>
        <Group>
          {particles.map((p, i) => (
            <OrbitParticle
              key={i}
              p={p}
              cx={cx}
              cy={cy}
              size={size}
              phase={phase}
              breath={breath}
            />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

interface OrbitParticleProps {
  p: {
    angleOffset: number;
    rx: number;
    ry: number;
    r: number;
    color: string;
  };
  cx: number;
  cy: number;
  size: number;
  phase: ReturnType<typeof useSharedValue<number>>;
  breath: ReturnType<typeof useSharedValue<number>>;
}

function OrbitParticle({ p, cx, cy, size, phase, breath }: OrbitParticleProps) {
  // Breath modula o raio da órbita ±15%
  const rxAnim = useDerivedValue(() => p.rx * size * (0.85 + breath.value * 0.3));
  const ryAnim = useDerivedValue(() => p.ry * size * (0.85 + breath.value * 0.3));

  const cxAnim = useDerivedValue(() => {
    const angle = phase.value * Math.PI * 2 + p.angleOffset;
    return cx + Math.cos(angle) * rxAnim.value;
  });

  const cyAnim = useDerivedValue(() => {
    const angle = phase.value * Math.PI * 2 + p.angleOffset;
    return cy + Math.sin(angle) * ryAnim.value;
  });

  return <Circle cx={cxAnim} cy={cyAnim} r={p.r} color={p.color} opacity={0.85} />;
}
