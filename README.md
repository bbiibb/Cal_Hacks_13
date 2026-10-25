# Ask-Ray (for Cal_Hacks_13)

A patient-education website that shows 3D human organs and surgical procedures step by step.

- Walkthroughs: **TAVR** (transcatheter aortic valve replacement), the first and complete demo, and an **eye anatomy** prototype with placeholder text (`docs/eye-prototype.md`)
- What a patient can do: step through the procedure in 3D, point at or click a part to read about it, and ask a chatbot (typed or spoken) that answers from the team's TAVR fact base (not yet clinically reviewed) and moves the 3D view
- Chatbot: **Slow** (a model on your own computer, free) or **Fast** (a cloud model, paid; the patient is warned first). Personal details are replaced on the device before a question is sent
- Parts: frontend (`apps/frontend`), Convex backend (`packages/backend`), a shared contract (`packages/shared`, zod schemas and fixtures), and a small viewing-progress module (`packages/progress`, SpacetimeDB)

## Run it

```bash
pnpm install
pnpm dev:frontend     # the website, http://localhost:5173
pnpm dev:backend      # optional: the Convex backend for the live chatbot (needs a login the first time)
```

Without a backend the 3D walkthrough and the demo chat answers still work. Sign-up and login use the shared dev deployment by default (`apps/frontend/.env.development`). Steps for the live chatbot, the local model and the keys are in [docs/chatbot.md](docs/chatbot.md) and [docs/local-llm.md](docs/local-llm.md).

> All content is educational dummy data and is not medical advice.

## Documents

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System diagram, data map and open items |
| [docs/product-roadmap.md](docs/product-roadmap.md) | Features, backend needs and implementation status |
| [docs/github-structure.md](docs/github-structure.md) | Repository structure, branches, pull requests and ownership |
| [docs/chatbot.md](docs/chatbot.md), [docs/local-llm.md](docs/local-llm.md), [docs/knowledge-base.md](docs/knowledge-base.md), [docs/safety.md](docs/safety.md) | The chatbot: models, local mode, fact base, safety rules |
| [docs/privacy-layer.md](docs/privacy-layer.md), [docs/auth.md](docs/auth.md) | On-device privacy guard and accounts |
| [docs/contracts.md](docs/contracts.md), [docs/backend-api.md](docs/backend-api.md) | The frontend-backend contract and the backend functions |
| [docs/tavr-demo.md](docs/tavr-demo.md), [docs/eye-prototype.md](docs/eye-prototype.md) | The two walkthroughs and their 3D assets |
| [apps/frontend/README.md](apps/frontend/README.md) | The website: layout, routes, settings |
