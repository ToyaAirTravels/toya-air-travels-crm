import { Download, FileText, X } from 'lucide-react';
import { downloadDataUrl, formatFileSize } from '../lib/fileUtils';
import type { PassengerDocumentFull } from '../types';

interface DocumentPreviewModalProps {
  document: PassengerDocumentFull | null;
  loading: boolean;
  onClose: () => void;
}

export function DocumentPreviewModal({
  document,
  loading,
  onClose,
}: DocumentPreviewModalProps) {
  if (!loading && !document) return null;

  const isPdf =
    document?.mimeType === 'application/pdf' ||
    document?.fileName.toLowerCase().endsWith('.pdf');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Document Preview"
    >
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {document ? document.fileName : 'Loading Document...'}
            </h3>
            {document && (
              <p className="mt-0.5 text-xs text-slate-500">
                {document.category} · {formatFileSize(document.fileSize)} ·{' '}
                {document.mimeType}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {document && (
              <button
                type="button"
                onClick={() => downloadDataUrl(document.fileData, document.fileName)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Close document preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
          {loading ? (
            <div className="text-sm text-slate-600">Loading document preview...</div>
          ) : document ? (
            isPdf ? (
              <iframe
                src={document.fileData}
                title={document.fileName}
                className="h-full w-full rounded-lg border border-slate-200 bg-white"
              />
            ) : (
              <img
                src={document.fileData}
                alt={document.fileName}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full rounded-lg border border-slate-200 bg-white object-contain"
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <FileText className="h-8 w-8" />
              <span className="text-sm">Document unavailable</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
