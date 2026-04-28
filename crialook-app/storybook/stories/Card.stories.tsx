import type { Meta, StoryObj } from '@storybook/react';
import { Text, View } from 'react-native';
import { Card } from '../../components/ui/Card';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <View style={{ width: 320 }}>
      <Card style={{ padding: 16 }}>
        <Text style={{ color: '#111', fontWeight: '700' }}>Default Card</Text>
        <Text style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
          Solid background with subtle shadow.
        </Text>
      </Card>
    </View>
  ),
};

export const Glass: Story = {
  render: () => (
    <View
      style={{
        width: 320,
        padding: 24,
        backgroundImage:
          'linear-gradient(135deg, #C026D3 0%, #7C3AED 100%)',
      } as any}
    >
      <Card variant="glass">
        <Text style={{ color: '#fff', fontWeight: '700' }}>Glass Card</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>
          Translucent with backdrop blur. Looks best over an image or gradient.
        </Text>
      </Card>
    </View>
  ),
};
