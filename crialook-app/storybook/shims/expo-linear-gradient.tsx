/**
 * Web shim for expo-linear-gradient.
 * Renders a CSS linear-gradient div instead of the native gradient view.
 */
import React from 'react';
import { View, type ViewStyle, StyleSheet } from 'react-native';

interface Props {
  colors: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle | ViewStyle[];
  children?: React.ReactNode;
}

export function LinearGradient({ colors, start, end, style, children }: Props) {
  const angle = (() => {
    if (!start || !end) return '135deg';
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const deg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90);
    return `${deg}deg`;
  })();
  const flat = StyleSheet.flatten(style) ?? {};
  const css: any = {
    ...flat,
    backgroundImage: `linear-gradient(${angle}, ${colors.join(', ')})`,
  };
  return <View style={css}>{children}</View>;
}

export default LinearGradient;
