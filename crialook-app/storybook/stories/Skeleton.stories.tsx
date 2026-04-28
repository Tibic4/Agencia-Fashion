import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Skeleton } from '../../components/ui/Skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const TextLine: Story = {
  args: { width: 240, height: 16 },
};

export const Avatar: Story = {
  args: { width: 80, height: 80, borderRadius: 40 },
};

export const Stack: Story = {
  render: () => (
    <View style={{ width: 320, gap: 8 }}>
      <Skeleton width="100%" height={20} />
      <Skeleton width="80%" height={14} />
      <Skeleton width="60%" height={14} />
      <View style={{ height: 12 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton width={80} height={80} borderRadius={16} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
    </View>
  ),
};
