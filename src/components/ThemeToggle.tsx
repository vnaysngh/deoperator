"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-9 w-16 items-center rounded-full transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        theme === "light"
          ? "bg-primary-500/20 border border-primary-500/30"
          : "bg-white/10 border border-white/20"
      )}
      aria-label="Toggle theme"
    >
      <span
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform shadow-md",
          theme === "light"
            ? "translate-x-8 bg-primary-500"
            : "translate-x-1 bg-white/90"
        )}
      >
        {theme === "light" ? (
          <Sun className="h-4 w-4 text-white" />
        ) : (
          <Moon className="h-4 w-4 text-gray-900" />
        )}
      </span>
    </button>
  );
}
