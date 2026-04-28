/**
 * Web shim for expo-image. Maps the props the project uses to a plain <img>.
 */
import React from 'react';

interface ImageProps {
  source: { uri: string } | number | string;
  style?: any;
  contentFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  transition?: number;
  cachePolicy?: string;
  alt?: string;
}

function resolveSource(source: ImageProps['source']): string {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') return ''; // bundled assets aren't available in the web shim
  return source.uri;
}

export function Image({ source, style, contentFit = 'cover', alt = '' }: ImageProps) {
  const flat = Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : style ?? {};
  return (
    <img
      src={resolveSource(source)}
      alt={alt}
      style={{ ...flat, objectFit: contentFit, display: 'block' }}
    />
  );
}

export default Image;
