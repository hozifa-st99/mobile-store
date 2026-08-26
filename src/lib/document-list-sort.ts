/** Newest document datetime first; tie-break by record creation time. */
export function compareNewestDocumentFirst(
  dateA: Date | string,
  createdA: Date | string,
  dateB: Date | string,
  createdB: Date | string
): number {
  const docDiff = new Date(dateB).getTime() - new Date(dateA).getTime();
  if (docDiff !== 0) return docDiff;
  return new Date(createdB).getTime() - new Date(createdA).getTime();
}
