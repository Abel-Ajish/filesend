# Local Share (Appwrite Cloud)

Minimal send/receive sharing site running on Next.js and Appwrite Cloud storage. After each upload we generate a 6-character share code and auto-delete the file 1 minute later (best-effort timer in the API).

## Prerequisites

- Node.js 18+
- An Appwrite Cloud account (free, no credit card required)

## Local development

```bash
npm install
cp .env.example .env.local
# fill in Appwrite credentials
npm run dev
```

### Setting up Appwrite Cloud

1. **Create an account** at [cloud.appwrite.io](https://cloud.appwrite.io) (no credit card needed)
2. **Create a project** (e.g., "Local Share")
3. **Create a storage bucket**:
   - Go to Storage → Create Bucket
   - Name it "Shared Files"
   - Note the Bucket ID (e.g., `files`)
4. **Generate API credentials**:
   - Go to Settings → API Keys → Create API Key
   - Name: "Local Share App"
   - Scopes: Select `files.read` and `files.write`
   - Copy the API key (shown only once!)
5. **Add credentials to `.env.local`**:
   ```env
   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   APPWRITE_PROJECT_ID=your_project_id_here
   APPWRITE_API_KEY=your_api_key_here
   APPWRITE_BUCKET_ID=files
   ```

## Deploy to Vercel

1. `vercel init` (or import the repo via the dashboard).
2. Add the environment variables from `.env.local` for Production, Preview, and Development.
3. `vercel --prod`.

The default `next.config.mjs` increases the request body limit to ~200 MB so larger files can upload, but you can lower that if desired.

## Architecture

- UI: App Router (`app/page.tsx`) with a Material-You styled client component that handles uploads and code-based downloads; no file list is ever shown.
- Storage: [Appwrite Cloud](https://appwrite.io). Uploaded files become public HTTPS links returned by the API.
- API: `/api/files` for listing & uploading, `/api/files/[filename]` for delete, `/api/code/[code]` for retrieval. Both routes are dynamic to ensure fresh data.
- Lifecycle: uploads are scheduled for deletion 60 seconds after the POST completes, and users can retrieve them using the generated share code before it expires.

## Free Tier Limits

Appwrite Cloud free tier includes:
- **2 GB storage**
- **5 GB bandwidth/month**
- **No credit card required**

Since files only live for 1 minute, storage is never an issue. Monitor your bandwidth usage in the Appwrite dashboard.

## Security considerations

- There is no auth: anyone with the site URL can upload/delete. Deploy this only for trusted environments or add your own auth layer.
- Uploaded files are public; share URLs responsibly.

