import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side CDN header proxy.
 *
 * Browser JS can't read CDN infrastructure headers (Age, X-Cache,
 * Surrogate-Key) from same-origin fetches because they're stripped
 * or inaccessible. This endpoint fetches from the app's own public
 * CDN URL server-side and returns the body + headers as JSON.
 *
 * GET /api/cdn-proxy?path=/api/cdnprobe
 */

const NO_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path');

  if (!path || !path.startsWith('/')) {
    return NextResponse.json(
      { error: 'path query parameter is required and must start with /' },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }

  // Determine the public URL to fetch from
  let baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host');
    if (host) {
      baseUrl = `${proto}://${host}`;
    } else {
      return NextResponse.json(
        { error: 'Cannot determine public URL. Set NEXT_PUBLIC_SITE_URL or ensure Host header is present.' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }
  }

  // Strip trailing slash from baseUrl
  baseUrl = baseUrl.replace(/\/+$/, '');
  const targetUrl = `${baseUrl}${path}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(targetUrl, {
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let body: any;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    // Extract CDN-relevant headers
    const headersToCapture = [
      'age',
      'x-cache',
      'x-cache-hits',
      'surrogate-key',
      'cache-control',
      'x-served-by',
      'x-timer',
      'via',
      'content-type',
      'date',
    ];

    const capturedHeaders: Record<string, string | null> = {};
    for (const name of headersToCapture) {
      capturedHeaders[name] = response.headers.get(name);
    }

    return NextResponse.json(
      {
        body,
        headers: capturedHeaders,
        status: response.status,
        fetched_at: new Date().toISOString(),
        target_url: targetUrl,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: `Failed to fetch ${targetUrl}: ${message}` },
      { status: 502, headers: NO_CACHE_HEADERS }
    );
  }
}
