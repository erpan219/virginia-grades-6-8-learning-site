/* Public service address only. Credentials belong in Cloudflare secret bindings.
   Local previews stay local unless scripts/preview.py explicitly enables them. */
if (location.origin === 'https://erpan219.github.io') {
  window.VA_ACCOUNT_CONFIG = {
    apiBase: 'https://virginia-learning-accounts.erpanelyar.workers.dev'
  };
}
