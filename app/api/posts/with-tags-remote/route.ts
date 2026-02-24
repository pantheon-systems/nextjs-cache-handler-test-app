import { NextRequest, NextResponse } from 'next/server';
import { cacheTag, cacheLife } from 'next/cache';
import { connection } from 'next/server';

// Cached function using 'use cache: remote' for RUNTIME caching
async function fetchPostsRemote() {
  'use cache: remote';
  cacheTag('api-posts-remote', 'external-data-remote');
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  console.log('[RemoteCache] Fetching posts with remote cache...');

  // Simulate data fetch
  const posts = [
    { id: 1, title: 'Remote Cached Post 1', body: 'Content from remote cache' },
    { id: 2, title: 'Remote Cached Post 2', body: 'More remote cached content' },
    { id: 3, title: 'Remote Cached Post 3', body: 'Even more content' },
  ];

  const cachedAt = new Date().toISOString();
  console.log(`[RemoteCache] Cached at ${cachedAt}`);

  return { posts, cachedAt };
}

export async function GET(_request: NextRequest) {
  const startTime = Date.now();

  try {
    // Defer to request time to ensure runtime caching
    await connection();

    console.log('[API] /api/posts/with-tags-remote - Using remote cache...');

    const { posts, cachedAt } = await fetchPostsRemote();
    const duration = Date.now() - startTime;

    console.log(`[API] /api/posts/with-tags-remote - Completed in ${duration}ms`);

    return NextResponse.json({
      data: posts,
      cache_strategy: 'use-cache-remote',
      duration_ms: duration,
      fetched_at: cachedAt,
      tags: ['api-posts-remote', 'external-data-remote'],
      description: 'Runtime caching with use cache: remote'
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=60',
      }
    });

  } catch (error) {
    console.error('[API] /api/posts/with-tags-remote - Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        cache_strategy: 'use-cache-remote',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
