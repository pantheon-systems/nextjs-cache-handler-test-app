'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

interface CdnProbeBody {
  generated_at: string;
  nonce: string;
  purpose: string;
}

interface ProbeResult {
  body: CdnProbeBody;
  headers: Record<string, string | null>;
  fetched_at: string;
  error?: string;
}

interface LogEntry {
  id: number;
  type: 'FETCH' | 'PURGE' | 'VERIFY';
  message: string;
  timestamp: string;
  detail?: string;
}

let logIdCounter = 0;

/** Headers to capture from the CDN response */
const HEADERS_TO_CAPTURE = [
  'age',
  'x-cache',
  'x-cache-hits',
  'surrogate-key',
  'x-surrogate-key-debug',
  'cache-control',
  'x-served-by',
  'x-timer',
  'via',
  'content-type',
  'date',
];

/**
 * Fetch /api/cdnprobe directly from the browser (through the CDN).
 * This is more reliable than the server-side proxy because the browser
 * request naturally traverses the CDN edge, so Age/X-Cache headers
 * reflect the actual CDN state the user would see.
 */
async function fetchCdnProbe(): Promise<ProbeResult> {
  const res = await fetch('/api/cdnprobe', { cache: 'no-store' });
  const body: CdnProbeBody = await res.json();

  const headers: Record<string, string | null> = {};
  for (const name of HEADERS_TO_CAPTURE) {
    headers[name] = res.headers.get(name);
  }

  return {
    body,
    headers,
    fetched_at: new Date().toISOString(),
  };
}

