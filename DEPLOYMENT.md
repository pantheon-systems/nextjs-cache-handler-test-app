---
contract_version: 2
kind: service                       # a Next.js app that runs as a Pantheon site; a test fixture, not customer-facing
service: nextjs-cache-handler-test-app   # the Pantheon site that nextjs-automation's cache-handler E2E suite targets

trigger: null                       # TODO(owner): how the Pantheon site gets new code. No Pantheon build status or GitHub deployment has ever been recorded on a commit in this repo, so the site does not appear to be connected to it [inferred]
merged_implies_deployed: false      # inferred: see trigger. Most of the history was developed in, and merged from, a fork outside the org, where "chore: Trigger rebuild" commits were used to start Pantheon builds
other_paths_to_prod:
  - "any rebuild of the site resolves dependencies fresh: package-lock.json is gitignored (since 2026-02-11), so `next ^16.1.6` and `react ^19.1.1` float to the newest matching release without a change here"
  - "site environment variables (CACHE_BUCKET, E2E_MOCK_DATA, OUTBOUND_PROXY_ENDPOINT, NEXT_PUBLIC_ENABLE_CACHE_LOGGING) are set on the Pantheon site, not in this repo"

pipeline:                           # no CI/CD in this repo: the only workflows are GitHub's default CodeQL setup and Dependabot
  system: other                     # Pantheon's Next.js build (pantheon.yml: nodejs 20, `npm ci`, `npm run build`, `npm run start` on port 3000)
  workflow: null
  jobs_in_order: []
  typical_minutes: null             # TODO(verify-on-deploy): Pantheon build + deploy duration
  minutes_by_change: {}
  watch: null                       # TODO(owner): where the site's builds are visible
  concurrency_group: null
  cancel_in_progress: null
  blocked_by_waiting_run: null
  approval_gate: null               # checked: no GitHub Environments

repo_properties:
  observed_at: 2026-11-10
  trust_level: TL5
  ccb_status: in-ccb
  owner: developer-experience
  repo_type: gcp-service            # questionable for a test fixture; see "Suggested pipeline changes"

gating_checks:
  required: ["Wiz IaC Scanner", "Wiz Vulnerability Scanner", "Wiz Data Scanner"]   # org TL5 ruleset; no repo-level ruleset
  approvals: {required: 0, code_owner: false, last_push_approval: false, strict_up_to_date: false, merge_queue: false}
  run_but_not_required: ["CodeQL (Analyze (javascript-typescript))"]
  conditional: []

environments:
  - {name: pantheon-site, target: "Pantheon Next.js site used by nextjs-automation (URL in that repo's secret CACHE_HANDLER_BASE_URL)", gates_prod: null}   # TODO(owner): site name, which env (dev/test/live)

artifact:
  image: null                       # Pantheon builds from source
  tag_scheme: none
  tag_mutable: null
  retention: null                   # TODO(owner): whether Pantheon keeps previous builds you can redeploy
  version_signal: none              # TODO(verify-on-deploy): no endpoint here reports a commit SHA; /api/debug-headers and /api/cache-stats exist but don't return a version [inferred from route names]
  tag_to_sha: null

runtime:
  - kind: other                     # Pantheon Next.js site (Cloud Run under the hood [inferred from commit 82a0f12 'runtime config for after() reliability on Cloud Run'])
    context: "TODO(owner): Pantheon site and environment"
    namespace: null
    name: nextjs-cache-handler-test-app
    replicas: null
    strategy: null
    probes: null
    applied_by_ci: []
    config: "Pantheon site env vars (names in README.md / .env.example). A GCS bucket (CACHE_BUCKET) holds the Next.js cache and survives deploys"

release: null                       # nothing is published; this app is a consumer, of @pantheon-systems/nextjs-cache-handler

consumers:                          # who uses the deployed site
  - repo: nextjs-automation
    pin: ".github/workflows/cache-handler-e2e.yml (PLAYWRIGHT_BASE_URL from secret CACHE_HANDLER_BASE_URL); tests in tests/playwright-tests/cache-handler/"
    version: "whatever the site is running"
    bumped_by: "n/a (tests the live site)"
    active: true                    # cron '0 0/4 * * *' plus pushes; 1,563 runs total

deployed_when:
  - "TODO(verify-on-deploy): the site's latest build is for the merged commit. Today there is no way to read the running commit from outside; see version_signal"

health:                             # delegated to the E2E suite in nextjs-automation
  soak_minutes: null
  baseline: "last green E2E run 2026-11-02T20:00Z; red since (see known_baseline_errors)"
  checks:
    - name: cache-handler E2E
      kind: delegate
      run: "gh run list -R pantheon-systems/nextjs-automation --workflow cache-handler-e2e.yml --limit 5 --json conclusion,createdAt,event"
      healthy: "success on the first scheduled run after the site rebuilds. Ran 2026-11-10: returns data; last 30 runs all failure"
  known_baseline_errors:
    - "since ~2026-11-03 every cache-handler E2E run fails before testing anything: `Playwright does not support chromium on ubuntu26.04-x64` (ubuntu-latest moved). That's a nextjs-automation CI problem, not this app; until it's fixed there is no health signal"
  dashboards: []
  alerts: []

