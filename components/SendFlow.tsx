"use client";

import { useState } from "react";

type SendFlowProps = {
  onBack: () => void;
  shareCode: string | null;
  uploadFiles: (files: File[]) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
  copyCode: (code: string) => void;
  copyLink: (code: string) => void;
};

export default function SendFlow({
  onBack,
  shareCode,
  uploadFiles,
  isUploading,
  uploadProgress,
  copyCode,
  copyLink,
}: SendFlowProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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

  async function startUpload() {
    if (selectedFiles.length === 0) {
      // This should be handled by the parent component's notify function
      return;
    }
    await uploadFiles(selectedFiles);
    setSelectedFiles([]);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Send</h2>
        <button type="button" className="back-button" onClick={onBack}>
          ← Back
        </button>
      </div>
      <p>Choose any file — we&apos;ll instantly create a shareable download link.</p>

      {shareCode && !selectedFiles.length && !isUploading ? (
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
  );
}
