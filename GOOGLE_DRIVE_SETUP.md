# Connect the custom website form to Google Drive

The website now has its own custom-designed form. Complete these one-time steps to make its Submit button upload PDFs to the administrator's Google Drive and record submissions in the linked spreadsheet.

1. Open [script.new](https://script.new) while signed in as the administrator who owns the response spreadsheet.
2. Replace the starter code with the contents of `google-apps-script/Code.gs`.
3. Click **Deploy → New deployment → Web app**.
4. Choose **Execute as: Me** and **Who has access: Anyone**. Deploy, review the requested Drive and Sheets permissions, and copy the **Web app URL**.
5. In `script.js`, replace `PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE` with that URL. Upload the updated file to GitHub Pages.

After the first submission, the script creates a Drive folder named **Polytechnic Helpdesk Uploads** in the administrator's My Drive and a **Website Submissions** tab in the connected spreadsheet. The PDF link is included in each row.

## Important

The public form needs the web app URL to accept submissions. Add spam protection or restrict deployment access if the website is shared beyond your student group. Do not move the upload folder after the first upload; the script stores its ID automatically.
