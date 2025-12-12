/**
 * GTE SDK Initialization
 *
 * This file provides a singleton instance of the GTE SDK for use throughout the application.
 * The SDK provides access to:
 * - Network configuration
 * - Market data (pairs, TVL, prices, volumes)
 * - Price quotes via Uniswap v2 router
 * - Transaction builders for approvals and swaps
 */

import { GteSdk } from "gte-typescript-sdk";

// Create a singleton instance
let sdkInstance: GteSdk | null = null;

/**
 * Custom fetch wrapper for browser that uses our CORS proxy
 */
function createProxiedFetch(): typeof fetch {
  const isBrowser = typeof window !== 'undefined';

  if (!isBrowser) {
    // Server-side: use standard fetch
    return globalThis.fetch.bind(globalThis);
  }

  // Browser-side: proxy through our Next.js API route
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // If it's a GTE API URL, proxy it through our API route
    if (url.includes('api-testnet.gte.xyz')) {
      // Extract path and query from the original URL
      const urlObj = new URL(url);
      const path = urlObj.pathname.replace('/v1', ''); // Remove /v1 prefix
      const query = urlObj.search;

      // Build proxy URL
      const proxyUrl = `/api/gte-proxy?path=${encodeURIComponent(path)}${query ? '&' + query.slice(1) : ''}`;

      return fetch(proxyUrl, init);
    }

    // For non-GTE URLs, use standard fetch
    return fetch(url, init);
  };
}

/**
 * Get or create the GTE SDK instance
 */
export function getGteSdk(): GteSdk {
  if (!sdkInstance) {
    const proxiedFetch = createProxiedFetch();

    sdkInstance = new GteSdk({
      restOptions: {
        fetchImpl: proxiedFetch
      }
    });
  }
  return sdkInstance;
}

/**
 * Reset the SDK instance (useful for testing)
 */
export function resetGteSdk(): void {
  sdkInstance = null;
}

// Export types for convenience
export type { GteSdk } from "gte-typescript-sdk";
