import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { View } from 'react-native';
import { Input } from '../../components/ui/Input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Empty: Story = {
  args: { label: 'Nome da loja', placeholder: 'Ex: Bella Moda' },
  render: args => {
    const [v, setV] = useState('');
    return (
      <View style={{ width: 320 }}>
        <Input {...args} value={v} onChangeText={setV} />
      </View>
    );
  },
};

export const Filled: Story = {
  args: { label: 'Cidade' },
  render: args => {
    const [v, setV] = useState('São Paulo');
    return (
      <View style={{ width: 320 }}>
        <Input {...args} value={v} onChangeText={setV} />
      </View>
    );
  },
};

export const WithError: Story = {
  args: { label: 'Email', error: 'Email inválido' },
  render: args => {
    const [v, setV] = useState('invalid@');
    return (
      <View style={{ width: 320 }}>
        <Input {...args} value={v} onChangeText={setV} />
      </View>
    );
  },
};

export const Multiline: Story = {
  args: { label: 'Descrição', multiline: true },
  render: args => {
    const [v, setV] = useState('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
    return (
      <View style={{ width: 320 }}>
        <Input {...args} value={v} onChangeText={setV} />
      </View>
    );
  },
};
