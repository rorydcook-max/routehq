"use client";

/**
 * A small map for one location's service area: a pin that can be dragged (or the map tapped) to the exact spot, and a
 * circle for "we deliver and collect within X km". Leaflet with OpenStreetMap tiles: no key needed, attribution shown
 * as the OSM tile policy asks. Only ever loaded through next/dynamic (branch-service-area.tsx), so Leaflet and its CSS
 * stay off every other page.
 */
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";

export default function ServiceAreaMap({
  lat,
  lng,
  radiusKm,
  onMove,
  label
}: {
  lat: number;
  lng: number;
  radiusKm: number;
  onMove: (lat: number, lng: number) => void;
  label: string;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const circle = useRef<Circle | null>(null);
  const moved = useRef(onMove);
  moved.current = onMove;

  // Build the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || map.current) return;
      const view = L.map(box.current, { scrollWheelZoom: false, attributionControl: true }).setView([lat, lng], radiusKm > 15 ? 10 : 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
      }).addTo(view);
      // A plain CSS pin (Leaflet's image icons don't survive bundling).
      const icon = L.divIcon({
        className: "",
        html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--primary,#0e5e6f);border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 22]
      });
      const marker = L.marker([lat, lng], { draggable: true, icon, keyboard: true, title: label, alt: label }).addTo(view);
      const ring = L.circle([lat, lng], { radius: Math.max(0, radiusKm) * 1000, color: "#0e5e6f", weight: 2, fillOpacity: 0.12 }).addTo(view);
      marker.on("drag", () => ring.setLatLng(marker.getLatLng()));
      marker.on("dragend", () => {
        const at = marker.getLatLng();
        moved.current(at.lat, at.lng);
      });
      view.on("click", (event: any) => {
        marker.setLatLng(event.latlng);
        ring.setLatLng(event.latlng);
        moved.current(event.latlng.lat, event.latlng.lng);
      });
      map.current = view;
      pin.current = marker;
      circle.current = ring;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow the pin and radius when they change from outside (a found place, a typed radius).
  useEffect(() => {
    if (!map.current || !pin.current || !circle.current) return;
    const current = pin.current.getLatLng();
    if (Math.abs(current.lat - lat) > 1e-6 || Math.abs(current.lng - lng) > 1e-6) {
      pin.current.setLatLng([lat, lng]);
      circle.current.setLatLng([lat, lng]);
      map.current.setView([lat, lng], map.current.getZoom());
    }
  }, [lat, lng]);

  useEffect(() => {
    if (!map.current || !circle.current) return;
    circle.current.setRadius(Math.max(0, radiusKm) * 1000);
    if (radiusKm > 0) map.current.fitBounds(circle.current.getBounds(), { padding: [16, 16], maxZoom: 14 });
  }, [radiusKm]);

  return <div aria-label={label} className="h-64 w-full overflow-hidden rounded-xl border border-[var(--border)] sm:h-72" ref={box} role="region" />;
}
