import { bindings, defineConfig, triggers } from 'cf/config';
import * as entrypoint from './src/worker.js' with { type: 'cf-worker' };

// Approved Free-plan deployment. Nothing deploys automatically.
// This non-secret UUID identifies the isolated account/progress database.
export default defineConfig({
  worker: {
    name: 'virginia-learning-accounts',
    entrypoint,
    compatibilityDate: '2026-11-09',
    env: {
      DB: bindings.d1({ name: 'virginia-learning-accounts', id: process.env.D1_DATABASE_ID || '2f34707d-9c4a-4593-9b45-788031cfba70' }),
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
