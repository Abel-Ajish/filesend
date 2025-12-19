"use client";

import { useState } from "react";
import { UploadIcon } from "./Icons";

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
    if (selectedFiles.length === 0) return;
    await uploadFiles(selectedFiles);
    setSelectedFiles([]);
  }

  return (
    <div className="flow-panel">
      <button onClick={onBack} className="back-button">← Back</button>

      {shareCode && !selectedFiles.length && !isUploading ? (
        <div className="share-result">
          <p className="share-label">Your code is ready:</p>
          <div className="code-display">{shareCode}</div>
          <div className="file-actions">
            <button className="secondary-button" onClick={() => copyCode(shareCode)}>Copy Code</button>
            <button className="primary-button" onClick={() => copyLink(shareCode)}>Copy Link</button>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`drop-zone ${isDragging ? "drag-active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <label className="file-input">
              <input type="file" multiple disabled={isUploading} onChange={handleFileSelect} />
              <div className="drop-icon"><UploadIcon /></div>
              <p>{isDragging ? "Drop to upload!" : "Drag & drop files or click to select"}</p>
              <small>Max 50MB per file</small>
            </label>
          </div>

          {selectedFiles.length > 0 && (
            <div className="file-list">
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="file-item">
                  <span>{file.name}</span>
                  <button onClick={() => removeFile(index)} disabled={isUploading}>✕</button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={startUpload}
            disabled={isUploading || selectedFiles.length === 0}
            className="primary-button"
          >
            {isUploading ? `Uploading... ${uploadProgress}%` : `Upload ${selectedFiles.length} file(s)`}
          </button>

          {isUploading && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
