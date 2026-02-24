import { NextRequest, NextResponse } from 'next/server';
import { cacheTag } from 'next/cache';
import { connection } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * CDN cache validation endpoint for E2E tests.
 *
 * GET /cdnprobe
 *
 * Returns a JSON response with a unique generation timestamp and nonce.
 * Uses 'use cache: remote' with cacheTag('cdnprobe') so the cache handler
 * tracks this entry and can clear it via revalidatePath/revalidateTag.
 *
 * Test pattern:
 *   1. Request → cache handler stores entry, CDN caches response
 *   2. Wait for CDN Age > 0
 *   3. revalidatePath('/cdnprobe') or revalidateTag('cdnprobe')
 *      → cache handler invalidates entry → edge cache cleared
 *   4. Request again → origin generates new timestamp
 *   5. Assert new timestamp !== old timestamp → purge worked
 */

async function generateProbeData() {
  'use cache: remote';
  cacheTag('cdnprobe');

  const now = new Date();

  return {
    generated_at: now.toISOString(),
    nonce: randomUUID(),
    purpose: 'CDN cache validation — each origin request produces a unique response',
  };
}

export async function GET(_request: NextRequest) {
  // Defer to request time to ensure runtime caching
  await connection();

  const data = await generateProbeData();

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=0',
    },
  });
}
