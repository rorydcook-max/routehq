"use client";

import { useEffect, useSyncExternalStore } from "react";
import { vehicleMainPhotos } from "@/app/actions/vehicle-photos";

/**
 * The main photo of each vehicle, fetched once and kept while the app is open (an hour at most), so every
 * vehicle picture in the app can be its photo without each page loading them.
 */
let photos: Record<string, string> = {};
let loadedAt = 0;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const MAX_AGE = 60 * 60 * 1000;

function load(force = false) {
  if (loading || (!force && loadedAt && Date.now() - loadedAt < MAX_AGE)) return;
  loading = vehicleMainPhotos()
    .then((result) => {
      photos = result.photos;
      loadedAt = Date.now();
      listeners.forEach((listener) => listener());
    })
    .catch(() => {
      loadedAt = Date.now();
    })
    .finally(() => {
      loading = null;
    });
}

/** Call after photos are added, removed or reordered, so pictures everywhere follow. */
export function refreshVehiclePhotos() {
  load(true);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The vehicle's main photo, or null while unknown or when it has none. */
export function useVehiclePhoto(vehicleId: string | null | undefined) {
  const url = useSyncExternalStore(
    subscribe,
    () => (vehicleId ? photos[vehicleId] || null : null),
    () => null
  );
  useEffect(() => {
    if (vehicleId) load();
  }, [vehicleId]);
  return url;
}
