"use client";

import { forwardRef, useImperativeHandle, useState } from "react";

export interface OptionTagsInputHandle {
  flush: () => string[];
}

interface OptionTagsInputProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}

const OptionTagsInput = forwardRef<OptionTagsInputHandle, OptionTagsInputProps>(
  function OptionTagsInput(
    { label, value, onChange, placeholder, suggestions = [] },
    ref
  ) {
    const [input, setInput] = useState("");

    const addValue = (raw: string, current: string[] = value) => {
      const next = raw.trim();
      if (!next || current.includes(next)) return current;
      const updated = [...current, next];
      onChange(updated);
      setInput("");
      return updated;
    };

    useImperativeHandle(
      ref,
      () => ({
        flush: () => {
          const pending = input.trim();
          if (!pending) return value;
          if (value.includes(pending)) {
            setInput("");
            return value;
          }
          const updated = [...value, pending];
          onChange(updated);
          setInput("");
          return updated;
        },
      }),
      [input, value, onChange]
    );

    return (
      <div>
        <label className="block text-xs font-semibold text-muted mb-2">{label}</label>
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {value.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-sm font-semibold text-white"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== tag))}
                  className="text-muted hover:text-red-300 leading-none"
                  aria-label={`حذف ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addValue(input);
            }
          }}
          className="glass-input"
          placeholder={placeholder}
        />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestions
              .filter((s) => !value.includes(s))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addValue(s)}
                  className="text-xs px-2 py-1 rounded-lg border border-border text-muted hover:text-white hover:border-primary/30 transition-colors"
                >
                  + {s}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  }
);

export default OptionTagsInput;
