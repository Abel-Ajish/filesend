"use client";

import { UploadIcon, DownloadIcon } from "./Icons";

type ModeSelectorProps = {
  onSelect: (mode: "send" | "receive") => void;
};

export default function ModeSelector({ onSelect }: ModeSelectorProps) {
  return (
    <div className="mode-selection">
      <h2>What would you like to do?</h2>
      <div className="mode-options">
        <button className="mode-card" onClick={() => onSelect("send")}>
          <div className="mode-icon"><UploadIcon /></div>
          <h3>Send</h3>
          <p>Upload a file and get a shareable code</p>
        </button>
        <button className="mode-card" onClick={() => onSelect("receive")}>
          <div className="mode-icon"><DownloadIcon /></div>
          <h3>Receive</h3>
          <p>Enter a code or scan to download</p>
        </button>
      </div>
    </div>
  );
}
