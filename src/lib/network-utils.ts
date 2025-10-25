/**
 * Network utility functions for displaying network information
 */

// Network colors for gradients and badges
export const getNetworkColors = (networkName: string) => {
  const colorMap: Record<string, { gradient: string; bg: string; text: string }> = {
    ETHEREUM: {
      gradient: "from-blue-400 to-blue-600",
      bg: "bg-blue-500/10",
      text: "text-blue-400",
    },
    POLYGON: {
      gradient: "from-purple-400 to-purple-600",
      bg: "bg-purple-500/10",
      text: "text-purple-400",
    },
    OPTIMISM: {
      gradient: "from-red-400 to-red-600",
      bg: "bg-red-500/10",
      text: "text-red-400",
    },
    ARBITRUM: {
      gradient: "from-blue-300 to-cyan-500",
      bg: "bg-cyan-500/10",
      text: "text-cyan-400",
    },
    BASE: {
      gradient: "from-blue-500 to-indigo-600",
      bg: "bg-indigo-500/10",
      text: "text-indigo-400",
    },
    AVALANCHE: {
      gradient: "from-red-500 to-orange-600",
      bg: "bg-red-500/10",
      text: "text-red-400",
    },
    "BINANCE SMART CHAIN": {
      gradient: "from-yellow-400 to-yellow-600",
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
    },
    FANTOM: {
      gradient: "from-blue-400 to-cyan-500",
      bg: "bg-cyan-500/10",
      text: "text-cyan-400",
    },
    GNOSIS: {
      gradient: "from-teal-400 to-emerald-600",
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
    },
    ZKSYNC: {
      gradient: "from-violet-400 to-purple-600",
      bg: "bg-purple-500/10",
      text: "text-purple-400",
    },
    LINEA: {
      gradient: "from-black to-gray-700",
      bg: "bg-gray-700/10",
      text: "text-gray-300",
    },
    SCROLL: {
      gradient: "from-orange-400 to-amber-600",
      bg: "bg-orange-500/10",
      text: "text-orange-400",
    },
    MANTLE: {
      gradient: "from-black to-gray-800",
      bg: "bg-gray-800/10",
      text: "text-gray-400",
    },
    BLAST: {
      gradient: "from-yellow-300 to-amber-500",
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
    },
    MODE: {
      gradient: "from-lime-400 to-green-600",
      bg: "bg-lime-500/10",
      text: "text-lime-400",
    },
    ZORA: {
      gradient: "from-black to-white",
      bg: "bg-white/5",
      text: "text-white",
    },
  };

  const key = networkName.toUpperCase().replace(" MAINNET", "");
  return (
    colorMap[key] || {
      gradient: "from-gray-400 to-gray-600",
      bg: "bg-gray-500/10",
      text: "text-gray-400",
    }
  );
};

// Get network icon/emoji
export const getNetworkIcon = (networkName: string): string => {
  const iconMap: Record<string, string> = {
    ETHEREUM: "Ξ",
    POLYGON: "⬡",
    OPTIMISM: "🔴",
    ARBITRUM: "🔵",
    BASE: "🔷",
    AVALANCHE: "🔺",
    "BINANCE SMART CHAIN": "💛",
    FANTOM: "👻",
    GNOSIS: "🦉",
    ZKSYNC: "⚡",
    LINEA: "📐",
    SCROLL: "📜",
    MANTLE: "🧬",
    BLAST: "💥",
    MODE: "🟢",
    ZORA: "⚫",
  };

  const key = networkName.toUpperCase().replace(" MAINNET", "");
  return iconMap[key] || "🔗";
};

// Format network name for display
export const formatNetworkName = (networkName: string): string => {
  return networkName
    .replace(" MAINNET", "")
    .split(" ")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
};
