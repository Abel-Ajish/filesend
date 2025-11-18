"use client";

import { useState, useTransition } from "react";
import type { SharedFile } from "@/lib/blob";

type ClientFile = SharedFile & { id: string };

type Props = {
  initialFiles: ClientFile[];
};

export default function FileShare({ initialFiles }: Props) {
  const [files, setFiles] = useState<ClientFile[]>(initialFiles);
  const [isSending, startSendTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();

  async function refreshList() {
    startRefreshTransition(async () => {
      const response = await fetch("/api/files", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { files: ClientFile[] };
        setFiles(data.files);
      } else {
        const payload = await response.json().catch(() => ({}));
        alert(payload.error || "Failed to refresh files.");
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

  async function handleDelete(file: ClientFile) {
    if (!confirm(`Delete ${file.name}?`)) return;
    const params = new URLSearchParams({ id: file.id });
    const response = await fetch(
      `/api/files/${encodeURIComponent(file.name)}?${params.toString()}`,
      {
        method: "DELETE",
      }
    );
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
        <form onSubmit={handleUpload} encType="multipart/form-data">
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
              <li key={file.id} className="file-row">
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
                    onClick={() => handleDelete(file)}
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

