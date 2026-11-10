# Next.js Cache Handler Test App

This is the E2E test application for validating [`@pantheon-systems/nextjs-cache-handler`](https://github.com/pantheon-systems/nextjs-cache-handler) behavior in production environments.

## Purpose

This application is deployed to Pantheon and used by automated E2E tests to validate:
- Fetch caching strategies (`no-store`, `force-cache`, `revalidate`, `next.tags`)
- Page caching (SSG, SSR, ISR)
- Tag-based cache invalidation
- Cache persistence across deployments
- ISR timing validation
- Edge/CDN caching behavior

## Test Suite

The E2E tests for this application are located in the [`nextjs-automation`](https://github.com/pantheon-systems/nextjs-automation) repository at:
- `tests/playwright-tests/cache-handler/`

Tests run on a schedule (every 4 hours) via GitHub Actions and validate cache handler behavior over time.

## Pages

### Static & Dynamic Rendering

- **`/`** - Homepage (SSG - Static Site Generation)
- **`/about`** - About page (SSR - Server-Side Rendering)
- **`/ssg-demo`** - SSG demonstration with timestamp
- **`/blogs`** - Blog list (ISR - Incremental Static Regeneration, 5-minute revalidation)
- **`/blogs/[slug]`** - Individual blog post (ISR, 5-minute revalidation)

### API Routes for Testing Fetch Strategies

- **`/api/posts/no-cache`** - Always fresh (`cache: 'no-store'`)
- **`/api/posts/force-cache`** - Cached indefinitely (`cache: 'force-cache'`)
- **`/api/posts/revalidate`** - Time-based revalidation (60 seconds)
- **`/api/posts/with-tags`** - Tag-based caching (`next.tags`)
- **`/api/revalidate?tag=<tag>`** - Trigger tag-based revalidation
- **`/api/cache-stats`** - Get cache statistics (GET) or clear cache (DELETE)

## Environment Variables

### Required for Pantheon Deployment

```bash
# GCS Cache Handler (required for production)
CACHE_BUCKET=your-gcs-bucket-name

# Optional: Enable detailed logging
NEXT_PUBLIC_ENABLE_CACHE_LOGGING=true

# Optional: Outbound proxy for edge cache purging
OUTBOUND_PROXY_ENDPOINT=your-proxy-endpoint
```

### For E2E Testing

```bash
# Use real JSONPlaceholder API (not mock data)
E2E_MOCK_DATA=false
```

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Deployment to Pantheon

This application is configured for deployment to Pantheon using the Next.js runtime. How a change reaches the site, how to check it and how to undo it: [DEPLOYMENT.md](DEPLOYMENT.md).

### Prerequisites

- Pantheon environment created
- GCS bucket configured (for cache persistence)
- Environment variables set on Pantheon

### Build Configuration

The application uses:
- **Cache Handler**: `@pantheon-systems/nextjs-cache-handler` (auto-detects GCS or file-based)
- **Next.js**: 16.x (`^16.1.6` in package.json)
- **Node.js**: 20.x (required)

### Cache Behavior

- **Local Development**: Uses file-based caching (`.next/cache/`)
- **Pantheon Production**: Uses GCS-based caching (requires `CACHE_BUCKET` env var)
- **Cache Persistence**: Cache survives deployments when using GCS

## Testing

This application is tested by automated E2E tests that:
1. Run on a schedule (every 4 hours)
2. Validate all caching strategies
3. Track cache persistence over time
4. Verify ISR revalidation timing
5. Validate edge cache headers

### Running E2E Tests Locally

From the `nextjs-automation` repository:

```bash
cd tests/playwright-tests/cache-handler

# Set test target
export PLAYWRIGHT_BASE_URL=http://localhost:3000

# Run all tests
npx playwright test

# Run specific test suite
npx playwright test smoke.spec.ts
npx playwright test fetch-cache.spec.ts
npx playwright test page-cache.spec.ts
```

## Architecture

### Cache Handler Configuration

The cache handler is configured in `cache-handler.mjs`:

```javascript
import { createCacheHandler } from '@pantheon-systems/nextjs-cache-handler';

const CacheHandler = createCacheHandler({
  type: 'auto', // Auto-detect: GCS if CACHE_BUCKET is set, otherwise file-based
});

export default CacheHandler;
```

### Data Sources

The application can fetch data from:
- **Real API** (default): JSONPlaceholder API for posts/users
- **Mock Data**: Local mock data (toggle with `E2E_MOCK_DATA=true`)

For E2E testing, **real API mode is required** because mock mode bypasses `fetch()` calls and doesn't test the cache handler.

## Rollback

- **When:** a merged change breaks the test site or makes the cache-handler E2E suite fail for reasons other than a cache-handler bug.
- **Recover:** revert the PR on `main`, then have the Pantheon site rebuilt from `main`. A rebuild does not restore the previous dependency versions, because there is no lockfile.
- **Verify:** the next run of the [cache-handler E2E workflow](https://github.com/pantheon-systems/nextjs-automation/actions/workflows/cache-handler-e2e.yml) is green.
- **Who:** developer-experience in `#ask-hosting` (nobody is paged).

Full procedure and its known gaps: [DEPLOYMENT.md#rollback](DEPLOYMENT.md#rollback).

## Related Repositories

- **Cache Handler Package**: [`nextjs-cache-handler`](https://github.com/pantheon-systems/nextjs-cache-handler)
- **E2E Tests**: [`nextjs-automation`](https://github.com/pantheon-systems/nextjs-automation)
- **GitHub Actions**: [Cache Handler E2E](https://github.com/pantheon-systems/nextjs-automation/blob/main/.github/workflows/cache-handler-e2e.yml) (in nextjs-automation)

## License

MIT
