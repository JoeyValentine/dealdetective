"use client";

import { TrendingUp, Clock, Grid3X3, DollarSign } from "lucide-react";
import { DashboardStats } from "@/types/deal";

interface StatsBarProps {
  stats: DashboardStats;
}

export default function StatsBar({ stats }: StatsBarProps) {
  const items = [
    {
      icon: TrendingUp,
      label: "Active Deals",
      value: stats.totalActive,
      iconBg: "bg-amber-50 dark:bg-amber-900/30",
      iconColor: "text-amber-500",
      valueColor: "text-amber-500",
    },
    {
      icon: Clock,
      label: "Expiring Soon",
      value: stats.expiringToday,
      iconBg: "bg-red-50 dark:bg-red-900/30",
      iconColor: "text-red-400",
      valueColor: "text-red-500",
    },
    {
      icon: Grid3X3,
      label: "Categories",
      value: stats.categoriesCount,
      iconBg: "bg-blue-50 dark:bg-blue-900/30",
      iconColor: "text-blue-400",
      valueColor: "text-blue-500",
    },
    {
      icon: DollarSign,
      label: "Est. Savings",
      value: `$${stats.estimatedSavings.toLocaleString()}`,
      iconBg: "bg-emerald-50 dark:bg-emerald-900/30",
      iconColor: "text-emerald-500",
      valueColor: "text-emerald-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ icon: Icon, label, value, iconBg, iconColor, valueColor }) => (
        <div
          key={label}
          className="bg-[var(--card)] rounded-[20px] p-4 flex items-center gap-3"
          style={{ boxShadow: "var(--shadow-stats)" }}
        >
          <div className={`p-2.5 rounded-2xl ${iconBg}`}>
            <Icon size={16} className={iconColor} />
          </div>
          <div>
            <p className="text-[var(--text-3)] text-xs leading-none mb-1.5 font-medium">{label}</p>
            <p className={`font-semibold text-lg leading-none ${valueColor}`}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
