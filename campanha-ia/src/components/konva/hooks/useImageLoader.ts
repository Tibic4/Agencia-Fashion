"use client";

import { useState, useEffect, useRef } from "react";

interface UseImageLoaderResult {
  loadedImg: HTMLImageElement | null;
  imgError: boolean;
  imgLoading: boolean;
}

/**
 * Loads an image with cross-origin support, proper error/loading states,
 * and cleanup on unmount to prevent memory leaks.
 *
 * P3-4: No longer resets loadedImg to null in cleanup — prevents visual
 * flash when URL changes. The cancelled flag + new effect handles transition.
 */
export function useImageLoader(imageUrl: string | null | undefined): UseImageLoaderResult {
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const prevUrlRef = useRef<string | null | undefined>(null);

  useEffect(() => {
    // No URL — clear state
    if (!imageUrl) {
      setLoadedImg(null);
      setImgError(false);
      setImgLoading(false);
      return;
    }

    let cancelled = false;
    setImgLoading(true);
    setImgError(false);
    // P3-4: Keep previous image visible while new one loads (no flash)
    // Only clear if URL actually changed to something different
    if (prevUrlRef.current !== imageUrl) {
      // Don't setLoadedImg(null) — keep old image as fallback during load
    }
    prevUrlRef.current = imageUrl;

    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (!cancelled) {
        setLoadedImg(img);
        setImgLoading(false);
      }
    };

    img.onerror = () => {
      if (!cancelled) {
        setLoadedImg(null);
        setImgError(true);
        setImgLoading(false);
      }
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      // P3-4: Do NOT clear state here — prevents visual flash
    };
  }, [imageUrl]);

  return { loadedImg, imgError, imgLoading };
}
