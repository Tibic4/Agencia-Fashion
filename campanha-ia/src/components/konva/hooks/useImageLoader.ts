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
    if (!imageUrl) {
      setLoadedImg(null);
      setImgError(false);
      setImgLoading(false);
      return;
    }

    setImgLoading(true);
    setImgError(false);

    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      setLoadedImg(img);
      setImgLoading(false);
    };

    img.onerror = () => {
      setLoadedImg(null);
      setImgError(true);
      setImgLoading(false);
    };

    img.src = imageUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageUrl]);

  return { loadedImg, imgError, imgLoading };
}