rollback:
  options:
    - when: "a merged change breaks the site or the E2E suite"
      kind: revert-and-merge
      steps: "revert the PR here (no approval needed at TL5), then get the site rebuilt from the reverted commit. TODO(owner): the rebuild step depends on how the site is connected"
      time_to_rollback_minutes: null
  not_restored:
    - "dependency versions: without a lockfile, a rebuild of an old commit gets today's newest matching next/react, not what ran before"
    - "the GCS cache bucket contents (cache entries written by the bad version stay until revalidated or cleared via /api/cache-stats DELETE)"
    - "site env vars"
  one_way_changes: []
  currently_blocked: "deploy path unknown (TODO(owner))"
  last_exercised: null
  capture_before_merge: "TODO(owner): the commit the site last built from"
  who_can: ["@pantheon-systems/developer-experience (code owners; anyone with write can merge at TL5)"]   # TODO(owner): who can trigger a build on the site
  verify: "next cache-handler E2E run is green"

escalation:
  slack: "#ask-hosting"
  owner_team: developer-experience
  paged: false

preflight:
  - "gh auth status (read nextjs-automation runs)"
  - "TODO(owner): access to the Pantheon site"

automation_blockers:
  - blocker: "no known path from a merge here to the site: no build status, no deployment record, no version endpoint"
    clears_when: "the site is connected to this repo (or the deploy step is documented) and the app exposes its commit SHA"
  - blocker: "no lockfile: builds are not reproducible, so a rollback can't restore what ran"
    clears_when: "commit package-lock.json (it was removed for platform-specific build failures; regenerate it on Linux)"
  - blocker: "the only health signal (nextjs-automation E2E) has been red since ~2026-11-03 for an unrelated runner problem"
    clears_when: "nextjs-automation pins its runner (e.g. ubuntu-24.04) or updates Playwright"

verified:
  at: null
  by: null
  change: null
  running_digest: null
---

# Deployment

**Short version:** this is a test fixture. It's a Next.js app that runs as a Pantheon site so that the `nextjs-automation` E2E suite can exercise [`@pantheon-systems/nextjs-cache-handler`](https://github.com/pantheon-systems/nextjs-cache-handler) against it. Nothing in this repo builds or deploys it, and **it isn't known how merges here reach the site**. No Pantheon build status or deployment has ever been recorded on a commit here.

## How a change reaches production

1. A PR merges to `main`. At TL5 no approval is required; only the three Wiz checks gate the merge. CodeQL runs but isn't required. There are no tests or builds in this repo's CI.
2. TODO(owner): how the Pantheon site picks up the change. Most of the history was developed in a fork outside the org, using "chore: Trigger rebuild" commits to start Pantheon builds, which suggests the site was connected to that fork [inferred].
3. Pantheon builds from source using [`pantheon.yml`](pantheon.yml): Node 20, `npm ci`, `npm run build`, `npm run start` on port 3000. `package-lock.json` is gitignored, so every build resolves dependencies fresh. That can only work if Pantheon falls back from `npm ci` to `npm install` [inferred]; TODO(verify-on-deploy).

Things that change the site without a merge here: a rebuild picks up the newest `next` 16.x and `react` 19.x. Site env vars live on Pantheon.

`@pantheon-systems/nextjs-cache-handler` is pinned at `^0.4.0`, which on 0.x means only 0.4.0. The latest release is 0.14.0 (npm, 2026-11-10), so the site tests a version ten minors old. TODO(owner): intended?

## How to confirm it deployed

TODO(verify-on-deploy): nothing exposes the running commit. A Pantheon build log for the site would show it. Adding the commit SHA to an existing endpoint (e.g. `/api/debug-headers`) would make this checkable.

## How to confirm it's healthy

Health is delegated to the cache-handler E2E suite in `nextjs-automation` (`.github/workflows/cache-handler-e2e.yml`, every 4 hours, tests in `tests/playwright-tests/cache-handler/`):

```bash
gh run list -R pantheon-systems/nextjs-automation --workflow cache-handler-e2e.yml --limit 5 --json conclusion,createdAt,event
```

As of 2026-11-10, the last green run was 2026-11-02T20:00Z. Every run since then has failed before reaching the site: `Playwright does not support chromium on ubuntu26.04-x64`. That's a runner change in `nextjs-automation`, not a problem with this app, but until it's fixed there's no health signal.

## Rollback

Revert the PR here, then get the site rebuilt from `main` (TODO(owner): how). Things a revert does not restore:

- the dependency versions that were running before (there is no lockfile);
- entries already in the site's GCS cache bucket (clear them with `DELETE /api/cache-stats`);
- site env vars.

Verify with the next green E2E run.

## Escalation

`#ask-hosting` (developer-experience). Nobody is paged.

## Suggested pipeline changes

- Connect the Pantheon site to this repo (or document the deploy step), and record the site name here.
- Expose the commit SHA from the app.
- Commit a lockfile generated on Linux.
- In `nextjs-automation`: pin `runs-on` for `cache-handler-e2e.yml` (e.g. `ubuntu-24.04`) or upgrade Playwright.
- `pan-repo-type: gcp-service` doesn't fit a test fixture site. `website` is closer. Archiving was suggested in 2026-03.
