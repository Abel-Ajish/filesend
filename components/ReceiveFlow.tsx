"use client";

import Image from "next/image";
import { SharedFile } from "@/lib/types";
import { QrCodeIcon } from "./Icons";

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
}: ReceiveFlowProps) {
  return (
    <div className="flow-panel">
      <button onClick={onBack} className="back-button">← Back</button>

      {!isWaitingForFiles ? (
        <>
          <form className="code-form" onSubmit={handleCodeDownload}>
            <input
              className="code-input"
              placeholder="Enter 6-character code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase().slice(0, 6))}
              autoComplete="off"
              maxLength={6}
            />
            <button type="submit" className="primary-button" disabled={isCodeLoading || codeInput.length < 4}>
              {isCodeLoading ? "Verifying..." : "Download Files"}
            </button>
          </form>

          <div className="divider">or</div>

          <button className="secondary-button" onClick={startReceiveSession}>
            <QrCodeIcon /> Receive with QR Code
          </button>
        </>
      ) : (
        <div className="qr-session">
          <p>Scan with another device to send files here:</p>
          <div className="qr-code-wrapper">
            <Image src={qrCodeUrl} alt="Session QR Code" width={200} height={200} unoptimized />
          </div>
          <div className="session-code-display">{sessionCode}</div>
          <button className="secondary-button" onClick={stopReceiveSession}>Cancel</button>
        </div>
      )}

      {receivedFiles.length > 0 && (
        <div className="file-list received-files">
          <h3>Received Files:</h3>
          {receivedFiles.map((file) => (
            <a key={file.id} href={file.url} className="file-item" download target="_blank" rel="noopener noreferrer">
              <span>{file.name} ({file.sizeLabel})</span>
              <span>Download</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
