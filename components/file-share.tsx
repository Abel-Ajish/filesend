"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { SharedFile } from "@/lib/blob";

type Props = {
  initialFiles: SharedFile[];
};

type Toast = {
  text: string;
  tone: "info" | "success" | "error";
};

export default function FileShare({ initialFiles }: Props) {
  const [files, setFiles] = useState<SharedFile[]>(initialFiles);
  const [isSending, startSendTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 4000);
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, [toast]);

  function notify(text: string, tone: Toast["tone"] = "info") {
    setToast({ text, tone });
  }

  async function refreshList() {
    startRefreshTransition(async () => {
      const response = await fetch("/api/files", { cache: "no-store" });
      if (response.ok) {
        const data = (await response.json()) as { files: SharedFile[] };
        setFiles(data.files);
        notify("Files refreshed.", "success");
        return;
      }
      const payload = await response.json().catch(() => ({}));
      notify(payload.error || "Failed to refresh files.", "error");
    });
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");

    if (!file || !(file instanceof File)) {
      notify("Please choose a file to upload.", "error");
      return;
    }

    startSendTransition(async () => {
      const response = await fetch("/api/files", {
        method: "POST",
        body: data,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        notify(payload.error || "Upload failed.", "error");
        return;
      }

      form.reset();
      await refreshList();
      notify("Upload complete. Link expires in 1 minute.", "success");
    });
  }

  async function handleDelete(file: SharedFile) {
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
      notify(payload.error || "Delete failed.", "error");
      return;
    }
    await refreshList();
    notify(`${file.name} deleted.`, "success");
  }

  return (
    <>
      <div className="hero">
        <div>
          <h1>Local Share</h1>
          <p>Drop files, hand off the link, and we’ll tidy up in 60 seconds.</p>
          <small>Runs entirely on your network using Vercel Blob.</small>
        </div>
        <div className="pill">Auto delete · 1 min</div>
      </div>
      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}
      <section className="panel">
        <h2>Send</h2>
        <p>Choose any file — we’ll instantly create a shareable download link.</p>
        <form onSubmit={handleUpload} encType="multipart/form-data">
          <label className="file-input">
            <input
              type="file"
              name="file"
              required
              aria-label="Upload file"
              disabled={isSending}
            />
            <span>{isSending ? "Uploading…" : "Choose file"}</span>
          </label>
          <button type="submit" disabled={isSending}>
            {isSending ? "Sending…" : "Upload"}
          </button>
        </form>
        <small className="notice subtle">
          Heads up: every file self-destructs one minute after you upload it.
        </small>
      </section>

      <section className="panel">
        <div className="receive-head">
          <div>
            <h2>Receive</h2>
            <p>Download or delete shared files before the timer runs out.</p>
          </div>
          <button
            type="button"
            onClick={refreshList}
            disabled={isRefreshing}
            className="ghost"
          >
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {files.length === 0 ? (
          <p className="notice subtle">No files yet — upload something to get started.</p>
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

