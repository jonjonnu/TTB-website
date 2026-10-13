// Parcel tracking. Today tracking numbers are entered by admins (one by one or by CSV for a group).
// The J&T API (preferred, ~500 delivery locations) would implement TrackingProvider and a scheduled
// job would call it to move orders to "จัดส่งสำเร็จ" and notify employees automatically.
export interface TrackingProvider {
  name: string;
  /** Returns true once the parcel has been delivered. */
  isDelivered(trackingNumber: string): Promise<boolean>;
}

export const DEFAULT_CARRIER = "J&T";
