import FileShare from "@/components/file-share";

export const dynamic = "force-dynamic";

// This is the new root page structure for our redesigned application.
export default function Page() {
  return (
    <main className="main-container">
      <div className="content-wrapper">
        <FileShare />
      </div>
    </main>
  );
}
