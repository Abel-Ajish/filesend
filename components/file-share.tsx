"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import QRCode from "qrcode";

type Toast = {
  text: string;
  tone: "info" | "success" | "error";
};

export default function FileShare() {
  const [mode, setMode] = useState<"send" | "receive" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isCodeLoading, setIsCodeLoading] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
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

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  function toggleTheme() {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  }

  function notify(text: string, tone: Toast["tone"] = "info") {
    setToast({ text, tone });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }

  function uploadFile(file: File) {
    setIsUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const payload = JSON.parse(xhr.responseText);
        setShareCode(payload.code ?? null);
        notify(
          `Share code ${payload.code ?? ""} ready. Link expires in 1 minute.`,
          "success"
        );
      } else {
        const payload = JSON.parse(xhr.responseText || "{}");
        notify(payload.error || "Upload failed.", "error");
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      notify("Upload failed.", "error");
    };

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
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

    uploadFile(file);
    form.reset();
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

  async function generateQRCode() {
    try {
      const websiteUrl = "https://fileshare-pi.vercel.app/";
      const qrDataUrl = await QRCode.toDataURL(websiteUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrCodeUrl(qrDataUrl);
      setShowQR(true);
    } catch (error) {
      notify("Failed to generate QR code.", "error");
    }
  }

  return (
    <>
      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle Theme"
      >
        {theme === "light" ? "🌙" : "☀️"}
      </button>

      <button
        type="button"
        className="qr-floating-button"
        onClick={generateQRCode}
        aria-label="Show QR Code"
      >
        📱
      </button>

      <div className="hero">
        <div>
          <h1>Local Share</h1>
          <p>Drop files, hand off the link, and we&apos;ll tidy up in 60 seconds.</p>
          <small>Runs entirely on your network using Secure Cloud to ensure seamless transfer of files.</small>
        </div>
        <div className="pill">Auto delete · 1 min</div>
      </div>
      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      {/* Mode Selection Screen */}
      {!mode && (
        <div className="mode-selection">
          <h2>What would you like to do?</h2>
          <div className="mode-options">
            <button
              className="mode-card"
              onClick={() => setMode("send")}
            >
              <div className="mode-icon">📤</div>
              <h3>Send</h3>
              <p>Upload a file and get a shareable code</p>
            </button>
            <button
              className="mode-card"
              onClick={() => setMode("receive")}
            >
              <div className="mode-icon">📥</div>
              <h3>Receive</h3>
              <p>Enter a code to download a file</p>
            </button>
          </div>
        </div>
      )}

      {/* Send Panel */}
      {mode === "send" && (
        <section className="panel">
          <div className="panel-header">
            <h2>Send</h2>
            <button
              type="button"
              className="back-button"
              onClick={() => {
                setMode(null);
                setShareCode(null);
              }}
            >
              ← Back
            </button>
          </div>
          <p>Choose any file — we&apos;ll instantly create a shareable download link.</p>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <form onSubmit={handleUpload} encType="multipart/form-data">
              <label className={`file-input ${isDragging ? "drag-active" : ""}`}>
                <input
                  type="file"
                  name="file"
                  required
                  aria-label="Upload file"
                  disabled={isUploading}
                />
                <span>
                  {isUploading
                    ? `Uploading… ${uploadProgress}%`
                    : isDragging
                      ? "Drop file here!"
                      : "Choose file or drag & drop"}
                </span>
              </label>
              <button type="submit" disabled={isUploading}>
                {isUploading ? "Sending…" : "Upload"}
              </button>
            </form>
            {isUploading && (
              <div className="progress-container">
                <div
                  className="progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
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
      )}

      {/* Receive Panel */}
      {mode === "receive" && (
        <section className="panel">
          <div className="panel-header">
            <h2>Receive</h2>
            <button
              type="button"
              className="back-button"
              onClick={() => {
                setMode(null);
                setCodeInput("");
              }}
            >
              ← Back
            </button>
          </div>
          <p>Type your code to Download the file.</p>

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
      )}

      {showQR && (
        <div className="qr-modal" onClick={() => setShowQR(false)}>
          <div className="qr-content" onClick={(e) => e.stopPropagation()}>
            <h3>Scan to Visit Website</h3>
            <img src={qrCodeUrl} alt="QR Code for website" />
            <p>Scan this QR code to access the file sharing website on other devices.</p>
            <button type="button" onClick={() => setShowQR(false)}>
              Close
            </button>
          </div>
        </div>
      )}
      <div className="creator-credit">Created by Abel A</div>
    </>
  );
}
