# Accounts (Convex Auth, username login)

Status: built and unit tested, and sign-up and login were checked against a Convex dev deployment (the shared `hack-13` dev deployment is the default for local development, see `apps/frontend/.env.development`). Each new deployment still needs the setup below. Accounts only guard the walkthrough pages; the chat and speech functions do not require a signed-in user yet.

## How login works
- Library: `@convex-dev/auth` (beta) with its `Password` provider. Passwords are hashed by the library (Scrypt). We do not hash anything ourselves.
- Files: `convex/auth.ts` (provider), `convex/auth.config.ts`, `convex/http.ts` (auth routes), `convex/users.ts` (`viewer`), `convex/lib/authProfile.ts` (pure validation, tested in `test/authProfile.test.ts`), users table and `authTables` in `convex/schema.ts`.
- The client calls the library's `signIn("password", formData)` with exactly these fields:
  - sign up: `flow=signUp`, `username`, `password`, `firstName`, `lastName`, `email`
  - sign in: `flow=signIn`, `username`, `password`
- Username rules: trimmed, lowercased, 3-20 characters, letters, numbers, underscore. Password: 8-128 characters (checked on sign up only).
- `users.viewer` (query, no args) returns `null` when signed out, otherwise `{ username, firstName, lastName }`. It never returns the email or any id.

## The username decision
The library identifies an account by `profile(params).email` (and calls `profile` on sign in too). We return the lowercased username there, so the "email" account id is the username and no verification email is ever sent. The users document therefore has `email` = username (not a real address); the real address the person typed is stored separately as `contactEmail`. This works without patching the library.

Brittle points (all documented in code):
1. `profile` must be synchronous, so a database duplicate check cannot live in it. Instead `auth.ts` wraps the provider's internal `options.authorize` (an undocumented field). It fails loudly at load time if the library changes shape.
2. The library throws plain `Error`s, not `ConvexError`s, and a duplicate sign-up with the SAME password silently signs in to the existing account. The wrapper pre-checks `by_username` (internal query `users:usernameExists`) and translates errors.

Fallback if this proves too brittle: use the real email as the account id (`profile` returns `email: <lowercased contactEmail>`), keep `username` as a display field, and sign in with email. Then the library's own behavior is used unchanged, but a duplicate is still a plain `Error("Account x already exists")` so the same wrapper (or a client-side string match) is needed for `username_taken`/`email_taken`. We prefer usernames because the product wants no-email login.

## Errors the frontend receives
All thrown as `ConvexError`; read `error.data.code` (and `error.data.message`, safe to show). Anything else is an unexpected server error (show a generic message).

| Situation | `error.data.code` |
|---|---|
| Username missing or not 3-20 of letters, numbers, underscore | `invalid_username` |
| Sign up: first or last name empty or over 50 characters | `invalid_name` |
| Sign up: email not a valid format | `invalid_email` |
| Sign up: password under 8 or over 128 characters | `weak_password` |
| Sign up: username already exists (any password) | `username_taken` |
| Sign in: wrong password | `invalid_credentials` |
| Sign in: unknown username | `invalid_credentials` (same code on purpose, so usernames cannot be probed) |
| Sign in: more than 10 failed attempts in an hour for that account | `too_many_attempts` |
| Missing password or unsupported `flow` | `invalid_request` |

Not verified against a live deployment: that the ConvexError reaches the browser unchanged through the library's `signIn` action (it should, since it is thrown from the action itself), and the exact text of plain-error messages the mapping matches (taken from the library source).

## Environment variables (Convex, never committed)
`JWT_PRIVATE_KEY` (secret), `JWKS`, `SITE_URL` (frontend origin; only used by OAuth and email redirects, but the setup tool sets it). Declared in `convex/convex.config.ts`; the library reads them itself. `CONVEX_SITE_URL` is provided by Convex.

