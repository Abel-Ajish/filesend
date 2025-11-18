# Local Share (Vercel-ready)

Minimal send/receive sharing site running on Next.js and Vercel Blob storage. After each upload we generate a 6-character share code and auto-delete the blob 1 minute later (best-effort timer in the API).

## Prerequisites

- Node.js 18+
- A Vercel account with Blob enabled (beta or GA)

## Local development

```bash
npm install
cp .env.example .env.local
# fill in BLOB_READ_WRITE_TOKEN
npm run dev
```

Generate a Blob RW token inside Vercel (`Storage → Blob → Tokens`) and paste it into `.env.local`.

## Deploy to Vercel

1. `vercel init` (or import the repo via the dashboard).
2. Add the environment variable `BLOB_READ_WRITE_TOKEN` for Production, Preview, and Development.
3. `vercel --prod`.

The default `next.config.mjs` increases the request body limit to ~200 MB so larger files can upload, but you can lower that if desired.

## Architecture

- UI: App Router (`app/page.tsx`) with a Material-You styled client component that handles uploads and code-based downloads; no file list is ever shown.
- Storage: [`@vercel/blob`](https://vercel.com/storage/blob). Uploaded files become public HTTPS links returned by the API.
- API: `/api/files` for listing & uploading, `/api/files/[filename]` for delete. Both routes are dynamic to ensure fresh data.
- Lifecycle: uploads are scheduled for deletion 60 seconds after the POST completes, and users can retrieve them using the generated share code before it expires.

## Security considerations

- There is no auth: anyone with the site URL can upload/delete. Deploy this only for trusted environments or add your own auth layer.
- Uploaded files are public; share URLs responsibly.

