# Hosting on Azure Static Web Apps

The website is a static build (`apps/frontend/dist`), so it can be hosted on Azure Static Web Apps. The Convex backend and SpacetimeDB stay where they are; the browser talks to them directly.

## What is already set up in the repo
- `apps/frontend/public/staticwebapp.config.json` is copied into `dist`. It sends unknown paths such as `/login` and `/walkthrough` to `index.html`, so refreshing or opening a shared link does not return a 404. It also gives `.glb` and `.wasm` files the right file types. Missing files under `/assets` and `/models` still return 404.
- Checked with Microsoft's local emulator (`swa start`): `/login` and `/walkthrough` return the app, `.glb` files are served as `model/gltf-binary`, and a missing file returns 404.

## Size limit
The Free plan allows **250 MB per environment** and 500 MB in total, over all environments including previews. The current build is about **196 MB**, almost all of it 3D models (`aortic_arch.glb` alone is about 82 MB in the build output). Adding large models will break the Free plan; the Standard plan allows 500 MB per environment. Source: https://learn.microsoft.com/en-us/azure/static-web-apps/quotas

## Steps (you run these; they need your Azure account)
1. **Create the resource.** In the Azure portal choose Create a resource, then Static Web App.
   - Plan: **Free**.
   - Deployment source: **Other** (we deploy from a prebuilt folder, so no GitHub link is needed).
   - Pick a region close to you and a name such as `asx-ray`.
2. **Copy the deployment token.** Static Web App, Overview, **Manage deployment token**. Treat it like a password: never commit it, and never paste it into chat.
3. **Build with the Convex URL.** Vite bakes `VITE_CONVEX_URL` into the build, and Azure's "Application settings" do not reach the browser build, so pass it when building. Production builds do not read `apps/frontend/.env.development`.
   ```bash
   cd <repo root>
   VITE_CONVEX_URL=https://<your-deployment>.convex.cloud pnpm build:frontend
   ```
   Add `VITE_CHAT_BACKEND=convex` only if the deployment has the chatbot keys; without it the chat uses the built-in demo answers.
4. **Deploy.** Use Node 22. The token goes in an environment variable, not on the command line history if you can avoid it:
   ```bash
   export SWA_CLI_DEPLOYMENT_TOKEN=<token from step 2>
   npx @azure/static-web-apps-cli@2.0.2 deploy ./apps/frontend/dist --env production
   ```
5. **Open the URL** Azure shows (for example `https://<name>.azurestaticapps.net`) in a private window and run the checks below.

## Checks after deploying
1. The home page loads.
2. Open `/login` directly, then refresh. It must not show a 404.
3. Open `/walkthrough` signed out. You should be sent to `/login`.
4. Sign up with fake details, then open the walkthrough. The 3D heart should load; the first load downloads about 80 MB of models.
5. Type `My SSN is 123-45-6789` into the chat. It should be underlined and sent as a placeholder.

## Notes
- **Which Convex deployment:** the build points at whatever `VITE_CONVEX_URL` you give it. Production Convex has no auth keys yet (see [auth.md](auth.md)), so until it is set up, point the build at a dev deployment that has them.
- **First load is heavy:** the 3D models and, on first use of the chat box, the on-device privacy model download. Say so in the demo.
- **Cost:** the Free plan includes 100 GB of bandwidth per month. A 196 MB site uses it up after roughly 500 full loads.
- **Redeploying:** run steps 3 and 4 again. Repeat deploys replace the production site.
- **Sign-in:** password sign-in does not depend on the site URL, so no Convex setting needs to change for a new host.
