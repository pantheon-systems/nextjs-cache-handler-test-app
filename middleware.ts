// Middleware for waitUntil() background task tests (via event.waitUntil())
//
// NOTE: Middleware runs in Edge runtime, so we cannot use @google-cloud/storage directly.
// Instead, we call an internal API endpoint that runs in Node.js runtime.

import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

export function middleware(request: NextRequest, event: NextFetchEvent) {
  // Handle waitUntil() test trigger
  if (request.nextUrl.pathname === '/api/background-tasks/waituntil-trigger') {
    const taskId = request.nextUrl.searchParams.get('taskId');

    if (taskId) {
      console.log(`[Middleware] waitUntil() triggered: taskId=${taskId}`);

      // Use event.waitUntil() to keep the request alive for background work
      // Call internal API endpoint to write to GCS (runs in Node.js runtime)
      event.waitUntil(
        (async () => {
          try {
            // Build the internal API URL
            const writeUrl = new URL('/api/background-tasks/waituntil-write', request.url);
            writeUrl.searchParams.set('taskId', taskId);

            const response = await fetch(writeUrl.toString(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                taskId,
                type: 'waitUntil',
                completed: true,
                timestamp: Date.now(),
                source: 'middleware',
              }),
            });

            if (!response.ok) {
              throw new Error(`Write API returned ${response.status}`);
            }

            console.log(`[Middleware] waitUntil() completed: taskId=${taskId}`);
          } catch (error) {
            console.error(`[Middleware] waitUntil() failed: taskId=${taskId}`, error);
          }
        })()
      );
    }
  }

  // Continue to the route handler
  return NextResponse.next();
}

export const config = {
  // Only run middleware for background-tasks waitUntil endpoint
  // All other routes should bypass middleware entirely to avoid interfering with cache headers
  matcher: [
    '/api/background-tasks/waituntil-trigger',
  ],
};
