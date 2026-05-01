/**
 * AppFadeIn — fade root-level entre splash nativo e primeiro frame.
 *
 * O splash nativo esconde com hard cut — quando `SplashScreen.hideAsync()`
 * resolve, o splash some e o primeiro frame JS aparece abrupto. Em Android
 * 12+ isso é particularmente feio pq o OS splash já faz uma transição
 * smooth ícone→app que a gente quebraria com cut instantâneo.
 *
 * Esse wrapper segura o conteúdo em opacity 0, deixa 1 frame pousar
 * (layout / fonts / theme assentam) e fade in em ~250ms. O splash nativo é
 * escondido NO MESMO effect — usuário vê wash contínuo do backdrop do
 * splash pra surface do app.
 *
 * Como usar: envolve a árvore inteira (logo dentro dos providers em
 * `_layout.tsx`). Passa `ready={true}` quando auth + fonts resolveram.
 */
import { useEffect } from 'react';
import { type PropsWithChildren } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import Animated, { FadeIn, Easing } from 'react-native-reanimated';

interface Props extends PropsWithChildren {
  /** Falso → não renderiza nada (splash fica). True → fade-in no children. */
  ready: boolean;
}

export function AppFadeIn({ ready, children }: Props) {
  useEffect(() => {
    if (!ready) return;
    // Esconde o splash nativo NO momento que o fade-in JS começa. O
    // backdrop do splash bate com `backgroundColor` do app — cross-fade
    // fica invisível, parece uma transição contínua.
    SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <Animated.View
      // bg = cor da splash. Durante o fade-in (opacity 0→1), o que vaza por
      // baixo do conteúdo é fucsia em vez de branco. Combinado com o bg
      // do GestureHandlerRootView e o backgroundColor do app.config.ts,
      // elimina o flash branco no cold start.
      style={{ flex: 1, backgroundColor: '#D946EF' }}
      entering={FadeIn.duration(280).easing(Easing.out(Easing.cubic))}
    >
      {children}
    </Animated.View>
  );
}
