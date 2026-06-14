This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Cloud Run

The repository root contains `cloudbuild.yaml` for Cloud Build -> Artifact Registry -> Cloud Run.

```bash
gcloud builds submit --config=cloudbuild.yaml .
```

Override substitutions when needed:

```bash
gcloud builds submit --config=cloudbuild.yaml . \
  --substitutions=_GRAPH_QUERY_BASE_URL=https://graph-query.example.com
```

## Verification

The Association Link Lookup CI gate runs the same graph-demo checks locally:

```bash
pnpm build
pnpm lint
pnpm test:e2e -- graph-demo.spec.ts workbench.spec.ts
```

`GRAPH_QUERY_BASE_URL` should point at the DuckDB graph query service. The Playwright graph tests start a local mock graph query service and exercise the app's `/api/graph/search` route against that service.
