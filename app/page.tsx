import FileShare from "@/components/file-share";
import { listFiles, type SharedFile } from "@/lib/blob";

export const dynamic = "force-dynamic";

export default async function Page() {
  let files: SharedFile[] = [];
  let errorMessage: string | null = null;

  try {
    files = await listFiles();
  } catch (error) {
    errorMessage = (error as Error).message;
  }

  return (
    <main>
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

