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
# Reliable status lookup setup

Google Apps Script is returning a Google sign-in page to Cloudflare instead of JSON. Use a published tracker sheet instead.

1. In Apps Script, replace `Code.gs` with the workspace version, save it, select `initializeStatusTracker`, and click **Run** once. Approve the requested permissions. This creates a `Public Status` sheet containing **Receipt no.**, **Resource title**, **Full name**, and **Submission status**, and installs the automatic status-sync trigger.
2. In Google Sheets choose **File → Share → Publish to web**. Select the `Public Status` sheet, choose **Comma-separated values (.csv)**, and publish it. Copy the generated link, which ends with `output=csv`.
3. In `worker.js`, paste that link into `PUBLIC_STATUS_CSV_URL`, then deploy the Worker.

The main website keeps its existing design. The public sheet does not include email addresses, uploads, or Drive links.
