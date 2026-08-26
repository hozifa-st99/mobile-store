const IPHONE_LABELS = ["iphone", "آيفون", "ايفون", "أيفون"];

export function isIphonePlatformName(nameAr: string): boolean {
  const normalized = nameAr.trim().toLowerCase();
  return IPHONE_LABELS.some(
    (label) => normalized === label.toLowerCase() || normalized.includes(label.toLowerCase())
  );
}

export function isIphonePlatform(platform: { nameAr: string } | null | undefined): boolean {
  return platform ? isIphonePlatformName(platform.nameAr) : false;
}
