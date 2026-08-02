# Polytechnic Helpdesk status worker

This free Cloudflare Worker reads only a receipt number, status, and resource title from the existing public Apps Script service. It does not expose names, emails, PDFs, or Google Drive links.

The Worker is configured for the website origin `https://polytechnichelpdesk.github.io`.

1. Create or sign in to a free Cloudflare account at https://dash.cloudflare.com/sign-up.
2. Open **Workers & Pages** → **Create application** → **Create Worker**.
3. Name it `polytechnic-helpdesk-status` and click **Deploy**.
4. Click **Edit code**, replace all code with `worker.js`, then click **Deploy**.
5. Copy the Worker URL and add `/status` to the end. Example:
   `https://polytechnic-helpdesk-status.your-name.workers.dev/status`
6. Paste that full URL into `STATUS_API_URL` at the top of `script.js`, replacing `PASTE_CLOUDFLARE_WORKER_STATUS_URL_HERE`.
7. Upload the updated `script.js` and `index.html` to GitHub Pages.

Test the Worker by opening:

`https://YOUR-WORKER.workers.dev/status?receipt=PH-260802-0354-G7Q9`

It should show JSON containing `found` and `status`.

If it returns `The status service is temporarily unavailable`, open the Worker in Cloudflare and select **Logs** after making one test request. The log records the exact Google Apps Script response needed for troubleshooting.
