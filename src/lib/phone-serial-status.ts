/** حالات سجل السيريال — نص حر في قاعدة البيانات، موحّد هنا */
export const PHONE_SERIAL_STATUS = {
  AVAILABLE: "available",
  RESERVED: "reserved",
  SOLD: "sold",
  REMOVED: "removed",
} as const;

export type PhoneSerialStatus = (typeof PHONE_SERIAL_STATUS)[keyof typeof PHONE_SERIAL_STATUS];

/** حالات سجل الحجز */
export const PHONE_RESERVATION_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type PhoneReservationStatus =
  (typeof PHONE_RESERVATION_STATUS)[keyof typeof PHONE_RESERVATION_STATUS];

/** سيرiالات «في المحل» — للجرد وكمية المخzون */
export const PHONE_SERIAL_IN_STOCK_STATUSES = [
  PHONE_SERIAL_STATUS.AVAILABLE,
  PHONE_SERIAL_STATUS.RESERVED,
] as const;
