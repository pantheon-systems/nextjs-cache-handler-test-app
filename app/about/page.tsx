import Link from 'next/link';
import { connection } from 'next/server';

// This page demonstrates SSR behavior. With cacheComponents enabled, pages
// without 'use cache' are dynamic by default. We call connection() to access
// request-time data and avoid the Suspense boundary so PPR doesn't split
// the page into a cached shell + streamed dynamic chunk (which the CDN
// can't properly reassemble).

export const metadata = {
  title: 'About - Dynamic Blog',
  description: 'Learn more about our dynamic blog platform and caching experiments.',
};

export default async function AboutPage() {
  // connection() signals this is a dynamic page that needs request-time data
  await connection();

  // Get server-side data that changes on each request
  const serverTime = new Date().toISOString();
  const serverInfo = {
    timestamp: serverTime,
    nodeVersion: process.version,
    platform: process.platform,
    renderTime: new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  };

  // Simulate some processing time to demonstrate SSR
  await new Promise(resolve => setTimeout(resolve, 50));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <nav className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            ← Back to Home
          </Link>
        </nav>

        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
            About
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Learn more about this dynamic blog platform and our caching experiments
          </p>
        </header>

        <div className="space-y-8">
          {/* Project Overview */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Project Overview
            </h2>
            <div className="prose prose-zinc dark:prose-invert max-w-none">
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                This is a dynamic blog platform built with Next.js 16, designed for testing custom cache handling mechanisms.
                The application demonstrates different caching strategies across various page types.
              </p>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                The blog content is currently fed from static JSON data, making it perfect for testing and
                experimenting with different caching approaches without the complexity of a backend database.
              </p>
            </div>
          </section>

          {/* Technical Details */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Technical Stack
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Frontend</h3>
                <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  <li>• Next.js 16+ with App Router</li>
                  <li>• TypeScript for type safety</li>
                  <li>• Tailwind CSS for styling</li>
                  <li>• React 19+ with Server Components</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Caching Strategy</h3>
                <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  <li>• Cache Components with &apos;use cache&apos; directive</li>
                  <li>• SSR for about page (this page)</li>
                  <li>• cacheLife profiles for duration control</li>
                  <li>• cacheTag for on-demand invalidation</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Server-Side Info — rendered inline (no Suspense) to prevent PPR */}
          <section className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700 p-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Server-Side Rendering Demo
            </h2>
            <p className="text-zinc-700 dark:text-zinc-300 mb-6">
              This page is server-side rendered on every request. The information below changes with each page load:
            </p>

            <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-blue-200 dark:border-blue-600">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Live Server Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Rendered At (UTC)</div>
                  <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{serverInfo.renderTime}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Server Timestamp</div>
                  <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{serverInfo.timestamp}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Node.js Version</div>
                  <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{serverInfo.nodeVersion}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Platform</div>
                  <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{serverInfo.platform}</div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  💡 Refresh this page to see the timestamp update - demonstrating server-side rendering!
                </p>
              </div>
            </div>
          </section>

          {/* Features */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-8">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
              Platform Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Dynamic Blog Posts</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Browse through sample blog posts with full content, metadata, and responsive design.
                </p>
              </div>
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Cache Testing</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Perfect environment for testing different caching strategies and performance optimizations.
                </p>
              </div>
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Developer Friendly</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Built with modern tools and best practices for easy development and experimentation.
                </p>
              </div>
            </div>
          </section>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/blogs"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Explore Blog Posts
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-md transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
