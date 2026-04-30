import { defineConfig, configDefaults } from 'vitest/config'
import base from './vitest.config.js'

// Tilt-specific overrides for the frontend test suite.
//
// Key problems this file solves:
//
//  1. CSRF 403s — crumb's `skip: () => config.get('isTest')` only returns true
//     when NODE_ENV=test at the time config.js first loads.  Vitest does NOT
//     override NODE_ENV when it is already set; the container has
//     NODE_ENV=development, so `isTest` evaluates to false and every POST
//     without a crumb token gets 403.  Forcing NODE_ENV=test here ensures the
//     module-level `const isTest = process.env.NODE_ENV === 'test'` in
//     config.js evaluates correctly inside each Vitest worker.
//
//  2. beforeAll timeout in accessibility tests — createServer() registers the
//     defra-identity plugin, which fetches the OIDC discovery URL over the
//     squid HTTP_PROXY.  Setting ENABLE_DEFRA_ID=false skips that fetch
//     entirely, making server initialisation fast and deterministic.
//
//  3. Unit test URL assertions — IMPACT_ASSESSOR_BASE_URL and
//     NRF_BACKEND_API_URL are set to Docker-internal addresses in the
//     container; unit tests assert the localhost defaults.  We restore the
//     defaults here so those tests pass without touching test files.
//
//  4. redis-client.test.js — those tests hardcode host '127.0.0.1', which
//     is irreconcilable with the Tilt Redis running at docker DNS 'redis'.
//     Excluded rather than fixed because the server tests need 'redis:6379'.
//     (config.test.js > redis.port is 6380 is also an accepted known failure
//     for the same reason — REDIS_PORT=6379 from the container overrides the
//     isTest ? '6380' : '6379' default that the test asserts against.)
//
//  5. Session race condition (no-edp test empty document) — with the Redis
//     session cache engine (the default) and Docker bridge networking, there
//     is a window between Yar's async Redis write in the POST handler and the
//     Redis read in the subsequent injected GET.  If the write is not fully
//     committed before server.inject() resolves, getQuoteDataFromCache returns
//     {} and checkForValidQuoteSession redirects, producing an empty document.
//     Switching to SESSION_CACHE_ENGINE=memory gives each Vitest worker its
//     own in-process session store — writes are synchronous and the race
//     cannot occur.  Redis itself still runs (ensureRedis / waitForRedisReady
//     in setup-test-server.js still ping redis:6379 successfully); only the
//     Hapi catbox session backend changes.
//
// NOTE: mergeConfig concatenates arrays rather than replacing them, so we
// spread manually to ensure globalSetup: [] actually clears the base value.
export default defineConfig({
  test: {
    ...base.test,
    globalSetup: [],
    exclude: [
      ...configDefaults.exclude,
      // Tests that hardcode the config default '127.0.0.1' for redis.host;
      // irreconcilable with Tilt where REDIS_HOST=redis is required for
      // server tests to connect to the running Redis container.
      '**/redis-client.test.js',
    ],
    hookTimeout: 30000,
    env: {
      ...base.test?.env,
      // Force test mode so config.js evaluates isTest=true → CSRF skipped.
      // Vitest only sets NODE_ENV=test when not already set; the container
      // has NODE_ENV=development which must be explicitly overridden.
      NODE_ENV: 'test',
      // Skip the OIDC discovery fetch during createServer() so server
      // initialisation is fast and cannot be blocked by proxy/network issues.
      ENABLE_DEFRA_ID: 'false',
      // Restore localhost defaults that unit tests assert against (the
      // container sets these to Docker-internal service addresses).
      IMPACT_ASSESSOR_BASE_URL: 'http://localhost:8085',
      NRF_BACKEND_API_URL: 'http://localhost:4001',
      // Clear the CDP uploader base URL — the container sets this to
      // http://localhost:7337 which causes uploader.test.js to see the
      // URL prepended even when tests expect a bare relative path.
      // buildUploadUrl() treats falsy values as "no prefix".
      CDP_UPLOADER_URL: '',
      // Use in-memory session cache instead of Redis so that Yar's session
      // write (in the POST handler) is immediately visible to the next
      // injected GET without any async Redis round-trip.  Each Vitest worker
      // gets its own Hapi server with its own memory store — perfect isolation.
      SESSION_CACHE_ENGINE: 'memory',
      // Prevent test traffic going through the squid proxy (set at container level).
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      http_proxy: '',
      https_proxy: '',
    },
  },
})
