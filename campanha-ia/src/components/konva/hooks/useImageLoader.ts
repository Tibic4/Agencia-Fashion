"use client";

import { useState, useEffect } from "react";

interface UseImageLoaderResult {
  loadedImg: HTMLImageElement | null;
  imgError: boolean;
  imgLoading: boolean;
}

/**
 * Loads an image with cross-origin support, proper error/loading states,
 * and cleanup on unmount to prevent memory leaks.
 */
export function useImageLoader(imageUrl: string | null | undefined): UseImageLoaderResult {
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);

  useEffect(() => {
    // No URL — reset handled via cleanup pattern
    if (!imageUrl) return;

    let cancelled = false;
    setImgLoading(true);
    setImgError(false);

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
      setLoadedImg(null);
      setImgError(false);
      setImgLoading(false);
    };
  }, [imageUrl]);

  return { loadedImg, imgError, imgLoading };
}
