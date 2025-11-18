import FileShare from "@/components/file-share";
import { listFiles } from "@/lib/blob";

export const dynamic = "force-dynamic";

export default async function Page() {
  let files = [];
  let errorMessage: string | null = null;

  try {
    files = await listFiles();
  } catch (error) {
    errorMessage = (error as Error).message;
  }

  return (
    <main>
      <header>
        <h1>Local Share</h1>
        <p>
          Minimal send/receive tool backed by Vercel Blob so you can share files
          safely over HTTPS.
        </p>
        <small>Uploads are public; share URLs only with people you trust.</small>
      </header>

      {errorMessage ? (
        <p className="notice">
          {errorMessage} — set <code>BLOB_READ_WRITE_TOKEN</code> locally or in
          Vercel before continuing.
        </p>
      ) : (
        <FileShare initialFiles={files} />
      )}
    </main>
  );
}

