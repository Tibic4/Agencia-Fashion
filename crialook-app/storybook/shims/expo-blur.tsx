/**
 * Web shim for expo-blur — uses CSS backdrop-filter.
 */
import React from 'react';
import { View, type ViewStyle, StyleSheet } from 'react-native';

interface Props {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

export function BlurView({ intensity = 50, tint = 'default', style, children }: Props) {
  const flat = StyleSheet.flatten(style) ?? {};
  const css: any = {
    ...flat,
    backdropFilter: `blur(${Math.max(8, intensity / 4)}px) saturate(150%)`,
    WebkitBackdropFilter: `blur(${Math.max(8, intensity / 4)}px) saturate(150%)`,
    backgroundColor:
      tint === 'dark'
        ? 'rgba(0,0,0,0.35)'
        : tint === 'light'
        ? 'rgba(255,255,255,0.45)'
        : 'rgba(255,255,255,0.18)',
  };
  return <View style={css}>{children}</View>;
}

export default BlurView;
