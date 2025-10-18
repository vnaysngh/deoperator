/**
 * Quick smoke test for CoinGecko-backed token discovery.
 *
 * Usage:
 *   COINGECKO_DEMO_API_KEY=... node scripts/test-token-profile.js APEX arbitrum-one
 *
 * The script searches CoinGecko for the provided symbol, loads coin details,
 * and prints the contract address for the requested platform, verifying that
 * the lookup flow used by the chat assistant returns the expected data.
 */

const API_BASE_URL = "https://api.coingecko.com/api/v3";

const PLATFORM_TO_CHAIN_ID = {
  ethereum: 1,
  "arbitrum-one": 42161,
  "binance-smart-chain": 56,
  // "polygon-pos": 137,
  base: 8453
};

const apiKey =
  process.env.COINGECKO_DEMO_API_KEY ||
  process.env.COINGECKO_API_KEY ||
  process.env.NEXT_PUBLIC_COINGECKO_API_KEY;

if (!apiKey) {
  console.error(
    "❌ Missing CoinGecko API key. Set COINGECKO_DEMO_API_KEY before running this script."
  );
  process.exit(1);
}

async function fetchFromCoinGecko(path, params) {
  const url = new URL(`${API_BASE_URL}/${path.replace(/^\//, "")}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-cg-demo-api-key": apiKey
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `CoinGecko request failed: ${response.status} ${response.statusText} – ${text}`
    );
  }

  return response.json();
}

async function searchCoin(symbol) {
  const data = await fetchFromCoinGecko("search", { query: symbol });
  if (!data.coins) {
    return [];
  }

  const upperSymbol = symbol.toUpperCase();
  return data.coins.filter(
    (coin) => (coin.symbol || "").toUpperCase() === upperSymbol
  );
}

async function getCoinDetails(coinId) {
  return fetchFromCoinGecko(`coins/${coinId}`);
}

async function main() {
  const symbol = process.argv[2] || "APEX";
  const platform = process.argv[3] || "arbitrum-one";

  console.log(`🔍 Searching CoinGecko for symbol "${symbol}"...`);
  const matches = await searchCoin(symbol);

  if (matches.length === 0) {
    console.error(`❌ No exact symbol match returned for "${symbol}".`);
    process.exit(1);
  }

  const selected = matches[0];
  console.log(
    `✅ Found ${selected.name} (id: ${selected.id}, rank: ${selected.market_cap_rank ?? "n/a"})`
  );

  console.log(`📄 Fetching detailed data for ${selected.id}...`);
  const details = await getCoinDetails(selected.id);

  const detailPlatforms = details.detail_platforms || {};
  const fallbackPlatforms = details.platforms || {};

  const detail = detailPlatforms[platform];
  const address =
    (detail && detail.contract_address) || fallbackPlatforms[platform];

  if (!address) {
    console.error(
      `❌ CoinGecko did not provide a contract for platform "${platform}". Available platforms: ${[
        ...Object.keys(detailPlatforms),
        ...Object.keys(fallbackPlatforms)
      ].join(", ") || "none"}`
    );
    process.exit(1);
  }

  const decimals =
    typeof detail?.decimal_place === "number" ? detail.decimal_place : "unknown";

  const chainId = PLATFORM_TO_CHAIN_ID[platform];

  console.log("\n🎯 Token Profile");
  console.log("----------------------------");
  console.log(`Name:       ${details.name}`);
  console.log(`Symbol:     ${details.symbol?.toUpperCase() || symbol}`);
  console.log(`Platform:   ${platform}`);
  if (chainId) {
    console.log(`Chain ID:   ${chainId}`);
  }
  console.log(`Contract:   ${address}`);
  console.log(`Decimals:   ${decimals}`);

  const price = details.market_data?.current_price?.usd;
  if (typeof price === "number") {
    console.log(`Price USD:  $${price.toLocaleString("en-US", { maximumFractionDigits: 6 })}`);
  }

  const marketCap = details.market_data?.market_cap?.usd;
  if (typeof marketCap === "number") {
    console.log(
      `Market Cap: $${marketCap.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    );
  }

  console.log("\n✅ CoinGecko lookup flow succeeded.\n");
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
