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

The dashboard uses one shared Server-Sent Events connection, authenticated
with a short-lived, single-use ticket obtained using the saved bearer token.
The backend sends only project-scoped invalidation events; REST remains the
source of truth. Project counts refresh for project, stage, activity, and
progress changes. The hierarchical stage/activity tree refreshes for stage,
activity, and progress changes while preserving expanded nodes and the current
selection. The stage timeline refreshes for project and stage changes. Bursts
are coalesced, and a reconnect triggers a scoped refetch to recover changes
missed while offline.

The real-time API refuses stream tickets for accounts without authorised
project associations. The backend checks that the signed-in account is active;
Admin can subscribe to all projects, while other roles are scoped to projects
whose owner or `organisations` array includes the account's active
organisation.
MongoDB must support Change Streams (a replica set, sharded cluster, or Atlas
deployment). See the sibling backend README for MongoDB pre-image setup,
permissions, limitations, and local/ngrok verification steps.

The dashboard signs the user out after 30 minutes without keyboard, pointer,
scroll, or touch activity. The idle timeout is shared across open tabs and is
checked again when returning to a background tab. This clears the app's saved
login token; a password saved by the browser can still be used to sign in again.

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
