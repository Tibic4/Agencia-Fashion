"use client";

import { useEffect, useRef } from "react";

/**
 * useWakeLock — Prevents the device screen from turning off.
 * 
 * Uses the Screen Wake Lock API (supported in Chrome, Edge, Safari 16.4+).
 * Automatically requests the lock when `active` is true, and releases it
 * when `active` becomes false or the component unmounts.
 * 
 * Falls back gracefully on unsupported browsers (no-op).
 * Re-acquires the lock if the page regains visibility (e.g., user switches tabs).
 * 
 * @param active - Whether the wake lock should be active
 */
export function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      // Release existing lock when no longer needed
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    // Check browser support
    if (!("wakeLock" in navigator)) {
      return;
    }

    const requestWakeLock = async () => {
      try {
        // Only request if document is visible (required by the API)
        if (document.visibilityState === "visible") {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Permission denied or not supported — fail silently
      }
    };

    // Request immediately
    requestWakeLock();

    // Re-acquire when page becomes visible again (tab switch, app switch)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && active) {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [active]);
}
