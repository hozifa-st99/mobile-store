"use client";

import OptionTagsInput, { type OptionTagsInputHandle } from "@/components/ui/OptionTagsInput";
import type { ModelSpecRequirements } from "@/lib/phone-model-requirements";
import type { RefObject } from "react";

interface ModelSpecFieldsProps {
  requirements: ModelSpecRequirements;
  formColors: string[];
  formStorage: string[];
  formRam: string[];
  onColorsChange: (v: string[]) => void;
  onStorageChange: (v: string[]) => void;
  onRamChange: (v: string[]) => void;
  colorsRef: RefObject<OptionTagsInputHandle>;
  storageRef: RefObject<OptionTagsInputHandle>;
  ramRef: RefObject<OptionTagsInputHandle>;
  colorSuggestions: string[];
  storageSuggestions: string[];
  ramSuggestions: string[];
}

export default function ModelSpecFields({
  requirements,
  formColors,
  formStorage,
  formRam,
  onColorsChange,
  onStorageChange,
  onRamChange,
  colorsRef,
  storageRef,
  ramRef,
  colorSuggestions,
  storageSuggestions,
  ramSuggestions,
}: ModelSpecFieldsProps) {
  const hasAny = requirements.requireColors || requirements.requireStorage || requirements.requireRam;

  if (!hasAny) {
    return (
      <p className="text-xs text-muted rounded-xl border border-border/50 bg-background-input/30 p-3">
        هذه الشركة لا تفرض حقول مواصفات — يمكنك حفظ اسم الموديل فقط.
      </p>
    );
  }

  return (
    <>
      {requirements.requireColors && (
        <OptionTagsInput
          ref={colorsRef}
          label="الألوان المتاحة *"
          value={formColors}
          onChange={onColorsChange}
          placeholder="اكتب اللون واضغط Enter"
          suggestions={colorSuggestions}
        />
      )}
      {requirements.requireStorage && (
        <OptionTagsInput
          ref={storageRef}
          label="الذاكرة الداخلية *"
          value={formStorage}
          onChange={onStorageChange}
          placeholder="مثال: 256GB"
          suggestions={storageSuggestions}
        />
      )}
      {requirements.requireRam && (
        <OptionTagsInput
          ref={ramRef}
          label="الرام *"
          value={formRam}
          onChange={onRamChange}
          placeholder="مثال: 8GB"
          suggestions={ramSuggestions}
        />
      )}
    </>
  );
}
