import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Pantheon deployment
  output: 'standalone',

  // Configure Turbopack to resolve linked packages from parent directory
  // Required for npm link to work with local @pantheon-systems/nextjs-cache-handler
  turbopack: {
    root: path.join(__dirname, '..'),
  },

  // Transpile the local cache handler package
  transpilePackages: ['@pantheon-systems/nextjs-cache-handler'],

  // Next.js 16 Cache Components configuration
  // Replaces experimental.dynamicIO and legacy route segment configs
  cacheComponents: true,

  // Custom cache life profiles for testing 'use cache' directive
  cacheLife: {
    // Short-lived cache for testing (30s stale, 60s revalidate, 5min expire)
    short: {
      stale: 30,
      revalidate: 60,
      expire: 300,
    },
    // Blog-style cache (1min stale, 5min revalidate, 1hr expire)
    blog: {
      stale: 60,
      revalidate: 300,
      expire: 3600,
    },
  },

  // logging: {
  //   fetches: {
  //     fullUrl: true,
  //     hmrRefreshes: true,
  //   },
  // },
  // Legacy cache handler for ISR, route handlers, fetch cache
  cacheHandler: path.resolve(__dirname, './cache-handler.mjs'),

  // Next.js 16 cache handlers for 'use cache' directive
  // - default: Used by 'use cache' (build-time caching)
  // - remote: Used by 'use cache: remote' (runtime caching with CDN support)
  cacheHandlers: {
    default: path.resolve(__dirname, './use-cache-handler.mjs'),
    remote: path.resolve(__dirname, './use-cache-handler.mjs'),
  },

  cacheMaxMemorySize: 0, // disable default in-memory caching
};

export default nextConfig;
