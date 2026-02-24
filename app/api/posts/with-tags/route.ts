import { NextRequest, NextResponse } from 'next/server';
import { fetchPostsWithTagsNext15 } from '../../../../lib/blogService';

// Combined approach: Tests BOTH cache layers with the same tags
// - Tags on fetch() via next.tags → tests cacheHandler (singular)
// - Tags on function via cacheTag() → tests cacheHandlers (plural)
//
// This ensures revalidateTag('api-posts') invalidates caches at ALL levels.
// For pure Next.js 16 approach (cacheTag only), see /api/cache-components/tagged

export async function GET(_request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[API] /api/posts/with-tags - Using combined fetch + cacheTag approach...');

    // Uses both fetch next.tags AND cacheTag for comprehensive cache invalidation
    const { posts, cachedAt } = await fetchPostsWithTagsNext15();
    const duration = Date.now() - startTime;

    console.log(`[API] /api/posts/with-tags - Completed in ${duration}ms, cached at ${cachedAt}`);

    return NextResponse.json({
      data: posts,
      cache_strategy: 'combined-fetch-and-cacheTag',
      duration_ms: duration,
      fetched_at: cachedAt, // Timestamp from when data was fetched
      tags: ['api-posts', 'external-data'],
      description: 'Combined: fetch(next.tags) + cacheTag() for comprehensive tag invalidation'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=60',
      }
    });

  } catch (error) {
    console.error('[API] /api/posts/with-tags - Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        cache_strategy: 'tags-revalidate-5m',
        duration_ms: Date.now() - startTime,
        fetched_at: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
