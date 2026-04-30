/**
 * AuraGlow — glow ambient lento da marca atrás de um elemento focal.
 *
 * Uso típico: badge "Recomendado" em /plano, pulse atrás do CTA "Gerar"
 * quando já tem foto selecionada — sinaliza "é esse" sem gritar.
 *
 * Um círculo grande soft (Skia Blur) respira opacity 0.3 ↔ 0.6 em ~3.2s.
 * Default: fuchsia da marca. Sized pra extravasar o elemento focal em ~40dp
 * pra glow envolver visivelmente.
 *
 * Pra usar: `size` é o diâmetro do glow. Posiciona absolutamente atrás do
 * focal com offset negativo de ~-20dp em cada lado.
 */
import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Canvas, Circle, Blur } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useDerivedValue,
  useReducedMotion,
} from 'react-native-reanimated';
import Colors from '@/constants/Colors';

interface AuraGlowProps {
  size?: number;
  color?: string;
  /** Envelope de opacity min/max */
  opacityMin?: number;
  opacityMax?: number;
  /** Período do loop em ms */
  periodMs?: number;
  style?: StyleProp<ViewStyle>;
}

export function AuraGlow({
  size = 200,
  color = Colors.brand.primary,
  opacityMin = 0.3,
  opacityMax = 0.6,
  periodMs = 3200,
  style,
}: AuraGlowProps) {
  const phase = useSharedValue(0);
  // A11y: reduce motion congela o glow no midpoint do envelope — ainda
  // visível ("isto está destacado"), só sem o pulse respirando.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      phase.value = 0.5;
      return;
    }
    phase.value = withRepeat(
      withTiming(1, { duration: periodMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [phase, periodMs, reducedMotion]);

  const opacityAnim = useDerivedValue(
    () => opacityMin + (opacityMax - opacityMin) * phase.value,
  );

  return (
    <View pointerEvents="none" style={[{ width: size, height: size }, style]}>
      <Canvas style={{ flex: 1 }}>
        <Blur blur={40} />
        <Circle cx={size / 2} cy={size / 2} r={size / 2.2} color={color} opacity={opacityAnim} />
      </Canvas>
    </View>
  );
}
