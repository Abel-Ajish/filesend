"use client";

import { UploadIcon, DownloadIcon } from "./Icons";

type ModeSelectorProps = {
  onSelect: (mode: "send" | "receive") => void;
};

export default function ModeSelector({ onSelect }: ModeSelectorProps) {
  return (
    <div className="mode-selector">
      <button className="mode-card" onClick={() => onSelect("send")}>
        <div className="mode-icon-wrapper">
          <UploadIcon className="mode-icon" />
        </div>
        <h3>Send</h3>
        <p>Create a shareable link for your files</p>
      </button>
      <div className="card-divider" />
      <button className="mode-card" onClick={() => onSelect("receive")}>
        <div className="mode-icon-wrapper">
          <DownloadIcon className="mode-icon" />
        </div>
        <h3>Receive</h3>
        <p>Download files with a code or QR</p>
      </button>
    </div>
  );
}
