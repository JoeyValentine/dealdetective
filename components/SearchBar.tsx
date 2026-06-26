"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

interface SearchBarProps {
  defaultValue?: string;
  onSearch?: (q: string) => void;
  placeholder?: string;
}

export default function SearchBar({ defaultValue = "", onSearch, placeholder }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    if (onSearch) {
      onSearch(value.trim());
    } else {
      router.push(`/search?q=${encodeURIComponent(value.trim())}`);
    }
  }

  function clear() {
    setValue("");
    if (onSearch) onSearch("");
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative flex items-center">
        <Search size={15} className="absolute left-4 text-[var(--text-3)] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? "Search brands, categories, promo codes…"}
          className="w-full bg-[var(--card)] rounded-2xl pl-10 pr-10 py-3 text-[var(--text-1)] text-sm placeholder:text-[var(--text-3)] border border-[var(--border)] shadow-[0_2px_10px_rgba(0,0,0,0.06)] focus:outline-none focus:border-amber-400/50 focus:shadow-[0_2px_16px_rgba(245,158,11,0.12)] transition-all duration-200"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-10 text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
          >
            <X size={14} />
          </button>
        )}
        <button
          type="submit"
          className="absolute right-3 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-500 rounded-xl p-1.5 transition-all"
        >
          <Search size={12} />
        </button>
      </div>
    </form>
  );
}
