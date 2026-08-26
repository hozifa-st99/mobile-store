"use client";

import { useEffect, useMemo, useState } from "react";

import { LogoDisplay } from "@/components/ui/LogoUpload";
import { apiJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface PhoneBrand {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
}

interface PhonePlatform {
  id: string;
  nameAr: string;
  logoUrl?: string | null;
  requiresBrand: boolean;
  brands: PhoneBrand[];
}

interface PhonePlatformBrandChipsProps {
  platformId: string;
  phoneBrandId: string;
  onPlatformChange: (platformId: string) => void;
  onPhoneBrandChange: (phoneBrandId: string) => void;
  className?: string;
}

export default function PhonePlatformBrandChips({
  platformId,
  phoneBrandId,
  onPlatformChange,
  onPhoneBrandChange,
  className,
}: PhonePlatformBrandChipsProps) {
  const [platforms, setPlatforms] = useState<PhonePlatform[]>([]);

  useEffect(() => {
    apiJson<{ platforms: PhonePlatform[] }>("/api/settings/phone-platforms").then(({ ok, data }) => {
      if (ok) setPlatforms(data.platforms || []);
    });
  }, []);

  const selectedPlatform = useMemo(
    () => platforms.find((platform) => platform.id === platformId),
    [platforms, platformId]
  );

  const platformBrands =
    selectedPlatform?.requiresBrand && selectedPlatform.brands.length > 0
      ? selectedPlatform.brands
      : [];

  if (platforms.length === 0) return null;

  const selectPlatform = (nextPlatformId: string) => {
    onPlatformChange(platformId === nextPlatformId ? "" : nextPlatformId);
  };

  return (
    <div className={cn("glass-card p-3 space-y-3 relative z-20", className)}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onPlatformChange("")}
          className={cn(
            "flex flex-col items-center justify-center gap-2 min-w-[88px] px-3 py-2.5 rounded-xl border transition-all shrink-0",
            !platformId
              ? "border-primary bg-primary/15 text-white"
              : "border-border bg-background-input/30 text-muted hover:text-white hover:border-primary/30"
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-background-input/50 text-lg">
            📱
          </span>
          <span className="text-xs font-medium">الكل</span>
        </button>
        {platforms.map((platform) => (
          <button
            key={platform.id}
            type="button"
            onClick={() => selectPlatform(platform.id)}
            className={cn(
              "flex flex-col items-center gap-2 min-w-[88px] px-3 py-2.5 rounded-xl border transition-all shrink-0",
              platformId === platform.id
                ? "border-primary bg-primary/15 text-white"
                : "border-border bg-background-input/30 text-muted hover:text-white hover:border-primary/30"
            )}
          >
            <LogoDisplay url={platform.logoUrl} name={platform.nameAr} size="sm" />
            <span className="text-xs font-medium truncate max-w-[80px]">{platform.nameAr}</span>
          </button>
        ))}
      </div>

      {platformId && platformBrands.length > 0 ? (
        <div className="border-t border-border/50 pt-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => onPhoneBrandChange("")}
              className={cn(
                "flex flex-col items-center justify-center gap-2 min-w-[88px] px-3 py-2.5 rounded-xl border transition-all shrink-0",
                !phoneBrandId
                  ? "border-primary bg-primary/15 text-white"
                  : "border-border bg-background-input/30 text-muted hover:text-white hover:border-primary/30"
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-background-input/50 text-lg">
                🏢
              </span>
              <span className="text-xs font-medium">كل الشركات</span>
            </button>
            {platformBrands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                onClick={() => onPhoneBrandChange(phoneBrandId === brand.id ? "" : brand.id)}
                className={cn(
                  "flex flex-col items-center gap-2 min-w-[88px] px-3 py-2.5 rounded-xl border transition-all shrink-0",
                  phoneBrandId === brand.id
                    ? "border-primary bg-primary/15 text-white"
                    : "border-border bg-background-input/30 text-muted hover:text-white hover:border-primary/30"
                )}
              >
                <LogoDisplay url={brand.logoUrl} name={brand.nameAr} size="sm" />
                <span className="text-xs font-medium truncate max-w-[80px]">{brand.nameAr}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
