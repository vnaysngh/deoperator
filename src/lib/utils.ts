import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CompactNumberOptions = {
  /**
   * Maximum fraction digits to show in the full value tooltip.
   * Defaults to 2.
   */
  fullDigits?: number;
};

export function formatCompactNumber(
  value: number,
  options: CompactNumberOptions = {}
): { short: string; full: string } {
  if (!Number.isFinite(value)) {
    return { short: "0", full: "0" };
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const units = [
    { value: 1e12, suffix: "T" },
    { value: 1e9, suffix: "B" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "K" }
  ] as const;

  for (const unit of units) {
    if (abs >= unit.value) {
      const normalized = abs / unit.value;
      let shortNumber: string;

      if (normalized >= 100) {
        shortNumber = Math.floor(normalized).toString();
      } else if (normalized >= 10) {
        shortNumber = (
          Math.floor(normalized * 10) / 10
        )
          .toFixed(1)
          .replace(/\.0$/, "");
      } else {
        shortNumber = (
          Math.floor(normalized * 100) / 100
        )
          .toFixed(2)
          .replace(/0+$/, "")
          .replace(/\.$/, "");
      }

      return {
        short: `${sign}${shortNumber}${unit.suffix}`,
        full: value.toLocaleString(undefined, {
          maximumFractionDigits: options.fullDigits ?? 2
        })
      };
    }
  }

  return {
    short: value.toLocaleString(undefined, {
      maximumFractionDigits:
        value >= 100 ? 0 : value >= 10 ? 1 : 2
    }),
    full: value.toLocaleString(undefined, {
      maximumFractionDigits: options.fullDigits ?? 2
    })
  };
}
