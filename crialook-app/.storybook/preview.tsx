import type { Preview } from '@storybook/react';
import React from 'react';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#faf9fa' },
        { name: 'dark', value: '#16131a' },
      ],
    },
    layout: 'centered',
  },
  decorators: [
    Story => (
      <div style={{ padding: 16, fontFamily: 'Inter, system-ui, sans-serif', minWidth: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