## Commands the USER must run (in `packages/backend`)
1. `npx convex dev` : log in and create or pick the project (first run). This also regenerates `convex/_generated` for the new files (`auth`, `http`, `users`); commit that diff.
2. `npx @convex-dev/auth` : generates and sets `JWT_PRIVATE_KEY` and `JWKS` on the deployment, and `SITE_URL`. It may also try to edit `auth.ts`, `auth.config.ts`, `http.ts`, `schema.ts`; answer so it does NOT overwrite the existing files (or `git checkout` them after).
3. `npx convex env set SITE_URL http://localhost:5173` : if step 2 did not set it, or to change the origin (use the real origin when deployed).
4. Production: repeat the env vars on the production deployment (`npx convex env set --prod ...`; generate separate keys).
5. Frontend: put `VITE_CONVEX_URL=<your deployment URL>` in `apps/frontend/.env.local` and restart `pnpm dev:frontend`. The app already wraps itself in `ConvexAuthProvider` when that variable is set.

## Privacy
- Name, username and email are personal data. They must never be sent to the chatbot, any model, logs of prompts, or the RAG index. Chat code must not read the `users` table.
- `users.viewer` returns no email. `contactEmail` has no query that returns it.

## Out of scope (future work)
Password reset, email verification, MFA, OAuth providers, account deletion UI.

## Manual test script
Run after the commands above, with `pnpm dev:frontend` and `VITE_CONVEX_URL` set. Use fake data only.
1. **Sign up.** Open `/signup`. Enter first name `Jane`, last name `Demo`, email `jane@example.com`, username `Jane_Demo`, password `demo-pass-123`. Press Create account. Expect: you land on the walkthroughs list, and the header shows `Jane` and a Log out button.
2. **Log out.** Press Log out. Expect: the header shows Sign up and Log in again.
3. **Log in.** Open `/login`, username `jane_demo` (any letter case works), the same password. Expect: you are signed in.
4. **Wrong password.** Log out, then log in with a wrong password. Expect: only "Incorrect username or password" under the password field.
5. **Unknown username.** Log in as `nobody_here`. Expect: the same generic message (usernames must not be revealed).
6. **Duplicate username.** Log out, open `/signup`, reuse `jane_demo` with a different email. Expect: a friendly "username is taken" message under Username, and no new account.
7. **Field validation.** On `/signup` try username `ab`, `bad name!`, email `x`, password `short`. Expect: inline messages under the right fields before anything is sent.
8. **Signed-out guard.** Log out, then open `/walkthrough`. Expect: you are sent to `/login?next=/walkthrough`, and after signing in you return to `/walkthrough`.
9. **Open redirect check.** Open `/login?next=//evil.example`. Sign in. Expect: you land on the walkthroughs list, not on another site.
10. **Demo switch.** Set `REQUIRE_AUTH` to false in `apps/frontend/src/auth/config.ts`. Expect: `/walkthrough` opens without signing in.
11. **No backend.** Remove `VITE_CONVEX_URL` and restart. Expect: the whole site works, the forms show "Accounts are not available in this demo yet.", and nothing is guarded.

## Deploying to the team project (hack-13)
The auth keys are set per deployment, so the shared deployment needs its own. Whoever has access to the team's Convex project does this once, from `packages/backend`, using Node 22:
1. Merge this branch and pull `main`.
2. Connect to the shared dev deployment first: `npx convex dev --configure existing --team <team_slug> --project hack-13`. Check that the chatbot still answers.
3. Run `npx @convex-dev/auth`. Give the real site URL (or `http://localhost:5173` for local work) and answer **no** to any file overwrite.
4. For production, run the same setup against the production deployment (generate separate keys; never copy dev keys), then `npx convex deploy`. The `users` and `auth*` tables are new, so existing chatbot data is untouched.
5. Every developer sets `VITE_CONVEX_URL` in `apps/frontend/.env.local` to the deployment they use. For a hosted site, set it as a build variable: without it, accounts are off and the walkthroughs are NOT protected.
6. To open the walkthroughs without a login for a demo, set `REQUIRE_AUTH` to `false` in `apps/frontend/src/auth/config.ts`.
