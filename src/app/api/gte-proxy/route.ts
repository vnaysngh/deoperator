import { NextRequest, NextResponse } from 'next/server';

/**
 * GTE API Proxy
 *
 * This endpoint proxies requests to the GTE API to bypass CORS restrictions.
 * The GTE API doesn't set proper CORS headers for browser requests,
 * so we proxy through Next.js which runs server-side.
 */

const GTE_API_BASE = 'https://api-testnet.gte.xyz/v1';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '/markets';

    // Build query params (excluding 'path')
    const queryParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (key !== 'path') {
        queryParams.append(key, value);
      }
    });

    const queryString = queryParams.toString();
    const url = `${GTE_API_BASE}${path}${queryString ? `?${queryString}` : ''}`;

    console.log('[GTE Proxy] Fetching:', url);

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GTE Proxy] Error:', response.status, errorText);
      return NextResponse.json(
        { error: `GTE API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('[GTE Proxy] Error:', error);
    return NextResponse.json(
      {
        error: 'Proxy error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
