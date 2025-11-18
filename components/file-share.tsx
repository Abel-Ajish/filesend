"use client";

import { useState, useTransition } from "react";

type FileItem = {
  name: string;
  sizeLabel: string;
  type: string;
  url: string;
};

type Props = {
  initialFiles: FileItem[];
};

export default function FileShare({ initialFiles }: Props) {
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [isSending, startSendTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();

  async function refreshList() {
    startRefreshTransition(async () => {
      const response = await fetch("/api/files", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { files: FileItem[] };
        setFiles(data.files);
      }
    });
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");

    if (!file || !(file instanceof File)) {
      alert("Please choose a file.");
      return;
    }

    startSendTransition(async () => {
      const response = await fetch("/api/files", {
        method: "POST",
        body: data,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        alert(payload.error || "Upload failed.");
        return;
      }

      form.reset();
      await refreshList();
    });
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    const response = await fetch(`/api/files/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      alert(payload.error || "Delete failed.");
      return;
    }
    await refreshList();
  }

  return (
    <>
      <section className="panel">
        <h2>Send</h2>
        <p>Upload a file to make it instantly available to anyone with this link.</p>
        <form onSubmit={handleUpload}>
          <label className="file-input">
            <input
              type="file"
              name="file"
              required
              aria-label="Upload file"
              disabled={isSending}
            />
            <span>Choose file</span>
          </label>
          <button type="submit" disabled={isSending}>
            {isSending ? "Uploading…" : "Upload"}
          </button>
        </form>
        <small className="notice">
          Files are stored in Vercel Blob. Set retention policies as needed.
        </small>
      </section>

      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h2>Receive</h2>
            <p>Download or delete any shared file.</p>
          </div>
          <button
            type="button"
            onClick={refreshList}
            disabled={isRefreshing}
            style={{ minWidth: 120 }}
          >
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {files.length === 0 ? (
          <p className="notice">No files available yet.</p>
        ) : (
          <ul className="file-list">
            {files.map((file) => (
              <li key={file.name} className="file-row">
                <div>
                  <strong>{file.name}</strong>
                  <span>
                    {file.sizeLabel} • {file.type}
                  </span>
                </div>
                <div className="file-actions">
                  <a
                    className="action-link"
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleDelete(file.name)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

