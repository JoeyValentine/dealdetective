"use client";

import { Category } from "@/types/deal";

export const ALL_CATEGORIES: (Category | "All")[] = [
  "All",
  "Beauty & Cosmetics",
  "Clothing & Apparel",
  "Tech & Electronics",
  "Grocery & Food",
  "Fast Food & Restaurants",
  "Health & Wellness",
  "Home & General Retail",
  "Subscriptions & SaaS",
  "Travel & Dining",
  "Other / Uncategorized",
];

const CATEGORY_EMOJI: Record<string, string> = {
  "All": "✦",
  "Beauty & Cosmetics": "✿",
  "Clothing & Apparel": "◎",
  "Tech & Electronics": "⟡",
  "Grocery & Food": "◇",
  "Fast Food & Restaurants": "◉",
  "Health & Wellness": "◌",
  "Home & General Retail": "□",
  "Subscriptions & SaaS": "▷",
  "Travel & Dining": "◁",
  "Other / Uncategorized": "○",
};

interface CategoryTabsProps {
  active: Category | "All";
  onChange: (cat: Category | "All") => void;
  counts?: Partial<Record<Category | "All", number>>;
}

export default function CategoryTabs({ active, onChange, counts }: CategoryTabsProps) {
  // Only show categories that have at least one deal; always show "All"
  const visibleCategories = ALL_CATEGORIES.filter(
    (cat) => cat === "All" || (counts?.[cat] ?? 0) > 0
  );

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {visibleCategories.map((cat) => {
        const count = counts?.[cat];
        const isActive = cat === active;
        return (
          <button
            key={cat}
            onClick={() => onChange(cat)}
            className={`
              flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200
              ${isActive
                ? "bg-amber-500 text-white shadow-[0_2px_10px_rgba(245,158,11,0.35)]"
                : "bg-white text-[#6C6C70] shadow-[0_1px_4px_rgba(0,0,0,0.07)] hover:text-[#1C1C1E] hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)]"
              }
            `}
          >
            <span className={`text-xs ${isActive ? "opacity-80" : "opacity-50"}`}>
              {CATEGORY_EMOJI[cat]}
            </span>
            {cat === "All" ? "All Deals" : cat.split(" & ")[0]}
            {count !== undefined && (
              <span
                className={`text-xs rounded-full px-1.5 leading-none py-0.5 ${
                  isActive ? "bg-white/20 text-white" : "bg-[#F2F2F7] text-[#AEAEB2]"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
