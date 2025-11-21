"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import QRCode from "qrcode";
import { P2PManager } from "@/lib/p2p";
import { uploadSignal, checkSignal } from "@/lib/appwrite";

type Toast = {
  text: string;
  tone: "info" | "success" | "error";
};

type SharedFile = {
  id: string;
  code: string | null;
  name: string;
  size: number;
  sizeLabel: string;
  type: string;
  url: string;
  expiresAt: string | null;
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
  const [receivedFiles, setReceivedFiles] = useState<SharedFile[]>([]);
  const [isP2PConnected, setIsP2PConnected] = useState(false);

  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const p2pManager = useRef<P2PManager | null>(null);
  const p2pFilesToSend = useRef<File[]>([]);

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

  // Cleanup P2P on unmount
  useEffect(() => {
    return () => {
      if (p2pManager.current) {
        p2pManager.current.close();
      }
    };
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
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleUploadFiles(droppedFiles);
    }
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  async function startP2PHost(code: string, files: File[]) {
    p2pFilesToSend.current = files;

    p2pManager.current = new P2PManager(
      () => {
        setIsP2PConnected(true);
        // Connected! Send files.
        sendP2PFiles();
      },
      (data) => {
        // Host receiving data? Not implemented for this flow.
      },
      () => {
        setIsP2PConnected(false);
      }
    );

    try {
      const offer = await p2pManager.current.createOffer();
      await uploadSignal(code, "HOST", offer);

      // Poll for answer
      const pollInterval = setInterval(async () => {
        if (!p2pManager.current) {
          clearInterval(pollInterval);
          return;
        }
        const answer = await checkSignal(code, "PEER");
        if (answer) {
          clearInterval(pollInterval);
          await p2pManager.current.setAnswer(answer);
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);

    } catch (error) {
      console.error("P2P Host Error", error);
    }
  }

  async function sendP2PFiles() {
    if (!p2pManager.current) return;

    const CHUNK_SIZE = 16 * 1024; // 16KB safe chunk size

    for (const file of p2pFilesToSend.current) {
      // Send metadata
      const metadata = JSON.stringify({
        type: "metadata",
        file: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      });
      p2pManager.current.send(metadata);

      // Send file content in chunks
      const buffer = await file.arrayBuffer();
      let offset = 0;
      while (offset < buffer.byteLength) {
        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        p2pManager.current.send(chunk);
        offset += CHUNK_SIZE;
      }
    }
  }

  async function uploadFiles(files: File[]) {
    if (!navigator.onLine) {
      notify("You are offline. Please check your connection.", "error");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setShareCode(null);

    let currentCode: string | null = null;
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    let bandwidthError = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      if (currentCode) {
        formData.append("code", currentCode);
      }

      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/files");

        await new Promise<void>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const currentFileProgress = e.loaded / e.total;
              const totalProgress = ((i + currentFileProgress) / files.length) * 100;
              setUploadProgress(Math.round(totalProgress));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const payload = JSON.parse(xhr.responseText);
              if (!currentCode) {
                currentCode = payload.code;
              }
              resolve();
            } else {
              const response = JSON.parse(xhr.responseText || "{}");
              if (xhr.status === 500 || xhr.status === 507 || response.error?.toLowerCase().includes("storage")) {
                bandwidthError = true;
              }
              reject(new Error(response.error || "Upload failed"));
            }
          };

          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(formData);
        });
        successCount++;
      } catch (error) {
        failCount++;
        errors.push(`${file.name}: ${(error as Error).message}`);
        console.error(`Failed to upload ${file.name}`, error);
      }
    }

    setIsUploading(false);

    if (bandwidthError) {
      notify("Unable to share files due to bandwidth limits.", "error");
      return;
    }

    if (successCount > 0 && currentCode) {
      setShareCode(currentCode);

      // Start P2P Host
      startP2PHost(currentCode, files);

      if (failCount > 0) {
        notify(
          `Uploaded ${successCount} files. ${failCount} failed.`,
          "info"
        );
      } else {
        notify(
          `Share code ${currentCode} ready. Link expires in 1 minute.`,
          "success"
        );
      }
    } else {
      notify(
        `Failed to upload files. ${errors[0] || "Unknown error"}`,
        "error"
      );
    }
  }

  async function handleUploadFiles(files: File[]) {
    // Check file sizes
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        notify(`File "${file.name}" is too large (Max 50MB).`, "error");
        return;
      }
    }
    uploadFiles(files);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const files = formData.getAll("file").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      notify("Please choose at least one file to upload.", "error");
      return;
    }

    handleUploadFiles(files);
    form.reset();
  }

  async function startP2PPeer(code: string) {
    try {
      const offerStr = await checkSignal(code, "HOST");
      if (!offerStr) return; // No P2P host available

      let incomingMetadata: { name: string; size: number; type: string } | null = null;
      let receivedChunks: ArrayBuffer[] = [];
      let receivedBytes = 0;

      p2pManager.current = new P2PManager(
        () => {
          setIsP2PConnected(true);
        },
        (data) => {
          if (typeof data === "string") {
            try {
              const json = JSON.parse(data);
              if (json.type === "metadata") {
                incomingMetadata = json.file;
                receivedChunks = [];
                receivedBytes = 0;
              }
            } catch { }
            return;
          }

          if (data instanceof ArrayBuffer && incomingMetadata) {
            receivedChunks.push(data);
            receivedBytes += data.byteLength;

            if (receivedBytes >= incomingMetadata.size) {
              const blob = new Blob(receivedChunks, { type: incomingMetadata.type });
              const url = URL.createObjectURL(blob);

              const a = document.createElement("a");
              a.href = url;
              a.download = incomingMetadata.name;
              a.click();

              incomingMetadata = null;
              receivedChunks = [];
              receivedBytes = 0;
            }
          }
        },
        () => {
          setIsP2PConnected(false);
        }
      );

      const answer = await p2pManager.current.createAnswer(offerStr);
      await uploadSignal(code, "PEER", answer);

    } catch (error) {
      console.error("P2P Peer Error", error);
    }
  }

  async function handleCodeDownload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) {
      notify("You are offline. Please check your connection.", "error");
      return;
    }
    const trimmed = codeInput.trim().toUpperCase();
    if (trimmed.length < 4) {
      notify("Enter the 6-character code.", "error");
      return;
    }
    setIsCodeLoading(true);

    // Try to start P2P first/parallel
    startP2PPeer(trimmed);

    try {
      const response = await fetch(`/api/code/${trimmed}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(payload.error || "Code not found.", "error");
        return;
      }

      const files = payload.files as SharedFile[];
      setReceivedFiles(files);
      setCodeInput("");

      if (files.length === 1) {
        notify(`Downloading ${files[0].name}...`, "success");
        window.open(files[0].url, "_blank", "noopener");
      } else {
        notify(`Found ${files.length} files.`, "success");
      }

    } catch (error) {
      notify((error as Error).message, "error");
    } finally {
      setIsCodeLoading(false);
    }
  }

  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; filename: string } | null>(null);

  async function downloadAll() {
    if (receivedFiles.length === 0) return;

    const total = receivedFiles.length;
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      const file = receivedFiles[i];
      setDownloadProgress({ current: i + 1, total, filename: file.name });

      try {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error("Download failed");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Small delay to ensure browser handles the download action
        await new Promise(resolve => setTimeout(resolve, 500));
        URL.revokeObjectURL(url);
        successCount++;
      } catch (error) {
        console.error(`Failed to download ${file.name}`, error);
        notify(`Failed to download ${file.name}`, "error");
      }
    }

    setDownloadProgress(null);
    if (successCount === total) {
      notify("All files downloaded successfully!", "success");
    } else {
      notify(`Downloaded ${successCount} of ${total} files.`, "info");
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");
    if (codeParam) {
      setMode("receive");
      setCodeInput(codeParam);
    }
  }, []);

  function getShareLink(code: string) {
    return `${window.location.origin}?code=${code}`;
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(getShareLink(code));
      notify("Link copied to clipboard.", "success");
    } catch {
      notify("Unable to copy link.", "error");
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
                  multiple
                  aria-label="Upload files"
                  disabled={isUploading}
                />
                <span>
                  {isUploading
                    ? `Uploading… ${uploadProgress}%`
                    : isDragging
                      ? "Drop files here!"
                      : "Choose files or drag & drop"}
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
              <div className="file-actions">
                <button type="button" className="ghost" onClick={() => copyCode(shareCode)}>
                  Copy Code
                </button>
                <button type="button" onClick={() => copyLink(shareCode)}>
                  Copy Link
                </button>
              </div>
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
                {isCodeLoading ? "Checking…" : "Download"}
              </button>
            </div>
          </form>

          {receivedFiles.length > 0 && (
            <div className="file-list-container">
              <h3>Files ({receivedFiles.length})</h3>
              <ul className="file-list">
                {receivedFiles.map((file) => (
                  <li key={file.id} className="file-row">
                    <div>
                      <strong>{file.name}</strong>
                      <span>{file.sizeLabel}</span>
                    </div>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pill"
                      download
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
              {receivedFiles.length > 1 && (
                <button
                  type="button"
                  className="action-link"
                  style={{ width: "100%", marginTop: "1rem" }}
                  onClick={downloadAll}
                  disabled={!!downloadProgress}
                >
                  {downloadProgress
                    ? `Downloading ${downloadProgress.current}/${downloadProgress.total}...`
                    : `Download All (${receivedFiles.length})`}
                </button>
              )}
              {downloadProgress && (
                <div className="progress-container" style={{ marginTop: "0.5rem" }}>
                  <div
                    className="progress-fill"
                    style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                  />
                  <small style={{ display: "block", textAlign: "center", marginTop: "4px" }}>
                    {downloadProgress.filename}
                  </small>
                </div>
              )}
            </div>
          )}

          {receivedFiles.length === 0 && (
            <p className="notice subtle">
              Files stay hidden until a valid code is entered. Only the exact code holder
              can download.
            </p>
          )}
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
      <div
        className="creator-credit"
        style={isP2PConnected ? {
          color: "#4ade80",
          textShadow: "0 0 10px #4ade80",
          fontWeight: "bold",
          transition: "all 0.5s ease"
        } : {}}
      >
        Created by Abel A
      </div>
    </>
  );
}
