import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

/**
 * Rota raiz `/`.
 *
 * Sem este arquivo, expo-router caía na tela "Unmatched Route" ao abrir o
 * app cold start, porque o AuthGate trata `/` como rota pública mas não
 * existe nenhum componente registrado nela. Aqui resolvemos baseado em
 * auth state e mandamos o usuário pra sign-in (deslogado) ou pra (tabs)
 * (logado). O AuthGate ajusta dali pra frente se precisar (ex: onboarding
 * pendente).
 *
 * `loading: true` retorna null e o splash continua até o AuthProvider
 * resolver (ou o timeout de 6s em lib/auth.tsx liberar).
 */
export default function Index() {
  const { isSignedIn, loading } = useAuth();
  if (loading) return null;
  return <Redirect href={isSignedIn ? '/(tabs)/gerar' : '/sign-in'} />;
}
