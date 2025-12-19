"use client";

import Image from "next/image";
import { SharedFile } from "@/lib/types";

type ReceiveFlowProps = {
  onBack: () => void;
  isWaitingForFiles: boolean;
  startReceiveSession: () => void;
  stopReceiveSession: () => void;
  qrCodeUrl: string;
  sessionCode: string | null;
  handleCodeDownload: (event: React.FormEvent<HTMLFormElement>) => void;
  codeInput: string;
  setCodeInput: (value: string) => void;
  isCodeLoading: boolean;
  receivedFiles: SharedFile[];
  downloadProgress: { current: number; total: number; filename: string } | null;
};

export default function ReceiveFlow({
  onBack,
  isWaitingForFiles,
  startReceiveSession,
  stopReceiveSession,
  qrCodeUrl,
  sessionCode,
  handleCodeDownload,
  codeInput,
  setCodeInput,
  isCodeLoading,
  receivedFiles,
  downloadProgress,
}: ReceiveFlowProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Receive</h2>
        <button type="button" className="back-button" onClick={onBack}>
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

          <div className="divider">OR</div>

          <button
            type="button"
            className="secondary-button"
            onClick={startReceiveSession}
          >
            Generate QR to Receive
          </button>
        </>
      ) : (
        <div className="session-wait-screen">
          <h3>Waiting for files...</h3>
          <p>Scan this with your phone to send files here.</p>
          <div className="qr-container">
            <Image src={qrCodeUrl} alt="Session QR" width={256} height={256} unoptimized />
          </div>
          <div className="session-code">
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
            <div className="progress-container">
              <div
                className="progress-fill animated"
                style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
              />
              <small>
                {downloadProgress.filename}
              </small>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
