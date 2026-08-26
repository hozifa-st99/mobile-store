export function formatDocumentDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDocumentTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Exact moment the document was recorded (used when saving new documents). */
export function documentRecordedAt(): Date {
  return new Date();
}
