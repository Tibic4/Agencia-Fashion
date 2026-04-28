import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Button } from '../../components/ui/Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  args: {
    title: 'Gerar Campanha',
    onPress: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Outline: Story = { args: { variant: 'outline' } };
export const Glass: Story = { args: { variant: 'glass' } };
export const Ghost: Story = { args: { variant: 'ghost' } };

export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };
export const LongLabel: Story = {
  args: { title: 'Um botão com label bem longo que ainda deve caber bem' },
};

export const AllVariants: Story = {
  render: args => (
    <View style={{ gap: 10, width: 320 }}>
      <Button {...args} title="Primary (gradient)" variant="primary" />
      <Button {...args} title="Secondary" variant="secondary" />
      <Button {...args} title="Outline" variant="outline" />
      <Button {...args} title="Glass" variant="glass" />
      <Button {...args} title="Ghost" variant="ghost" />
    </View>
  ),
};
