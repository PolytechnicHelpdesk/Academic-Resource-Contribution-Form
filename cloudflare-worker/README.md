# Status worker setup

This Worker reads the published `Public Status` CSV sheet and returns a native JSON status result to the website.

1. Copy `worker.js` into the Cloudflare Worker and deploy it.
2. Keep the `Public Status` sheet published as CSV with the existing URL in `worker.js`.
3. The website uses `/status` for the student status checker.

Uploads continue to use the existing Google Apps Script web-app URL in `script.js`.
