import { bindings, defineConfig, triggers } from 'cf/config';
import * as entrypoint from './src/worker.js' with { type: 'cf-worker' };

// This is a reviewable deployment configuration. Nothing deploys automatically.
// Set D1_DATABASE_ID to the explicitly approved, isolated database before publishing.
export default defineConfig({
  worker: {
    name: 'virginia-learning-accounts',
    entrypoint,
    compatibilityDate: '2026-11-09',
    env: {
      DB: bindings.d1({ name: 'virginia-learning-accounts', id: process.env.D1_DATABASE_ID }),
      ALLOWED_ORIGINS: bindings.text('https://erpan219.github.io'),
      SETUP_CODE: bindings.secret(),
      RATE_LIMIT_SALT: bindings.secret(),
    },
    observability: {
      enabled: true,
      headSamplingRate: 0.1,
      redactQueryString: true,
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
    workersDev: true,
    previewUrls: false,
    triggers: [triggers.scheduled({ schedule: '0 */6 * * *' })],
  },
});
