import { defineConfig, configDefaults } from 'vitest/config'
import base from './vitest.config.js'

// Tilt-specific overrides: skip Docker-dependent global-setup and point at
// the already-running Tilt services instead of the compose.test.yml stack.
// NOTE: mergeConfig concatenates arrays rather than replacing them, so we
// spread manually to ensure globalSetup: [] actually clears the base value.
// We use configDefaults.exclude (not base.test.exclude) to ensure node_modules
// and other vitest default exclusions are preserved — base.test.exclude is
// undefined because vitest applies configDefaults implicitly, not explicitly.
export default defineConfig({
  test: {
    ...base.test,
    globalSetup: [],
    // Exclude tests that hardcode compose.test.yml ports and directly call
    // cdp-uploader — they only work against the standalone test compose stack.
    exclude: [...configDefaults.exclude, '**/boundary.test.js', '**/upload.integration.test.js'],
    env: {
      ...base.test.env,
      DB_PORT: '5432',
      S3_ENDPOINT: 'http://localhost:4566',
      CDP_UPLOADER_URL: 'http://localhost:7337',
      // Prevent test traffic going through the squid proxy (set at container level).
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      http_proxy: '',
      https_proxy: '',
    },
  },
})
