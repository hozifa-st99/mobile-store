export interface ModelSpecRequirements {
  requireColors: boolean;
  requireStorage: boolean;
  requireRam: boolean;
}

export interface ModelSpecValues {
  colors: string[];
  storageOptions: string[];
  ramOptions: string[];
}

export function validateModelSpecs(
  specs: ModelSpecValues,
  requirements: ModelSpecRequirements
): string | null {
  if (requirements.requireColors && specs.colors.length === 0) {
    return "يجب إضافة لون واحد على الأقل لهذه الشركة";
  }
  if (requirements.requireStorage && specs.storageOptions.length === 0) {
    return "يجب إضافة مساحة تخزين واحدة على الأقل لهذه الشركة";
  }
  if (requirements.requireRam && specs.ramOptions.length === 0) {
    return "يجب إضافة قيمة رام واحدة على الأقل لهذه الشركة";
  }
  return null;
}

export type PhoneSpecValidationError = "COLOR_REQUIRED" | "STORAGE_REQUIRED" | "RAM_REQUIRED";

export const PHONE_SPEC_ERROR_MESSAGES: Record<PhoneSpecValidationError, string> = {
  COLOR_REQUIRED: "اختر اللون للموبايل",
  STORAGE_REQUIRED: "اختر المساحة للموبايل",
  RAM_REQUIRED: "اختر الرام للموبايل",
};

/** إعدادات الإلزام من المنصة أو الشركة (Android) */
export function resolveSpecRequirements(entity: {
  platform: ModelSpecRequirements;
  brand?: ModelSpecRequirements | null;
}): ModelSpecRequirements {
  if (entity.brand) {
    return {
      requireColors: entity.brand.requireColors,
      requireStorage: entity.brand.requireStorage,
      requireRam: entity.brand.requireRam,
    };
  }
  return {
    requireColors: entity.platform.requireColors,
    requireStorage: entity.platform.requireStorage,
    requireRam: entity.platform.requireRam,
  };
}

/** يتحقق من الحقول الإلزامية فقط — وجود خيارات في القائمة لا يعني إلزام الإدخال */
export function validatePhoneLineSpecs(
  specs: ModelSpecValues,
  requirements: ModelSpecRequirements,
  values: { color?: string | null; storage?: string | null; ram?: string | null }
): PhoneSpecValidationError | null {
  if (requirements.requireColors && specs.colors.length > 0 && !values.color?.trim()) {
    return "COLOR_REQUIRED";
  }
  if (requirements.requireStorage && specs.storageOptions.length > 0 && !values.storage?.trim()) {
    return "STORAGE_REQUIRED";
  }
  if (requirements.requireRam && specs.ramOptions.length > 0 && !values.ram?.trim()) {
    return "RAM_REQUIRED";
  }
  return null;
}

export function phoneSpecValidationMessage(
  error: PhoneSpecValidationError,
  modelName?: string
): string {
  const base = PHONE_SPEC_ERROR_MESSAGES[error];
  return modelName ? `${base} — ${modelName}` : base;
}

export function getClientSpecRequirements(
  platforms: Array<{
    id: string;
    requiresBrand: boolean;
    requireColors?: boolean;
    requireStorage?: boolean;
    requireRam?: boolean;
    brands: Array<{
      id: string;
      requireColors?: boolean;
      requireStorage?: boolean;
      requireRam?: boolean;
    }>;
  }>,
  item: { platformId: string; brandId: string }
): ModelSpecRequirements {
  const platform = platforms.find((p) => p.id === item.platformId);
  if (!platform) {
    return { requireColors: false, requireStorage: false, requireRam: false };
  }
  if (platform.requiresBrand && item.brandId) {
    const brand = platform.brands.find((b) => b.id === item.brandId);
    if (brand) {
      return {
        requireColors: !!brand.requireColors,
        requireStorage: !!brand.requireStorage,
        requireRam: !!brand.requireRam,
      };
    }
  }
  return {
    requireColors: !!platform.requireColors,
    requireStorage: !!platform.requireStorage,
    requireRam: !!platform.requireRam,
  };
}

type PrismaLike = {
  phoneBrand: {
    findFirst: (args: object) => Promise<ModelSpecRequirements | null>;
  };
  phonePlatform: {
    findFirst: (args: object) => Promise<ModelSpecRequirements | null>;
  };
};

export async function getModelSpecRequirements(
  prisma: PrismaLike,
  companyId: string,
  params: { platformId: string; brandId?: string | null }
): Promise<ModelSpecRequirements | null> {
  if (params.brandId) {
    const brand = await prisma.phoneBrand.findFirst({
      where: { id: params.brandId, companyId, isActive: true },
    });
    if (!brand) return null;
    return {
      requireColors: brand.requireColors,
      requireStorage: brand.requireStorage,
      requireRam: brand.requireRam,
    };
  }

  const platform = await prisma.phonePlatform.findFirst({
    where: { id: params.platformId, companyId, isActive: true },
  });
  if (!platform) return null;

  return {
    requireColors: platform.requireColors,
    requireStorage: platform.requireStorage,
    requireRam: platform.requireRam,
  };
}
