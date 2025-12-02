"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { P2PManager } from "@/lib/p2p";
import { uploadSignal, checkSignal, generateShareCode } from "@/lib/appwrite";

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; filename: string } | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [isWaitingForFiles, setIsWaitingForFiles] = useState(false);
  const [isSessionSender, setIsSessionSender] = useState(false);

  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const p2pManager = useRef<P2PManager | null>(null);
  const p2pFilesToSend = useRef<File[]>([]);
  const sessionPollTimer = useRef<NodeJS.Timeout | null>(null);
  const downloadedFileIds = useRef<Set<string>>(new Set());
  const isFetching = useRef(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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

  // Cleanup P2P and timers on unmount
  useEffect(() => {
    return () => {
      if (p2pManager.current) {
        p2pManager.current.close();
      }
      if (sessionPollTimer.current) {
        clearInterval(sessionPollTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");
    const sessionParam = params.get("session");

    if (sessionParam) {
      // Sender mode via QR scan
      setMode("send");
      setShareCode(sessionParam); // Pre-set the code
      setIsSessionSender(true);
      notify(`Connected to session ${sessionParam}`, "success");
    } else if (codeParam) {
      // Receiver mode via link (legacy)
      setMode("receive");
      setCodeInput(codeParam);
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
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }

  function addFiles(files: File[]) {
    setSelectedFiles((prev) => [...prev, ...files]);
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  async function startP2PHost(code: string, files: File[]) {
    p2pFilesToSend.current = files;

    p2pManager.current = new P2PManager(
      () => {
        setIsP2PConnected(true);
        sendP2PFiles();
      },
      (data) => { },
      () => {
        setIsP2PConnected(false);
      }
    );

    try {
      const offer = await p2pManager.current.createOffer();
      await uploadSignal(code, "HOST", offer);

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

      setTimeout(() => clearInterval(pollInterval), 120000);

    } catch (error) {
      console.error("P2P Host Error", error);
    }
  }

  async function sendP2PFiles() {
    if (!p2pManager.current) return;

    const CHUNK_SIZE = 16 * 1024;

    for (const file of p2pFilesToSend.current) {
      const metadata = JSON.stringify({
        type: "metadata",
        file: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      });
      p2pManager.current.send(metadata);

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

    // If we already have a shareCode (from session), use it. Otherwise reset it.
    // But wait, if we are in a session, we want to KEEP the code.
    // If we are NOT in a session, we want to generate a new one (or let server do it).
    // The server generates code if we don't send one.

    // Logic:
    // If shareCode is set (via session param), use it.
    // If not, let server generate.

    const targetCode = shareCode;

    // If we are NOT in a session, we might want to clear the old code to generate a new one for a new batch.
    // But if we are in a session, we want to append to the existing session code.
    // For now, let's assume if shareCode is present, we use it.

    let currentCode: string | null = targetCode;
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
      setSelectedFiles([]);
      startP2PHost(currentCode, files);

      if (failCount > 0) {
        notify(`Uploaded ${successCount} files. ${failCount} failed.`, "info");
      } else {
        notify(`Files uploaded to ${currentCode}.`, "success");
      }
    } else {
      notify(`Failed to upload files. ${errors[0] || "Unknown error"}`, "error");
    }
  }

  async function handleUploadFiles(files: File[]) {
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        notify(`File "${file.name}" is too large (Max 50MB).`, "error");
        return;
      }
    }
    uploadFiles(files);
  }

  async function startUpload() {
    if (selectedFiles.length === 0) {
      notify("Please choose at least one file to upload.", "error");
      return;
    }
    await handleUploadFiles(selectedFiles);
  }

  async function startP2PPeer(code: string) {
    try {
      const offerStr = await checkSignal(code, "HOST");
      if (!offerStr) return;

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
    await fetchAndDownloadFiles(trimmed);
  }

  async function fetchAndDownloadFiles(code: string, suppressErrors = false) {
    if (isFetching.current) return false;
    isFetching.current = true;
    setIsCodeLoading(true);

    if (!isP2PConnected) {
      startP2PPeer(code);
    }

    try {
      const response = await fetch(`/api/code/${code}`);
      const payload = await response.json().catch(() => ({}));

      if (!isMounted.current) return false;

      if (!response.ok) {
        if (!suppressErrors) {
          notify(payload.error || "Code not found.", "error");
        }
        return false;
      }

      const files = payload.files as SharedFile[];
      console.log(`[FETCH] Fetched ${files.length} files for code ${code}:`, files.map(f => f.name));

      // Create a unique key for each file using code + name + size to prevent duplicates
      const newFiles = files.filter(f => {
        const fileKey = `${code}-${f.name}-${f.size}`;
        const isNew = !downloadedFileIds.current.has(fileKey);
        return isNew;
      });

      if (newFiles.length > 0) {
        setReceivedFiles(prev => {
          const unique = [...prev];
          newFiles.forEach(nf => {
            const fileKey = `${code}-${nf.name}-${nf.size}`;
            const alreadyExists = unique.some(u => {
              const existingKey = `${code}-${u.name}-${u.size}`;
              return existingKey === fileKey;
            });
            if (!alreadyExists) {
              unique.push(nf);
            }
          });
          return unique;
        });

        // Mark all new files as "seen" so we don't process them again in the next poll
        newFiles.forEach(file => {
          const fileKey = `${code}-${file.name}-${file.size}`;
          downloadedFileIds.current.add(fileKey);
        });

        if (isWaitingForFiles) {
          // Session mode logic
          if (newFiles.length === 1) {
            // Single file -> Auto download
            const file = newFiles[0];
            console.log(`[DOWNLOAD] Auto-downloading single file: ${file.name}`);
            try {
              const a = document.createElement("a");
              a.href = file.url;
              a.download = file.name;
              a.style.display = "none";
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              notify(`Downloading ${file.name}...`, "success");
            } catch (error) {
              console.error(`[DOWNLOAD] Error downloading ${file.name}:`, error);
            }
          } else {
            // Multiple files -> Do NOT auto download, just notify
            console.log(`[DOWNLOAD] Multiple files received (${newFiles.length}), skipping auto-download`);
            notify(`Received ${newFiles.length} new files!`, "success");
          }
        } else {
          // Manual mode (legacy)
          setCodeInput("");
          if (newFiles.length === 1) {
            notify(`Downloading ${newFiles[0].name}...`, "success");
            window.open(newFiles[0].url, "_blank", "noopener");
          } else {
            notify(`Found ${newFiles.length} files.`, "success");
          }
        }
        return true;
      }
      return false;

    } catch (error) {
      if (!isMounted.current) return false;
      if (!suppressErrors) notify((error as Error).message, "error");
      return false;
    } finally {
      if (isMounted.current) {
        setIsCodeLoading(false);
      }
      isFetching.current = false;
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

  function getShareLink(code: string) {
    return `${window.location.origin}?code=${code}`;
  }

  function getSessionLink(code: string) {
    return `${window.location.origin}?session=${code}`;
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(getShareLink(code));
      notify("Link copied to clipboard.", "success");
    } catch {
      notify("Unable to copy link.", "error");
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

  async function startReceiveSession() {
    const code = generateShareCode();
    setSessionCode(code);
    setIsWaitingForFiles(true);

    try {
      const url = getSessionLink(code);
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrCodeUrl(qrDataUrl);

      // Start polling
      sessionPollTimer.current = setInterval(() => {
        fetchAndDownloadFiles(code, true);
      }, 3000);

    } catch (error) {
      notify("Failed to start session.", "error");
      setIsWaitingForFiles(false);
      setSessionCode(null);
    }
  }

  function stopReceiveSession() {
    if (sessionPollTimer.current) {
      clearInterval(sessionPollTimer.current);
      sessionPollTimer.current = null;
    }
    setIsWaitingForFiles(false);
    setSessionCode(null);
    setReceivedFiles([]);
    downloadedFileIds.current.clear();
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
      {
        toast && (
          <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
            {toast.text}
          </div>
        )
      }

      {/* Mode Selection Screen */}
      {
        !mode && (
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
                <p>Enter a code or scan to download</p>
              </button>
            </div>
          </div>
        )
      }

      {/* Send Panel */}
      {
        mode === "send" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Send</h2>
              <button
                type="button"
                className="back-button"
                onClick={() => {
                  setMode(null);
                  setShareCode(null);
                  setSelectedFiles([]);
                  setIsSessionSender(false);
                  // Clear session param from URL if present
                  const url = new URL(window.location.href);
                  if (url.searchParams.has("session")) {
                    url.searchParams.delete("session");
                    window.history.replaceState({}, "", url.toString());
                  }
                }}
              >
                ← Back
              </button>
            </div>
            <p>Choose any file — we&apos;ll instantly create a shareable download link.</p>

            {/* If shareCode is present (either from upload or session), show it, but allow adding more files if in session */}
            {shareCode && !selectedFiles.length && !isUploading && !isSessionSender ? (
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
                <button
                  type="button"
                  className="ghost"
                  style={{ marginTop: "1rem", width: "100%" }}
                  onClick={() => {
                    // Keep the code if it was a session code? 
                    // For now, let's just clear selection and allow re-upload to same code
                    setSelectedFiles([]);
                  }}
                >
                  Send More Files
                </button>
              </div>
            ) : (
              <>
                <div
                  className="drop-zone"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <label className={`file-input ${isDragging ? "drag-active" : ""}`}>
                    <input
                      type="file"
                      name="file"
                      multiple
                      aria-label="Upload files"
                      disabled={isUploading}
                      onChange={handleFileSelect}
                    />
                    <span>
                      {isDragging
                        ? "Drop files here!"
                        : "Choose files or drag & drop"}
                    </span>
                  </label>
                </div>

                {selectedFiles.length > 0 && (
                  <div className="selected-files-list">
                    <h3>Selected Files ({selectedFiles.length})</h3>
                    <ul className="file-list">
                      {selectedFiles.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="file-row pop-in">
                          <div className="file-info">
                            <strong>{file.name}</strong>
                            <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          </div>
                          <button
                            type="button"
                            className="remove-button"
                            onClick={() => removeFile(index)}
                            disabled={isUploading}
                            aria-label={`Remove ${file.name}`}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "1.2rem",
                              color: "var(--md-sys-color-on-surface)",
                              padding: "0.5rem",
                              minWidth: "auto",
                              boxShadow: "none",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "50%",
                              transition: "background 0.2s, color 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "rgba(179, 38, 30, 0.1)";
                              e.currentTarget.style.color = "var(--md-sys-color-error)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "var(--md-sys-color-on-surface)";
                            }}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  type="button"
                  onClick={startUpload}
                  disabled={isUploading || selectedFiles.length === 0}
                  className={`primary-button ${isUploading ? "pulse-active" : ""}`}
                  style={{ marginTop: "1rem", width: "100%" }}
                >
                  {isUploading ? `Uploading… ${uploadProgress}%` : shareCode ? `Upload to ${shareCode}` : "Upload Files"}
                </button>

                {isUploading && (
                  <div className="progress-container" style={{ marginTop: "1rem" }}>
                    <div
                      className="progress-fill animated"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </>
            )}
            <small className="notice subtle" style={{ marginTop: "1rem", display: "block" }}>
              Heads up: every file self-destructs one minute after you upload it.
            </small>
          </section>
        )
      }

      {/* Receive Panel */}
      {
        mode === "receive" && (
          <section className="panel">
            <div className="panel-header">
              <h2>Receive</h2>
              <button
                type="button"
                className="back-button"
                onClick={() => {
                  setMode(null);
                  setCodeInput("");
                  stopReceiveSession();
                }}
              >
                ← Back
              </button>
            </div>

            {!isWaitingForFiles ? (
              <>
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

                <div className="divider" style={{ margin: "2rem 0", textAlign: "center", opacity: 0.5 }}>OR</div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={startReceiveSession}
                  style={{ width: "100%" }}
                >
                  Generate QR to Receive
                </button>
              </>
            ) : (
              <div className="session-wait-screen" style={{ textAlign: "center" }}>
                <h3>Waiting for files...</h3>
                <p>Scan this with your phone to send files here.</p>
                <div style={{ background: "white", padding: "1rem", borderRadius: "8px", display: "inline-block", margin: "1rem 0" }}>
                  <Image src={qrCodeUrl} alt="Session QR" width={256} height={256} style={{ display: "block" }} unoptimized />
                </div>
                <div style={{ fontSize: "2rem", letterSpacing: "4px", fontWeight: "bold", margin: "1rem 0" }}>
                  {sessionCode}
                </div>
                <button type="button" className="ghost" onClick={stopReceiveSession}>
                  Cancel
                </button>
              </div>
            )}

            {receivedFiles.length > 0 && (
              <div className="file-list-container">
                <h3>Received Files ({receivedFiles.length})</h3>
                <ul className="file-list">
                  {receivedFiles.map((file) => (
                    <li key={file.id} className="file-row pop-in">
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

                {downloadProgress && (
                  <div className="progress-container" style={{ marginTop: "0.5rem" }}>
                    <div
                      className="progress-fill animated"
                      style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                    />
                    <small style={{ display: "block", textAlign: "center", marginTop: "4px" }}>
                      {downloadProgress.filename}
                    </small>
                  </div>
                )}
              </div>
            )}
          </section>
        )
      }

      {
        showQR && (
          <div className="qr-modal" onClick={() => setShowQR(false)}>
            <div className="qr-content" onClick={(e) => e.stopPropagation()}>
              <h3>Scan to Visit Website</h3>
              <Image src={qrCodeUrl} alt="QR Code for website" width={256} height={256} unoptimized />
              <p>Scan this QR code to access the file sharing website on other devices.</p>
              <button type="button" onClick={() => setShowQR(false)}>
                Close
              </button>
            </div>
          </div>
        )
      }
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
