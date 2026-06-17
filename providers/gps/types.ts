export type GpsProviderCode = "teltonika" | "sinotrack" | "gpswox" | "wialon" | string;

export type VehicleLocationInput = {
  organizationId: string;
  vehicleId: string;
  gpsDeviceId?: string;
  latitude: number;
  longitude: number;
  speedKph?: number;
  heading?: number;
  odometer?: number;
  recordedAt: string;
  rawPayload?: Record<string, unknown>;
};

export interface GpsProvider {
  code: GpsProviderCode;
  normalizeLocation(payload: unknown): VehicleLocationInput;
}
