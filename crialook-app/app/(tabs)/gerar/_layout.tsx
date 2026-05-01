import { useEffect } from 'react';
import { Stack, useNavigation } from 'expo-router';
import type { EventArg } from '@react-navigation/native';

/**
 * Stack do tab "Criar". O tabPress listener abaixo é a forma canônica do
 * React Navigation pra implementar "tap na tab ativa = popToTop": o tab
 * bar emite `tabPress` no parent navigator, e o stack escuta e popa o
 * próprio histórico até o index.
 *
 * Por que aqui em vez de só no tab bar custom: a abordagem com
 * `StackActions.popToTop({ target })` no tab bar dependia de `route.state.key`
 * estar populado, o que nem sempre era confiável quando o usuário tinha
 * acabado de fazer uma navegação aninhada. Listener aqui é robusto porque
 * usa o `navigation` do próprio stack — sem necessidade de target externo.
 */
export default function GerarLayout() {
  const navigation = useNavigation();

  useEffect(() => {
    const parent = navigation.getParent?.();
    if (!parent) return;
    const unsub = parent.addListener(
      'tabPress' as never,
      ((_e: EventArg<'tabPress', true>) => {
        // canGoBack=true quando o stack tem >1 tela (estamos em /resultado).
        // Sem isso a chamada vira no-op em /gerar/index — nenhum prejuízo,
        // mas evita o trabalho.
        if (navigation.canGoBack?.()) {
          // popToTop existe no Stack mas o tipo do useNavigation é genérico;
          // a chamada é segura no runtime do react-navigation.
          (navigation as unknown as { popToTop: () => void }).popToTop();
        }
      }) as never,
    );
    return unsub;
  }, [navigation]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="resultado" />
    </Stack>
  );
}
