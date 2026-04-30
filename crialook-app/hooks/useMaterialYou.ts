/**
 * Accent dinâmico Material You (Android 12+).
 *
 * Em Android 12+ o OS expõe uma paleta "dynamic color" derivada do
 * wallpaper. Apps Android que respeitam isso parecem profundamente
 * nativos — o accent se integra com o resto da home. Apps que não usam
 * parecem UI cross-platform genérica.
 *
 * Estratégia: lê o system accent via `PlatformColor`. Em plataformas / OS
 * versions sem dynamic color, fallback pro fuchsia estático da marca.
 * Mantém o fuchsia sempre disponível via `brand` — Material You é
 * *aditivo*: usa em surfaces que devem respirar com o OS (indicador de
 * tab selecionada, segmented controls) e mantém o fuchsia em hero (gradient
 * text, CTA, paywall) que tem que parecer igual pra todo mundo.
 */
import { useMemo } from 'react';
import { Platform, PlatformColor, type ColorValue } from 'react-native';
import Colors from '@/constants/Colors';

export interface MaterialYouPalette {
  /** Accent primário — wallpaper-derived em Android 12+, fuchsia da marca em outros. */
  accent: ColorValue;
  /** Cor de texto/ícone adequada sobre `accent`. */
  onAccent: ColorValue;
  /** Fill de container — accent mais soft, bom pra chip/pill selecionada. */
  accentContainer: ColorValue;
  /** Se o sistema de fato deu paleta dinâmica (false em iOS / Android antigo / web). */
  isDynamic: boolean;
}

const BRAND_FALLBACK: MaterialYouPalette = {
  accent: Colors.brand.primary,
  onAccent: '#FFFFFF',
  accentContainer: Colors.brand.glowSoft,
  isDynamic: false,
};

export function useMaterialYou(): MaterialYouPalette {
  return useMemo<MaterialYouPalette>(() => {
    // process.env.EXPO_OS é o jeito Expo-aware de branchear — tree-shaking
    // melhor no web.
    if (process.env.EXPO_OS !== 'android') return BRAND_FALLBACK;

    // PlatformColor no Android resolve no lado nativo — se o resource não
    // existe (Android <12), o sistema substitui pelo match mais próximo.
    // Não tem jeito confiável de detectar "isso é *de fato* dinâmico" sem
    // ponte com Build.VERSION.SDK_INT. Pro nosso uso, o fallback do
    // próprio Android serve: pré-12 ganha a paleta system_accent1 padrão
    // que ainda parece Material.
    return {
      accent: PlatformColor('@android:color/system_accent1_500'),
      onAccent: PlatformColor('@android:color/system_neutral1_50'),
      accentContainer: PlatformColor('@android:color/system_accent1_100'),
      isDynamic: true,
    };
  }, []);
}

/**
 * Lookup estático pra estilo em escopo de módulo (ex: StyleSheet.create)
 * onde hook não roda. Sempre retorna o fallback de marca — usa o hook em
 * runtime.
 */
export const materialYouFallback = BRAND_FALLBACK;
