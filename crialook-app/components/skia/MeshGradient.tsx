/**
 * MeshGradient — backdrop animado da marca pra telas hero / auth.
 *
 * Por que não LinearGradient: gradient linear é uma diagonal seca, ótima
 * pra botão/pill mas estática como fundo de tela inteira. Uma "mesh" de
 * radial gradients soft com phase shift lento cria uma superfície viva,
 * pictórica, que não disputa com o foreground.
 *
 * 3-4 radial gradients grandes (Skia `Circle` com cor de marca + edges
 * transparentes) sobrepostos com `BlendMode='plus'` pra florescer um no
 * outro. Centros animam em sines lentos (~12-16s) — superfície drifta sem
 * dar sensação de "se mexendo". GPU-thread, ~zero custo de JS.
 *
 * Usa absolute-positioned full-screen. Fuchsia da marca + matizes adjacentes
 * casam com `Colors.brand.gradientPrimary` — não bate de frente com o resto.
 */
import { useEffect } from 'react';
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Circle, Group, Blur } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
  useReducedMotion,
} from 'react-native-reanimated';
import Colors from '@/constants/Colors';

interface Blob {
  /** Cor */
  color: string;
  /** Centro inicial, normalizado 0..1 de width / height */
  x0: number;
  y0: number;
  /** Amplitude do drift como fração de width / height */
  ax: number;
  ay: number;
  /** Phase offset (0..1) pra blobs não andarem em lockstep */
  phase: number;
  /** Raio em dp */
  r: number;
  /** Período do loop em segundos */
  periodSec: number;
}

const DEFAULT_BLOBS: Blob[] = [
  { color: Colors.brand.primary,   x0: 0.25, y0: 0.30, ax: 0.10, ay: 0.08, phase: 0.0,  r: 280, periodSec: 14 },
  { color: Colors.brand.secondary, x0: 0.75, y0: 0.20, ax: 0.08, ay: 0.10, phase: 0.33, r: 260, periodSec: 16 },
  { color: Colors.brand.violet,    x0: 0.60, y0: 0.80, ax: 0.12, ay: 0.06, phase: 0.66, r: 320, periodSec: 18 },
];

interface MeshGradientProps {
  /** Override da lista de blobs */
  blobs?: Blob[];
  /** Multiplicador de opacity (0..1) — abaixa pra 0.4 atrás de texto pesado */
  opacity?: number;
  /** Sigma do blur Skia — suaviza os blobs num gradient contínuo */
  blurSigma?: number;
  style?: StyleProp<ViewStyle>;
}

export function MeshGradient({
  blobs = DEFAULT_BLOBS,
  opacity = 0.85,
  blurSigma = 60,
  style,
}: MeshGradientProps) {
  const { width, height } = useWindowDimensions();

  // Um phase clock compartilhado, normalizado 0..1 sobre o maior período.
  // Cada blob aplica seu próprio período via modulo.
  const phase = useSharedValue(0);
  // A11y: com reduce motion renderizamos arranjo ESTÁTICO (phase travado em
  // 0). Usuário ainda vê a atmosfera da marca, só sem drift. E é mais
  // barato — Skia faz short-circuit do compute por frame.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    phase.value = withRepeat(
      withTiming(1, { duration: 60_000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [phase, reducedMotion]);

  return (
    <View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, style]}>
      <Canvas style={{ flex: 1, opacity }}>
        <Group>
          <Blur blur={blurSigma} />
          {blobs.map((blob, i) => (
            <MeshBlob key={i} blob={blob} width={width} height={height} phase={phase} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
}

interface MeshBlobProps {
  blob: Blob;
  width: number;
  height: number;
  phase: ReturnType<typeof useSharedValue<number>>;
}

function MeshBlob({ blob, width, height, phase }: MeshBlobProps) {
  const cxAnim = useDerivedValue(() => {
    // Clock 60s, período do blob = N s → phase do blob = (phase * 60 / N + offset) mod 1
    const localPhase = ((phase.value * 60) / blob.periodSec + blob.phase) % 1;
    const angle = localPhase * Math.PI * 2;
    return (blob.x0 + Math.cos(angle) * blob.ax) * width;
  });

  const cyAnim = useDerivedValue(() => {
    const localPhase = ((phase.value * 60) / blob.periodSec + blob.phase) % 1;
    const angle = localPhase * Math.PI * 2;
    return (blob.y0 + Math.sin(angle) * blob.ay) * height;
  });

  return <Circle cx={cxAnim} cy={cyAnim} r={blob.r} color={blob.color} />;
}
