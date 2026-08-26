export function parseOptionList(value: unknown): string[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return [];

    if (typeof value[0] === "object" && value[0] !== null && "nameAr" in value[0]) {
      return Array.from(
        new Set(
          value
            .filter((v) => typeof v === "object" && v !== null && (v as { isActive?: boolean }).isActive !== false)
            .map((v) => String((v as { nameAr: string }).nameAr).trim())
            .filter(Boolean)
        )
      );
    }

    return Array.from(new Set(value.map((v) => String(v).trim()).filter(Boolean)));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parseOptionList(parsed);
    } catch {
      return Array.from(
        new Set(
          trimmed
            .split(/[,،]/)
            .map((s) => s.trim())
            .filter(Boolean)
        )
      );
    }
  }

  return [];
}

export function normalizeOptionList(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

export interface PhoneModelSpecs {
  colors?: unknown;
  storages?: unknown;
  storageOptions?: unknown;
  rams?: unknown;
  ramOptions?: unknown;
}

export function getModelOptionLists(model?: PhoneModelSpecs | null) {
  return {
    colors: parseOptionList(model?.colors),
    storageOptions: parseOptionList(model?.storages ?? model?.storageOptions),
    ramOptions: parseOptionList(model?.rams ?? model?.ramOptions),
  };
}

export function buildPhoneDescription(
  name: string,
  specs: { color?: string; storage?: string; ram?: string }
) {
  const parts = [name, specs.color, specs.storage, specs.ram].filter(Boolean);
  return parts.join(" — ");
}
