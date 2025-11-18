"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type Toast = {
  text: string;
  tone: "info" | "success" | "error";
};

export default function FileShare() {
  const [isSending, startSendTransition] = useTransition();
  const [isCodeLoading, setIsCodeLoading] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
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

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(payload.error || "Upload failed.", "error");
        return;
      }

      form.reset();
      setShareCode(payload.code ?? null);
      notify(
        `Share code ${payload.code ?? ""} ready. Link expires in 1 minute.`,
        "success"
      );
    });
  }

  async function handleCodeDownload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = codeInput.trim().toUpperCase();
    if (trimmed.length < 4) {
      notify("Enter the 6-character code.", "error");
      return;
    }
    setIsCodeLoading(true);
    try {
      const response = await fetch(`/api/code/${trimmed}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(payload.error || "Code not found.", "error");
        return;
      }
      setCodeInput("");
      notify(`Downloading ${payload.file?.name ?? "file"}...`, "success");
      window.open(payload.file?.url, "_blank", "noopener");
    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setIsCodeLoading(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      notify("Code copied to clipboard.", "success");
    } catch {
      notify("Unable to copy — copy it manually.", "error");
    }
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
        {shareCode && (
          <div className="share-result">
            <div>
              <p className="share-label">Share this code</p>
              <strong aria-live="polite">{shareCode}</strong>
            </div>
            <button type="button" className="ghost" onClick={() => copyCode(shareCode)}>
              Copy
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="receive-head">
          <div>
            <h2>Receive</h2>
            <p>Nothing is listed. Type your code to access the file.</p>
          </div>
        </div>

        <form className="code-form" onSubmit={handleCodeDownload}>
          <label htmlFor="code-input">Have a code?</label>
          <div className="code-input-wrap">
            <input
              id="code-input"
              className="code-input"
              placeholder="e.g., 9F2K6A"
              value={codeInput}
              onChange={(event) =>
                setCodeInput(event.target.value.toUpperCase().slice(0, 6))
              }
              autoComplete="off"
              maxLength={6}
            />
            <button type="submit" disabled={isCodeLoading || codeInput.length < 4}>
              {isCodeLoading ? "Preparing…" : "Download"}
            </button>
          </div>
        </form>

        <p className="notice subtle">
          Files stay hidden until a valid code is entered. Only the exact code holder
          can download.
        </p>
      </section>
    </>
  );
}

