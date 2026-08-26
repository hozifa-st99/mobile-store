import type { Prisma } from "@prisma/client";

import { getModelOptionLists, normalizeOptionList } from "@/lib/phone-model-options";

export const phoneModelSpecsInclude = {
  colors: { where: { isActive: true }, orderBy: { sortOrder: "asc" as const } },
  storages: { where: { isActive: true }, orderBy: { sortOrder: "asc" as const } },
  rams: { where: { isActive: true }, orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.PhoneModelInclude;

export type PhoneModelWithSpecs = Prisma.PhoneModelGetPayload<{
  include: typeof phoneModelSpecsInclude;
}>;

type SpecClient = {
  phoneModelColor: {
    deleteMany: (args: { where: { modelId: string } }) => Promise<unknown>;
    createMany: (args: {
      data: { modelId: string; nameAr: string; sortOrder: number }[];
    }) => Promise<unknown>;
  };
  phoneModelStorage: {
    deleteMany: (args: { where: { modelId: string } }) => Promise<unknown>;
    createMany: (args: {
      data: { modelId: string; nameAr: string; sortOrder: number }[];
    }) => Promise<unknown>;
  };
  phoneModelRam: {
    deleteMany: (args: { where: { modelId: string } }) => Promise<unknown>;
    createMany: (args: {
      data: { modelId: string; nameAr: string; sortOrder: number }[];
    }) => Promise<unknown>;
  };
};

export interface ModelSpecInput {
  colors: string[];
  storageOptions: string[];
  ramOptions: string[];
}

export async function syncModelSpecs(
  client: SpecClient,
  modelId: string,
  specs: ModelSpecInput
) {
  const colors = normalizeOptionList(specs.colors);
  const storageOptions = normalizeOptionList(specs.storageOptions);
  const ramOptions = normalizeOptionList(specs.ramOptions);

  await client.phoneModelColor.deleteMany({ where: { modelId } });
  await client.phoneModelStorage.deleteMany({ where: { modelId } });
  await client.phoneModelRam.deleteMany({ where: { modelId } });

  if (colors.length > 0) {
    await client.phoneModelColor.createMany({
      data: colors.map((nameAr, sortOrder) => ({ modelId, nameAr, sortOrder })),
    });
  }

  if (storageOptions.length > 0) {
    await client.phoneModelStorage.createMany({
      data: storageOptions.map((nameAr, sortOrder) => ({ modelId, nameAr, sortOrder })),
    });
  }

  if (ramOptions.length > 0) {
    await client.phoneModelRam.createMany({
      data: ramOptions.map((nameAr, sortOrder) => ({ modelId, nameAr, sortOrder })),
    });
  }
}

/** API shape: relations + flat string arrays for existing UI */
export function serializePhoneModel<T extends Record<string, unknown>>(model: T) {
  const lists = getModelOptionLists(model);
  return {
    ...model,
    colors: lists.colors,
    storageOptions: lists.storageOptions,
    ramOptions: lists.ramOptions,
  };
}

export function serializePlatforms<T extends { brands?: { models?: unknown[] }[]; models?: unknown[] }>(
  platforms: T[]
) {
  return platforms.map((platform) => ({
    ...platform,
    brands: platform.brands?.map((brand) => ({
      ...brand,
      models: (brand.models || []).map((model) => serializePhoneModel(model as Record<string, unknown>)),
    })),
    models: (platform.models || []).map((model) =>
      serializePhoneModel(model as Record<string, unknown>)
    ),
  }));
}
