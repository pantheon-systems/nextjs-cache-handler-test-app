// Use cache handler configuration for Next.js 16 'use cache' directive
// Uses @pantheon-systems/nextjs-cache-handler cacheHandlers (plural) support

import { createUseCacheHandler } from '@pantheon-systems/nextjs-cache-handler';

// Get the handler class based on environment
const UseCacheHandlerClass = createUseCacheHandler({
  type: 'auto', // Auto-detect: GCS if CACHE_BUCKET is set, otherwise file-based
});

// Next.js expects an object with handler methods, so we instantiate the class
const handler = new UseCacheHandlerClass();

// Export the handler instance directly
export default {
  get: handler.get.bind(handler),
  set: handler.set.bind(handler),
  refreshTags: handler.refreshTags.bind(handler),
  getExpiration: handler.getExpiration.bind(handler),
  updateTags: handler.updateTags.bind(handler),
};
