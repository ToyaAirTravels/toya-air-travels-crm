import { useEffect, useState } from 'react';
import { Download, FileText, Printer, X } from 'lucide-react';
import { formatFileSize } from '../lib/fileUtils';
import {
  generateCombinedDocumentsPacketPdf,
  triggerBlobDownload,
} from '../lib/pdfExport';
import type { PassengerDocumentFull } from '../types';

interface PrintAllDocumentsModalProps {
  open: boolean;
  loading: boolean;
  passengerName: string;
  passengerIdNumber: string;
  documents: PassengerDocumentFull[];
  onClose: () => void;
}

export function PrintAllDocumentsModal({
  open,
  loading,
  passengerName,
  passengerIdNumber,
  documents,
  onClose,
}: PrintAllDocumentsModalProps) {
  const [combinedPdfUrl, setCombinedPdfUrl] = useState<string | null>(null);
  const [combinedBytes, setCombinedBytes] = useState<Uint8Array | null>(null);
  const [buildingPacket, setBuildingPacket] = useState(false);

  useEffect(() => {
    let activeUrl: string | null = null;

    if (!open || documents.length === 0) {
      setCombinedPdfUrl(null);
      setCombinedBytes(null);
      return;
    }

    const build = async () => {
      setBuildingPacket(true);
      try {
        const bytes = await generateCombinedDocumentsPacketPdf(
          passengerName,
          passengerIdNumber,
          documents
        );
        const copy = new Uint8Array(bytes);
        const blob = new Blob([copy.buffer], { type: 'application/pdf' });
        activeUrl = URL.createObjectURL(blob);
        setCombinedBytes(bytes);
        setCombinedPdfUrl(activeUrl);
      } catch (err) {
        console.error('Failed to build combined document packet:', err);
      } finally {
        setBuildingPacket(false);
      }
    };

    build();

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [open, documents, passengerName, passengerIdNumber]);

  if (!open) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPacket = () => {
    if (combinedBytes) {
      triggerBlobDownload(
        combinedBytes,
        `TOYA-Documents-${passengerIdNumber}.pdf`
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Print All Passenger Documents"
    >
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-slate-200 bg-white overflow-hidden print-container">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              All Passenger Documents — {passengerName}
            </h3>
            <p className="font-mono text-xs text-slate-500">
              {passengerIdNumber} · {documents.length} document(s) archived
            </p>
          </div>

          <div className="flex items-center gap-2">
            {combinedBytes && (
              <button
                type="button"
                onClick={handleDownloadPacket}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Download Combined PDF
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || documents.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              Print All Documents
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close documents packet"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-100 p-6 space-y-6">
          {loading || buildingPacket ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-600">
              Preparing all passenger documents from cloud storage...
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-600">
              No documents have been saved to cloud storage for this passenger yet.
            </div>
          ) : (
            <>
              {/* Combined PDF Packet Preview (best for mixed PDFs + Images) */}
              {combinedPdfUrl && (
                <div className="no-print rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <div className="border-b border-slate-100 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">
                      Combined Printable Packet ({documents.length} files)
                    </span>
                    <span>Ready for Print or PDF Export</span>
                  </div>
                  <iframe
                    src={combinedPdfUrl}
                    title="Combined Passenger Documents Packet"
                    className="h-[520px] w-full bg-white"
                  />
                </div>
              )}

              {/* Individual Document Sheets for direct browser window.print() */}
              <div className="space-y-6">
                {documents.map((doc, idx) => {
                  const isPdf =
                    doc.mimeType === 'application/pdf' ||
                    doc.fileName.toLowerCase().endsWith('.pdf');
                  return (
                    <div
                      key={doc.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 break-inside-avoid"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-700" />
                          <span className="text-sm font-semibold text-slate-900">
                            {idx + 1}. {doc.category} — {doc.fileName}
                          </span>
                        </div>
                        <span className="font-mono text-xs text-slate-500">
                          {formatFileSize(doc.fileSize)}
                        </span>
                      </div>
                      {isPdf ? (
                        <iframe
                          src={doc.fileData}
                          title={doc.fileName}
                          className="h-[560px] w-full rounded border border-slate-200"
                        />
                      ) : (
                        <div className="flex justify-center">
                          <img
                            src={doc.fileData}
                            alt={doc.fileName}
                            referrerPolicy="no-referrer"
                            className="max-h-[680px] max-w-full rounded border border-slate-200 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
