/** دوال الباركود — توليد + بادئة من الاسم */

const BARCODE_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomAlphanumeric(length: number): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => BARCODE_CHARS[b % BARCODE_CHARS.length]).join("");
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    out += BARCODE_CHARS[Math.floor(Math.random() * BARCODE_CHARS.length)];
  }
  return out;
}

/** توليد باركود — بادئة + وقت + عشوائي */
export function generateProductBarcode(prefix = "MS"): string {
  const safePrefix = prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6) || "MS";
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = randomAlphanumeric(8);
  return `${safePrefix}${timePart}${randomPart}`.slice(0, 24);
}

const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "A", أ: "A", إ: "A", آ: "A",
  ب: "B", ت: "T", ث: "T", ج: "J",
  ح: "H", خ: "K", د: "D", ذ: "Z",
  ر: "R", ز: "Z", س: "S", ش: "S",
  ص: "S", ض: "D", ط: "T", ظ: "Z",
  ع: "A", غ: "G", ف: "F", ق: "Q",
  ك: "K", ل: "L", م: "M", ن: "N",
  ه: "H", و: "W", ي: "Y", ة: "H",
  ى: "A", ئ: "Y", ء: "A",
};

export function barcodePrefixFromName(name: string, maxLen = 4): string {
  let result = "";
  for (const ch of name.trim()) {
    if (/[a-zA-Z0-9]/.test(ch)) {
      result += ch.toUpperCase();
    } else {
      const mapped = ARABIC_TO_LATIN[ch];
      if (mapped) result += mapped;
    }
    if (result.length >= maxLen) break;
  }
  const cleaned = result.replace(/[^A-Z0-9]/g, "").slice(0, maxLen);
  return cleaned || "MS";
}
