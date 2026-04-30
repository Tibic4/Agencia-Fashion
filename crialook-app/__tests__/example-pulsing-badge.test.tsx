/**
 * Teste de componente exemplo exercitando o setup Jest + Reanimated + RTL.
 *
 * O PulsingBadge real não é exportado, então o teste assenta sobre um
 * componente inline minúsculo que usa a mesma API CSS de animação do
 * Reanimated. O ponto é provar que a infra de teste roda end-to-end:
 *   - preset jest-expo transpila sintaxe RN
 *   - jest.setup.ts mocka Reanimated pro módulo noop
 *   - @testing-library/react-native renderiza e consulta
 *
 * Adiciona testes de tela reais como irmãos desse arquivo seguindo o mesmo
 * padrão.
 */
import React from 'react';
import { Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { render, screen } from '@testing-library/react-native';

function Pulse({ label }: { label: string }) {
  return (
    <Animated.View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={
        {
          animationName: { '0%': { opacity: 1 }, '50%': { opacity: 0.6 }, '100%': { opacity: 1 } },
          animationDuration: '1600ms',
          animationIterationCount: 'infinite',
        } as any
      }
    >
      <Text>{label}</Text>
    </Animated.View>
  );
}

describe('Pulse', () => {
  it('renders the label inside an accessible view', () => {
    render(<Pulse label="Ativo" />);
    expect(screen.getByText('Ativo')).toBeOnTheScreen();
    expect(screen.getByLabelText('Ativo')).toBeOnTheScreen();
  });
});
