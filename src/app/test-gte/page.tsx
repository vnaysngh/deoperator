"use client";

import { useState, useEffect } from "react";
import { getGteSdk } from "@/lib/gte-sdk";

export default function TestGtePage() {
  const [config, setConfig] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize SDK and fetch data
  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        setError(null);
        const sdk = getGteSdk();

        // Get chain configuration
        console.log("[GTE SDK] Getting chain config...");
        const chainConfig = sdk.getChainConfig();
        console.log("[GTE SDK] Chain config:", chainConfig);
        setConfig(chainConfig);

        // Fetch available markets
        console.log("[GTE SDK] Fetching markets...");
        const marketData = await sdk.getMarkets({
          marketType: "amm",
          limit: 30
        });
        console.log("[GTE SDK] Markets fetched:", marketData);

        // Sort markets by TVL (highest first)
        const sortedMarkets = [...marketData].sort((a, b) => {
          const tvlA = Number(a.tvlUsd) || 0;
          const tvlB = Number(b.tvlUsd) || 0;
          return tvlB - tvlA;
        });
        console.log("[GTE SDK] Markets sorted by TVL");

        setMarkets(sortedMarkets);

        // Get a quote for the first market if available
        if (marketData && marketData.length > 0) {
          const [firstMarket] = marketData;
          console.log(
            "[GTE SDK] Getting quote for first market...",
            firstMarket
          );
          const quoteData = await sdk.getQuote({
            tokenIn: firstMarket.baseToken,
            tokenOut: firstMarket.quoteToken,
            amountIn: "0.25"
          });
          console.log("[GTE SDK] Quote fetched:", quoteData);
          setQuote(quoteData);
        } else {
          console.log("[GTE SDK] No markets available for quote");
        }
      } catch (err) {
        console.error("[GTE SDK] Error:", err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        setError(
          `${errorMessage}${errorStack ? "\n\nStack: " + errorStack : ""}`
        );
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">
            <span className="gradient-text">GTE SDK Test Page</span>
          </h1>
          <p className="text-gray-400 text-sm">
            Testing gte-typescript-sdk from GitHub
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="glass p-4 rounded-lg mb-6 border border-emerald-500/30">
            <p className="text-emerald-400">⏳ Loading SDK data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="glass p-4 rounded-lg mb-6 border border-red-500/30">
            <p className="text-red-400 font-semibold mb-2">❌ Error:</p>
            <pre className="text-xs text-red-300 whitespace-pre-wrap overflow-auto max-h-40">
              {error}
            </pre>
          </div>
        )}

        {/* Chain Configuration */}
        <div className="glass-strong rounded-lg p-6 mb-6 shadow-glow">
          <h2 className="text-xl font-semibold mb-4 text-white">
            ⛓️ Chain Configuration
          </h2>
          {config ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Network:</span>{" "}
                  <span className="text-emerald-400">{config.name}</span>
                </div>
                <div>
                  <span className="text-gray-400">Chain ID:</span>{" "}
                  <span className="text-white">{config.id}</span>
                </div>
                <div>
                  <span className="text-gray-400">Native Token:</span>{" "}
                  <span className="text-white">{config.nativeSymbol}</span>
                </div>
                <div>
                  <span className="text-gray-400">Explorer:</span>{" "}
                  <a
                    href={config.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline"
                  >
                    {config.explorerUrl.replace("https://", "")}
                  </a>
                </div>
              </div>
              <details className="mt-4">
                <summary className="text-gray-400 text-sm cursor-pointer hover:text-white">
                  Show full config
                </summary>
                <pre className="bg-black/40 p-4 rounded mt-2 overflow-auto text-xs text-gray-300 border border-white/10">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <p className="text-gray-500">Loading configuration...</p>
          )}
        </div>

        {/* Markets */}
        <div className="glass-strong rounded-lg p-6 mb-6 shadow-glow">
          <h2 className="text-xl font-semibold mb-4 text-white">
            📊 Markets (Sorted by TVL)
          </h2>
          {!loading && markets.length > 0 ? (
            <div className="space-y-3">
              {markets.map((market, index) => (
                <div
                  key={index}
                  className="glass rounded-lg p-4 border border-white/10 hover:border-emerald-500/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-semibold">
                        {market.baseToken?.symbol || "???"}
                      </span>
                      <span className="text-gray-500">/</span>
                      <span className="text-white">
                        {market.quoteToken?.symbol || "???"}
                      </span>
                    </div>
                    <span className="badge-green">
                      $
                      {typeof market.priceUsd === "number" &&
                      market.priceUsd < 0.01
                        ? market.priceUsd.toExponential(2)
                        : market.priceUsd?.toFixed(4) || "N/A"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-400">Address:</span>{" "}
                      <span className="text-gray-300 font-mono">
                        {market.address.slice(0, 10)}...
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">TVL:</span>{" "}
                      <span className="text-white">
                        ${market.tvlUsd?.toLocaleString() || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : !loading && markets.length === 0 && !error ? (
            <p className="text-gray-500">No markets found.</p>
          ) : loading ? (
            <p className="text-gray-500">Loading markets...</p>
          ) : null}
        </div>

        {/* Quote */}
        <div className="glass-strong rounded-lg p-6 mb-6 shadow-glow">
          <h2 className="text-xl font-semibold mb-4 text-white">
            💱 Sample Quote (0.25 tokens)
          </h2>
          {quote ? (
            <div className="space-y-3">
              <div className="glass rounded-lg p-4 border border-emerald-500/20">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Amount In:</span>{" "}
                    <span className="text-emerald-400">{quote.amountIn}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Expected Out:</span>{" "}
                    <span className="text-white">
                      {quote.expectedAmountOut}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Min Out (slippage):</span>{" "}
                    <span className="text-gray-300">{quote.minAmountOut}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Price:</span>{" "}
                    <span className="text-white">{quote.price}</span>
                  </div>
                </div>
              </div>
              <details>
                <summary className="text-gray-400 text-sm cursor-pointer hover:text-white">
                  Show full quote
                </summary>
                <pre className="bg-black/40 p-4 rounded mt-2 overflow-auto text-xs text-gray-300 border border-white/10">
                  {JSON.stringify(
                    quote,
                    (key, value) =>
                      typeof value === "bigint" ? value.toString() : value,
                    2
                  )}
                </pre>
              </details>
            </div>
          ) : markets.length > 0 && !loading && !error ? (
            <p className="text-gray-500">
              No quote available (check console for errors)
            </p>
          ) : !loading && !error && markets.length === 0 ? (
            <p className="text-gray-500">No markets available for quote</p>
          ) : loading ? (
            <p className="text-gray-500">Loading quote...</p>
          ) : null}
        </div>

        {/* Success Message */}
        {!loading && !error && markets.length > 0 && (
          <div className="glass-strong rounded-lg p-6 border border-emerald-500/30 shadow-glow-lg">
            <h2 className="text-lg font-semibold mb-3 text-emerald-400">
              ✅ SDK Initialized Successfully!
            </h2>
            <p className="text-gray-300 mb-3 text-sm">
              The GTE SDK is now ready to use in your application. Import it
              from:
            </p>
            <code className="block glass p-3 rounded text-emerald-400 text-sm font-mono mb-3">
              import {`{ getGteSdk }`} from &quot;@/lib/gte-sdk&quot;
            </code>
            <p className="text-xs text-gray-400">
              This page demonstrates fetching chain config, markets, and quotes.
              Check the code at{" "}
              <code className="text-gray-300">src/app/test-gte/page.tsx</code>{" "}
              for examples.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