export default function CdnDemoPage() {
  const [probeData, setProbeData] = useState<ProbeResult | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);

  const [revalidateResult, setRevalidateResult] = useState<string | null>(null);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const [beforeSnapshot, setBeforeSnapshot] = useState<ProbeResult | null>(null);
  const [afterSnapshot, setAfterSnapshot] = useState<ProbeResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [log, setLog] = useState<LogEntry[]>([]);

  const addLog = useCallback((type: LogEntry['type'], message: string, detail?: string) => {
    setLog(prev => [{
      id: ++logIdCounter,
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
      detail,
    }, ...prev]);
  }, []);

  const fetchProbe = useCallback(async () => {
    const PURGE_PROPAGATION_MS = 3000;
    const WARMUP_MAX_ATTEMPTS = 6;
    const WARMUP_POLL_INTERVAL_MS = 5000;

    setIsProbing(true);
    setProbeError(null);

    try {
      // Step 1: Nuke CDN for a clean slate (matches Playwright test pattern)
      addLog('FETCH', 'Nuking CDN edge cache for clean start...');
      try {
        const nukeRes = await fetch('/api/edge-cache-clear', { method: 'DELETE' });
        const nukeData = await nukeRes.json();
        if (nukeData.success) {
          addLog('FETCH', 'CDN nuke succeeded', `${nukeData.duration_ms}ms`);
        } else {
          addLog('FETCH', 'CDN nuke failed (continuing anyway)', nukeData.error || `status ${nukeData.status}`);
        }
      } catch {
        addLog('FETCH', 'CDN nuke unavailable (continuing anyway — may be local dev)');
      }

      // Step 2: Wait for purge propagation
      addLog('FETCH', `Waiting ${PURGE_PROPAGATION_MS / 1000}s for purge propagation...`);
      await new Promise(resolve => setTimeout(resolve, PURGE_PROPAGATION_MS));

      // Step 3: Seed the CDN cache with a fresh request
      addLog('FETCH', 'Seeding CDN cache with fresh /api/cdnprobe request...');
      let data = await fetchCdnProbe();
      setProbeData(data);

      // Step 4: Poll until CDN Age > 0 (proves it's cached at the edge)
      let ageVal = data.headers?.age ? parseInt(data.headers.age, 10) : null;

      for (let attempt = 1; attempt <= WARMUP_MAX_ATTEMPTS && (ageVal === null || ageVal === 0); attempt++) {
        addLog('FETCH', `Waiting for CDN to cache (attempt ${attempt}/${WARMUP_MAX_ATTEMPTS})...`);
        await new Promise(resolve => setTimeout(resolve, WARMUP_POLL_INTERVAL_MS));
        data = await fetchCdnProbe();
        setProbeData(data);
        ageVal = data.headers?.age ? parseInt(data.headers.age, 10) : null;
      }

      const surrogateKey = data.headers?.['surrogate-key'] || data.headers?.['x-surrogate-key-debug'];

      if (ageVal !== null && ageVal > 0) {
        addLog(
          'FETCH',
          'CDN cache confirmed — baseline locked',
          `Age: ${ageVal}s | Surrogate-Key: ${surrogateKey ?? 'n/a'} | Nonce: ${data.body?.nonce?.slice(0, 8)}...`
        );
      } else {
        addLog(
          'FETCH',
          'Probe fetched (CDN Age not detected — may be local dev)',
          `Surrogate-Key: ${surrogateKey ?? 'n/a'} | Nonce: ${data.body?.nonce?.slice(0, 8)}...`
        );
      }

      // Snapshot only after CDN has confirmed caching
      setBeforeSnapshot(data);
      setAfterSnapshot(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setProbeError(msg);
      addLog('FETCH', `Network error: ${msg}`);
    } finally {
      setIsProbing(false);
    }
  }, [addLog]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchProbe();
  }, [fetchProbe]);

  const handleRevalidate = async (method: 'tag' | 'path') => {
    setIsRevalidating(true);
    setRevalidateResult(null);

    const endpoint = method === 'tag'
      ? '/api/revalidate?tag=cdnprobe'
      : '/api/revalidate?path=/api/cdnprobe';

    addLog('PURGE', `Revalidating by ${method}: ${method === 'tag' ? 'cdnprobe' : '/api/cdnprobe'}...`);

    try {
      const res = await fetch(endpoint);
      const data = await res.json();

      if (res.ok) {
        setRevalidateResult(`Success (${method}): ${data.message}`);
        addLog('PURGE', `Revalidation succeeded via ${method}`, data.message);
      } else {
        setRevalidateResult(`Error: ${data.error || res.statusText}`);
        addLog('PURGE', `Revalidation failed: ${data.error || res.statusText}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setRevalidateResult(`Error: ${msg}`);
      addLog('PURGE', `Revalidation error: ${msg}`);
    } finally {
      setIsRevalidating(false);
    }
  };

  const handleVerify = async () => {
    const MAX_ATTEMPTS = 6;
    const POLL_INTERVAL_MS = 5000;

    setIsVerifying(true);
    addLog('VERIFY', 'Polling CDN for fresh content...');

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const data = await fetchCdnProbe();

        const changed = beforeSnapshot && data.body.generated_at !== beforeSnapshot.body.generated_at;

        if (changed) {
          setAfterSnapshot(data);
          setProbeData(data);
          addLog(
            'VERIFY',
            `CDN purge confirmed on attempt ${attempt} — new content served`,
            `Before: ${beforeSnapshot?.body.generated_at} | After: ${data.body.generated_at}`
          );
          break;
        }

        if (attempt === MAX_ATTEMPTS) {
          setAfterSnapshot(data);
          setProbeData(data);
          addLog(
            'VERIFY',
            `Timestamps still match after ${MAX_ATTEMPTS} attempts — CDN may not have propagated yet`,
            `Before: ${beforeSnapshot?.body.generated_at} | After: ${data.body.generated_at}`
          );
          break;
        }

        addLog('VERIFY', `Attempt ${attempt}/${MAX_ATTEMPTS}: still cached, retrying in ${POLL_INTERVAL_MS / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog('VERIFY', `Verification error: ${msg}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const age = probeData?.headers?.age;
  const ageNum = age ? parseInt(age, 10) : null;
  const isCached = ageNum !== null && ageNum > 0;
  const surrogateKey = probeData?.headers?.['surrogate-key'] || probeData?.headers?.['x-surrogate-key-debug'];

  const logTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'FETCH': return 'text-blue-400';
      case 'PURGE': return 'text-orange-400';
      case 'VERIFY': return 'text-green-400';
    }
  };

  const logTypeBg = (type: LogEntry['type']) => {
    switch (type) {
      case 'FETCH': return 'bg-blue-900/30 text-blue-300';
      case 'PURGE': return 'bg-orange-900/30 text-orange-300';
      case 'VERIFY': return 'bg-green-900/30 text-green-300';
    }
  };

  const timestampsChanged = beforeSnapshot && afterSnapshot &&
    beforeSnapshot.body.generated_at !== afterSnapshot.body.generated_at;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <nav className="mb-8 flex gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            &larr; Home
          </Link>
          <Link
            href="/cache-test"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            &larr; Cache Test
          </Link>
        </nav>

        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-2">
            CDN Cache Demo
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Observe the full CDN cache lifecycle: edge caching, revalidation (purge), and fresh content delivery.
          </p>
        </header>

        <div className="space-y-8">
          {/* Section 1: CDN Cache Probe */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                CDN Cache Probe
              </h2>
              <button
                onClick={fetchProbe}
                disabled={isProbing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-md transition-colors"
              >
                {isProbing ? 'Fetching...' : 'Fetch from CDN'}
              </button>
            </div>

            {isProbing && !probeData && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}

            {probeError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4 rounded text-sm text-red-800 dark:text-red-200">
                {probeError}
              </div>
            )}

            {probeData && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                    isCached
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                  }`}>
                    {isCached ? 'CACHED' : 'FRESH'}
                  </span>
                  {ageNum !== null && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      CDN Age: {ageNum}s
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Generated At</div>
                    <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                      {probeData.body.generated_at}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Nonce</div>
                    <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                      {probeData.body.nonce}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Surrogate-Key</div>
                    <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                      {surrogateKey ?? <span className="text-zinc-400 italic">none</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Cache-Control</div>
                    <div className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                      {probeData.headers?.['cache-control'] ?? <span className="text-zinc-400 italic">none</span>}
                    </div>
                  </div>
                </div>

                {ageNum === null && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-200 dark:border-blue-700 text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> CDN Age header not present. This is expected when running locally without a CDN layer.
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Section 2: Revalidation Controls */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              Revalidation Controls
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">By Tag</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                  Calls <code className="text-xs bg-zinc-100 dark:bg-zinc-700 px-1 rounded">revalidateTag(&apos;cdnprobe&apos;)</code> on the server,
                  which invalidates the server cache entry and triggers CDN surrogate key purge.
                </p>
                <button
                  onClick={() => handleRevalidate('tag')}
                  disabled={isRevalidating}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 rounded-md transition-colors"
                >
                  {isRevalidating ? 'Revalidating...' : 'Revalidate by Tag (cdnprobe)'}
                </button>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">By Path</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                  Calls <code className="text-xs bg-zinc-100 dark:bg-zinc-700 px-1 rounded">revalidatePath(&apos;/api/cdnprobe&apos;)</code> on the server,
                  which invalidates the server cache entry and triggers CDN path purge.
                </p>
                <button
                  onClick={() => handleRevalidate('path')}
                  disabled={isRevalidating}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 rounded-md transition-colors"
                >
                  {isRevalidating ? 'Revalidating...' : 'Revalidate by Path (/api/cdnprobe)'}
                </button>
              </div>
            </div>

            {revalidateResult && (
              <div className={`p-3 rounded text-sm ${
                revalidateResult.startsWith('Success')
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
              }`}>
                {revalidateResult}
              </div>
            )}
          </section>

          {/* Section 3: Verify CDN Purge */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Verify CDN Purge
              </h2>
              <button
                onClick={handleVerify}
                disabled={isVerifying || !beforeSnapshot}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 rounded-md transition-colors"
              >
                {isVerifying ? 'Verifying...' : 'Fetch from CDN Again'}
              </button>
            </div>

            {!beforeSnapshot && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Fetch from CDN first to establish a baseline snapshot.
              </p>
            )}

            {beforeSnapshot && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Before */}
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                    Before (Pre-Revalidation)
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">Generated At</div>
                      <div className="font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
                        {beforeSnapshot.body.generated_at}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">Nonce</div>
                      <div className="font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
                        {beforeSnapshot.body.nonce}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">Age</div>
                      <div className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                        {beforeSnapshot.headers?.age ?? 'n/a'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* After */}
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                  <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                    After (Post-Revalidation)
                  </div>
                  {afterSnapshot ? (
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Generated At</div>
                        <div className="font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
                          {afterSnapshot.body.generated_at}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Nonce</div>
                        <div className="font-mono text-xs text-zinc-900 dark:text-zinc-100 break-all">
                          {afterSnapshot.body.nonce}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Age</div>
                        <div className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                          {afterSnapshot.headers?.age ?? 'n/a'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 dark:text-zinc-500 py-4">
                      Click &quot;Fetch from CDN Again&quot; after revalidating
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Verdict */}
            {afterSnapshot && (
              <div className={`mt-4 p-4 rounded-lg border text-sm font-medium ${
                timestampsChanged
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200'
              }`}>
                {timestampsChanged ? (
                  <span>&#10003; CDN purge verified — new content served. Timestamps differ and Age reset.</span>
                ) : (
                  <span>&#10007; Timestamps match — CDN may still be serving cached content. Try waiting a moment and fetching again.</span>
                )}
              </div>
            )}
          </section>

          {/* Section 4: Event Log */}
          <section className="bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Event Log
              </h2>
              {log.length > 0 && (
                <button
                  onClick={() => setLog([])}
                  className="px-3 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-300 dark:border-zinc-600 rounded transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-xs">
              {log.length === 0 ? (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 font-sans">
                  No events yet. Actions will be logged here.
                </p>
              ) : (
                log.map(entry => (
                  <div key={entry.id} className="flex gap-2 py-1 border-b border-zinc-100 dark:border-zinc-700/50 last:border-0">
                    <span className="text-zinc-400 dark:text-zinc-500 shrink-0 w-20">
                      {entry.timestamp}
                    </span>
                    <span className={`shrink-0 w-16 px-1.5 py-0.5 rounded text-center text-[10px] font-bold ${logTypeBg(entry.type)}`}>
                      {entry.type}
                    </span>
                    <span className={`${logTypeColor(entry.type)}`}>
                      {entry.message}
                      {entry.detail && (
                        <span className="text-zinc-500 dark:text-zinc-400 ml-2">
                          [{entry.detail}]
                        </span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Navigation */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/cache-test"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Cache Test
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
