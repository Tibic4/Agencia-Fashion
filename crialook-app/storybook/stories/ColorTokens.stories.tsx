import type { Meta, StoryObj } from '@storybook/react';
import { Text, View } from 'react-native';
import Colors from '../../constants/Colors';

const meta: Meta = {
  title: 'Foundations/Color Tokens',
};
export default meta;

type Story = StoryObj;

const palette: { label: string; value: string }[] = [
  { label: 'primary', value: Colors.brand.primary },
  { label: 'secondary', value: Colors.brand.secondary },
  { label: 'success', value: Colors.brand.success },
  { label: 'warning', value: Colors.brand.warning },
  { label: 'error', value: Colors.brand.error },
];

export const BrandPalette: Story = {
  render: () => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, width: 480 }}>
      {palette.map(p => (
        <View key={p.label} style={{ alignItems: 'center', gap: 4, width: 88 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 14,
              backgroundColor: p.value,
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
            } as any}
          />
          <Text style={{ fontSize: 13, fontWeight: '600' }}>{p.label}</Text>
          <Text style={{ fontSize: 10, color: '#888' }}>{p.value}</Text>
        </View>
      ))}
    </View>
  ),
};
