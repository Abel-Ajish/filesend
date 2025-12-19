"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import QRCode from "qrcode";
import Image from "next/image";
import { P2PManager } from "@/lib/p2p";
import { uploadSignal, checkSignal, generateShareCode } from "@/lib/appwrite";
import { Toast, SharedFile } from "@/lib/types";
import { SunIcon, MoonIcon, QrCodeIcon } from "./Icons";

// Dynamically import the new components to reduce initial bundle size
const ModeSelector = dynamic(() => import("./ModeSelector"));
const SendFlow = dynamic(() => import("./SendFlow"));
const ReceiveFlow = dynamic(() => import("./ReceiveFlow"));

export default function FileShare() {
  const [mode, setMode] = useState<"send" | "receive" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [receivedFiles, setReceivedFiles] = useState<SharedFile[]>([]);
  const [isP2PConnected, setIsP2PConnected] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number; filename: string } | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [isWaitingForFiles, setIsWaitingForFiles] = useState(false);
  const [isCodeLoading, setIsCodeLoading] = useState(false);

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
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
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

  useEffect(() => {
    return () => {
      p2pManager.current?.close();
      if (sessionPollTimer.current) clearInterval(sessionPollTimer.current);
    };
  }, []);

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

  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  async function startP2PHost(code: string, files: File[]) {
    p2pFilesToSend.current = files;
    p2pManager.current = new P2PManager(
      () => setIsP2PConnected(true),
      () => {},
      () => setIsP2PConnected(false)
    );

    try {
      const offer = await p2pManager.current.createOffer();
      await uploadSignal(code, "HOST", offer);

      const pollInterval = setInterval(async () => {
        if (!p2pManager.current) return clearInterval(pollInterval);
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

  async function uploadFiles(files: File[]) {
    if (!navigator.onLine) return notify("You are offline.", "error");

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return notify(`File "${file.name}" is too large (Max 50MB).`, "error");
      }
    }

    setIsUploading(true);
    setUploadProgress(0);

    const targetCode = shareCode;
    let currentCode: string | null = targetCode;

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
      startP2PHost(currentCode, files);
      notify(`Files uploaded to ${currentCode}.`, "success");
    }
  }

  async function startP2PPeer(code: string) {
    try {
      const offerStr = await checkSignal(code, "HOST");
      if (!offerStr) return;

      p2pManager.current = new P2PManager(
        () => setIsP2PConnected(true),
        (data) => { /* Handle incoming P2P data */ },
        () => setIsP2PConnected(false)
      );

      const answer = await p2pManager.current.createAnswer(offerStr);
      await uploadSignal(code, "PEER", answer);
    } catch (error) {
      console.error("P2P Peer Error", error);
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

    if (!isP2PConnected) startP2PPeer(code);

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

        if (isWaitingForFiles) {
          notify(`Received ${newFiles.length} new files!`, "success");
        } else {
          setCodeInput("");
          notify(`Found ${newFiles.length} files.`, "success");
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
      notify("Code copied.", "success");
    } catch {
      notify("Could not copy code.", "error");
    }
  }

  function getShareLink(code: string) {
    return `${window.location.origin}?code=${code}`;
  }

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(getShareLink(code));
      notify("Link copied.", "success");
    } catch {
      notify("Could not copy link.", "error");
    }
  }

  async function generateQRCode() {
    try {
      const qrDataUrl = await QRCode.toDataURL(window.location.origin, {
        width: 256, margin: 2
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
      const qrDataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2 });
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
    sessionPollTimer.current = null;
    setIsWaitingForFiles(false);
    setSessionCode(null);
    setReceivedFiles([]);
    downloadedFileIds.current.clear();
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
    <>
      <div className="header-actions">
        <button type="button" className="theme-toggle" onClick={toggleTheme}>
          {theme === "light" ? <MoonIcon /> : <SunIcon />}
        </button>
        <button type="button" className="qr-button" onClick={generateQRCode}>
          <QrCodeIcon />
        </button>
      </div>

      <div className="hero-section">
        <h1>Local Share</h1>
        <p>Drop files, hand off the link, and we&apos;ll tidy up in 60 seconds.</p>
      </div>

      {toast && (
        <div className={`toast toast-${toast.tone}`}>{toast.text}</div>
      )}

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
          downloadProgress={downloadProgress}
        />
      )}

      {showQR && (
        <div className="qr-modal" onClick={() => setShowQR(false)}>
          <div className="qr-content" onClick={(e) => e.stopPropagation()}>
            <h3>Scan to Visit Website</h3>
            <Image src={qrCodeUrl} alt="QR Code" width={256} height={256} unoptimized />
            <p>Scan this QR code to access the site on other devices.</p>
            <button type="button" onClick={() => setShowQR(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
