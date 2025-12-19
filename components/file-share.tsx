"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import QRCode from "qrcode";
import Image from "next/image";
import { P2PManager } from "@/lib/p2p";
import { uploadSignal, checkSignal, generateShareCode } from "@/lib/appwrite";
import { Toast, SharedFile } from "@/lib/types";
import { SunIcon, MoonIcon, QrCodeIcon } from "./Icons";

const ModeSelector = dynamic(() => import("./ModeSelector"));
const SendFlow = dynamic(() => import("./SendFlow"));
const ReceiveFlow = dynamic(() => import("./ReceiveFlow"));

export default function FileShare() {
  const [mode, setMode] = useState<"send" | "receive" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [receivedFiles, setReceivedFiles] = useState<SharedFile[]>([]);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [isWaitingForFiles, setIsWaitingForFiles] = useState(false);
  const [isCodeLoading, setIsCodeLoading] = useState(false);

  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const p2pManager = useRef<P2PManager | null>(null);
  const sessionPollTimer = useRef<NodeJS.Timeout | null>(null);
  const downloadedFileIds = useRef<Set<string>>(new Set());
  const isFetching = useRef(false);
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code");
    const sessionParam = params.get("session");
    if (sessionParam) {
      setMode("send");
      setShareCode(sessionParam);
      notify(`Connected to session ${sessionParam}`, "success");
    } else if (codeParam) {
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

  async function uploadFiles(files: File[]) {
    if (!navigator.onLine) return notify("You are offline.", "error");

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return notify(`File "${file.name}" is too large (Max 50MB).`, "error");
      }
    }

    setIsUploading(true);
    setUploadProgress(0);
    let currentCode: string | null = shareCode;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);
      if (currentCode) formData.append("code", currentCode);

      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/files");
        await new Promise<void>((resolve, reject) => {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const totalProgress = ((i + e.loaded / e.total) / files.length) * 100;
              setUploadProgress(Math.round(totalProgress));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const payload = JSON.parse(xhr.responseText);
              if (!currentCode) currentCode = payload.code;
              resolve();
            } else {
              reject(new Error(JSON.parse(xhr.responseText || "{}").error || "Upload failed"));
            }
          };
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(formData);
        });
      } catch (error) {
        console.error(`Failed to upload ${file.name}`, error);
        setIsUploading(false);
        return notify(`Failed to upload ${file.name}.`, "error");
      }
    }

    setIsUploading(false);
    if (currentCode) {
      setShareCode(currentCode);
      notify(`Files uploaded to ${currentCode}.`, "success");
    }
  }

  async function handleCodeDownload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!navigator.onLine) return notify("You are offline.", "error");
    const trimmed = codeInput.trim().toUpperCase();
    if (trimmed.length < 4) return notify("Enter the 6-character code.", "error");
    await fetchAndDownloadFiles(trimmed);
  }

  async function fetchAndDownloadFiles(code: string, suppressErrors = false) {
    if (isFetching.current) return;
    isFetching.current = true;
    setIsCodeLoading(true);

    try {
      const response = await fetch(`/api/code/${code}`);
      const payload = await response.json().catch(() => ({}));

      if (!isMounted.current) return;
      if (!response.ok) {
        if (!suppressErrors) notify(payload.error || "Code not found.", "error");
        return;
      }

      const files = payload.files as SharedFile[];
      const newFiles = files.filter(f => !downloadedFileIds.current.has(`${code}-${f.name}-${f.size}`));

      if (newFiles.length > 0) {
        setReceivedFiles(prev => [...prev, ...newFiles]);
        newFiles.forEach(file => downloadedFileIds.current.add(`${code}-${file.name}-${file.size}`));

        if (!isWaitingForFiles) {
          setCodeInput("");
          notify(`Found ${newFiles.length} files.`, "success");
        } else {
            notify(`Received ${newFiles.length} new files!`, "success");
        }
      }
    } catch (error) {
      if (!suppressErrors) notify((error as Error).message, "error");
    } finally {
      if (isMounted.current) setIsCodeLoading(false);
      isFetching.current = false;
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      notify("Code copied!", "success");
    } catch {
      notify("Could not copy code.", "error");
    }
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}?code=${code}`);
      notify("Link copied!", "success");
    } catch {
      notify("Could not copy link.", "error");
    }
  }

  async function generateQRCode() {
    try {
      const qrDataUrl = await QRCode.toDataURL(window.location.origin, {
        width: 256, margin: 2,
        color: {
          dark: theme === 'dark' ? '#FFFFFF' : '#000000',
          light: '#00000000'
        }
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
      const url = `${window.location.origin}?session=${code}`;
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256, margin: 2,
        color: {
          dark: theme === 'dark' ? '#FFFFFF' : '#000000',
          light: '#00000000'
        }
      });
      setQrCodeUrl(qrDataUrl);

      sessionPollTimer.current = setInterval(() => {
        fetchAndDownloadFiles(code, true);
      }, 3000);
    } catch (error) {
      notify("Failed to start session.", "error");
      stopReceiveSession();
    }
  }

  function stopReceiveSession() {
    if (sessionPollTimer.current) clearInterval(sessionPollTimer.current);
    setIsWaitingForFiles(false);
    setSessionCode(null);
  }

  function resetToHome() {
    setMode(null);
    setShareCode(null);
    setCodeInput("");
    setReceivedFiles([]);
    stopReceiveSession();
    const url = new URL(window.location.href);
    url.searchParams.delete("session");
    url.searchParams.delete("code");
    window.history.replaceState({}, "", url.toString());
  }

  return (
    <div className="container">
      <div className="header-actions">
        <button className="icon-button" onClick={toggleTheme} aria-label="Toggle theme" data-testid="theme-toggle">
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
        <button className="icon-button" onClick={generateQRCode} aria-label="Show QR code">
          <QrCodeIcon />
        </button>
      </div>

      <div className="glass-panel">
        <div className="hero-content">
          <h1 className="title">Local Share</h1>
          <p className="subtitle">Secure, ephemeral file sharing.</p>
        </div>

        {!mode && <ModeSelector onSelect={setMode} />}

        {mode === "send" && (
          <SendFlow
            onBack={resetToHome}
            shareCode={shareCode}
            uploadFiles={uploadFiles}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            copyCode={copyCode}
            copyLink={copyLink}
          />
        )}

        {mode === "receive" && (
          <ReceiveFlow
            onBack={resetToHome}
            isWaitingForFiles={isWaitingForFiles}
            startReceiveSession={startReceiveSession}
            stopReceiveSession={stopReceiveSession}
            qrCodeUrl={qrCodeUrl}
            sessionCode={sessionCode}
            handleCodeDownload={handleCodeDownload}
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            isCodeLoading={isCodeLoading}
            receivedFiles={receivedFiles}
          />
        )}
      </div>

      {toast && <div className={`toast toast-${toast.tone}`}>{toast.text}</div>}

      {showQR && (
        <div className="modal-backdrop" onClick={() => setShowQR(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Scan to Visit</h3>
            <div className="qr-code-wrapper">
              <Image src={qrCodeUrl} alt="QR Code" width={256} height={256} unoptimized />
            </div>
            <button className="secondary-button" onClick={() => setShowQR(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
