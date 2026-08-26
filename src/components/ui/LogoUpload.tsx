"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { toast } from "@/lib/toast";


interface LogoUploadProps {
  name: string;
  value?: string | null;
  onChange: (url: string) => void;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showLabel?: boolean;
}

const sizes = {
  sm: { box: "w-12 h-12", icon: "w-5 h-5", text: "text-[10px]" },
  md: { box: "w-20 h-20", icon: "w-6 h-6", text: "text-xs" },
  lg: { box: "w-28 h-28", icon: "w-8 h-8", text: "text-sm" },
  xl: { box: "w-36 h-36", icon: "w-10 h-10", text: "text-sm" },
};

export default function LogoUpload({
  name,
  value,
  onChange,
  size = "md",
  className,
  showLabel = true,
}: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [displayUrl, setDisplayUrl] = useState<string | null>(value ?? null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (value) setDisplayUrl(value);
  }, [value]);

  const upload = async (file: File) => {
    const blob = URL.createObjectURL(file);
    setDisplayUrl(blob);
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/upload/logo", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "فشل رفع الصورة");

      URL.revokeObjectURL(blob);
      setDisplayUrl(data.url);
      onChange(data.url);
    } catch (e) {
      URL.revokeObjectURL(blob);
      setDisplayUrl(value ?? null);
      toast.error(e instanceof Error ? e.message : "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  };

  const s = sizes[size];

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative group rounded-2xl overflow-hidden border-2 border-dashed transition-all",
          displayUrl
            ? "border-primary/20 bg-background-input"
            : "border-primary/40 bg-background-input hover:border-primary hover:bg-primary/5",
          s.box
        )}
      >
        {displayUrl ? (
          <>
            <img
              src={displayUrl}
              alt={name}
              className="w-full h-full object-contain p-2"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {uploading ? (
                <span className="w-6 h-6 text-white animate-spin inline-flex items-center justify-center text-lg leading-none" title="Loader2">⏳</span>
              ) : (
                <span className="w-6 h-6 text-white inline-flex items-center justify-center text-lg leading-none" title="ImagePlus">🖼️</span>
              )}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted">
            {uploading ? (
              <span className=" inline-flex items-center justify-center text-lg leading-none" title="Loader2">⏳</span>
            ) : (
              <>
                <span className=" inline-flex items-center justify-center text-lg leading-none" title="ImagePlus">🖼️</span>
                {showLabel && size !== "sm" && (
                  <span className={cn(s.text, "text-muted-dark px-1 text-center leading-tight")}>
                    اختر صورة
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFile}
      />

    </div>
  );
}

/** عرض فقط بدون رفع */
export function LogoDisplay({
  url,
  name,
  size = "sm",
  className,
}: {
  url?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "product";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = {
    xs: "w-9 h-9",
    sm: "w-11 h-11",
    md: "w-14 h-14",
    lg: "w-16 h-16",
    product: "w-[58px] h-[80px]",
  }[size];
  const radius = size === "product" ? "rounded-2xl" : "rounded-xl";
  const imgPad = size === "product" ? "p-0.5" : "p-1";

  useEffect(() => setFailed(false), [url]);

  if (!url || failed) {
    return (
      <div
        className={cn(
          box,
          radius,
          "bg-[#1a1f2e] border border-white/[0.06] flex items-center justify-center flex-shrink-0",
          className
        )}
      >
        <span className="text-xs font-bold text-muted">{name.charAt(0)}</span>
      </div>
    );
  }

  return (
    <div className={cn(box, radius, "bg-[#1a1f2e] overflow-hidden flex-shrink-0 border border-white/[0.08]", className)}>
      <img
        src={url}
        alt={name}
        className={cn("w-full h-full object-contain", imgPad)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
