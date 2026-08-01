# Polytechnic Helpdesk — Academic Resource Contribution Form

A static, responsive contribution form designed for GitHub Pages.

## What works

- Required-field, email, URL, consent, file/link, and 10 MB file-size validation
- Resource metadata is stored in the contributor's browser (local storage)
- On successful submission, a reference number and downloadable JSON receipt are generated

## Publish with GitHub Pages

1. Create a new GitHub repository and upload `index.html`, `styles.css`, `script.js`, and this file.
2. Open the repository **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. GitHub will show the public site address after deployment.

## Important limitation

GitHub Pages hosts static files only. This version validates and records submissions on the contributor's own device, but cannot deliver uploaded files or form entries to an administrator. Connect the form to a backend or a form service (for example, Formspree, Firebase, or Supabase) when you need central collection and review.
