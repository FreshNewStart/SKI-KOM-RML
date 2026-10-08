# SKI-KOM-RML frontend

This Astro site is deployed to GitHub Pages. It calls the Express API from the
browser, so the API must be reachable over HTTPS while the site is in use.

## Local development

1. Copy `.env.example` to `.env`.
2. Set `PUBLIC_API_URL` to the backend's public HTTPS URL, including `/api`
   (for example, `https://your-ngrok-domain.ngrok-free.app/api`).
3. Install dependencies and start Astro:

   ```powershell
   npm ci
   npm run dev
   ```

`PUBLIC_API_URL` is required at build time. The same value is used by login,
dashboard, forms, and uploads.

## GitHub Pages deployment

In the GitHub repository, add an Actions **variable** named `PUBLIC_API_URL`
under **Settings > Secrets and variables > Actions > Variables**. Set it to the
backend's HTTPS ngrok URL ending in `/api`. It is a public URL embedded in the
static frontend, not a secret.

The Pages workflow reads this variable during its build and fails with a clear
error if it is missing. When an ngrok URL changes, update the variable and
redeploy the site. A stable ngrok domain avoids repeated frontend deployments.

The backend must allow the Pages site's origin
(`https://freshnewstart.github.io` by default; no repository path) in
`ALLOWED_ORIGINS`. See the backend setup instructions in the sibling
`Online Platform` project.

## Build

```sh
npm run build
npm run preview
```
