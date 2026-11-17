import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckSquare,
  Clock,
  CloudUpload,
  CreditCard,
  Edit3,
  Eye,
  FileDown,
  FileText,
  Plus,
  Printer,
  Save,
  Square,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  formatCurrency,
  formatFileSize,
  isSupportedDocumentFile,
  readFileAsDataUrl,
} from '../lib/fileUtils';
import {
  generatePassengerDossierPdf,
  triggerBlobDownload,
} from '../lib/pdfExport';
import {
  CURRENCIES,
  DOCUMENT_CATEGORIES,
  PAYMENT_METHODS,
  SERVICE_STATUSES,
  SERVICE_TYPES,
} from '../types';
import type {
  PassengerDocumentFull,
  PassengerFullRecord,
  PassengerService,
  PaymentWithDetails,
  PendingDocumentUpload,
} from '../types';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { PrintAllDocumentsModal } from './PrintAllDocumentsModal';

interface PassengerDetailViewProps {
  record: PassengerFullRecord;
  onBack: () => void;
  onEdit: (record: PassengerFullRecord) => void;
  onRefresh: (passengerId: number) => Promise<void>;
}

type DetailTab = 'profile' | 'documents' | 'services';

export function PassengerDetailView({
  record,
  onBack,
  onEdit,
  onRefresh,
}: PassengerDetailViewProps) {
  const { apiFetch } = useAuth();
  const {
    passenger,
    familyMembers,
    emergencyContact,
    documents,
    services,
    financialSummary,
  } = record;

  const [activeTab, setActiveTab] = useState<DetailTab>('services');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Dossier inline quick-save state (Save Passenger Record)
  const [dossierCategories, setDossierCategories] = useState<string[]>(
    passenger.selectedDocumentCategories || []
  );
  const [dossierAdditionalDocs, setDossierAdditionalDocs] = useState(
    passenger.additionalDocumentsNote || ''
  );
  const [dossierRemarks, setDossierRemarks] = useState(passenger.remarks || '');
  const [savingDossier, setSavingDossier] = useState(false);

  // Export PDF & Print All Documents state
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printAllOpen, setPrintAllOpen] = useState(false);
  const [printAllLoading, setPrintAllLoading] = useState(false);
  const [fullDocsList, setFullDocsList] = useState<PassengerDocumentFull[]>([]);

  // Document preview & staged cloud upload
  const [previewDoc, setPreviewDoc] = useState<PassengerDocumentFull | null>(
    null
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string>(
    DOCUMENT_CATEGORIES[0]
  );
  const [queuedDocs, setQueuedDocs] = useState<PendingDocumentUpload[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  // Add Service form
  const [showAddService, setShowAddService] = useState(false);
  const [newServiceType, setNewServiceType] = useState<string>(
    SERVICE_TYPES[0]
  );
  const [newDestCountry, setNewDestCountry] = useState('');
  const [newRefNumber, setNewRefNumber] = useState('');
  const [newTotalCharge, setNewTotalCharge] = useState('');
  const [newCurrency, setNewCurrency] = useState<string>('BDT');
  const [newStatus, setNewStatus] = useState<string>('Pending');
  const [newServiceDate, setNewServiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newServiceRemarks, setNewServiceRemarks] = useState('');
  const [savingService, setSavingService] = useState(false);

  // Service status update inline
  const [updatingServiceId, setUpdatingServiceId] = useState<number | null>(
    null
  );
  const [editServiceStatus, setEditServiceStatus] = useState('Pending');
  const [editServiceNote, setEditServiceNote] = useState('');

  // Payment inline form
  const [payingServiceId, setPayingServiceId] = useState<number | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Receipt modal
  const [activeReceipt, setActiveReceipt] = useState<PaymentWithDetails | null>(
    null
  );

  useEffect(() => {
    setDossierCategories(passenger.selectedDocumentCategories || []);
    setDossierAdditionalDocs(passenger.additionalDocumentsNote || '');
    setDossierRemarks(passenger.remarks || '');
  }, [passenger]);

  const handleExportPdf = async () => {
    setErrorMsg(null);
    setExportingPdf(true);
    try {
      const bytes = await generatePassengerDossierPdf(record);
      triggerBlobDownload(
        bytes,
        `TOYA-Dossier-${passenger.passengerIdNumber}.pdf`
      );
      setActionNotice(
        `Exported PDF dossier: TOYA-Dossier-${passenger.passengerIdNumber}.pdf`
      );
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to export dossier PDF.'
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const handleOpenPrintAllDocuments = async () => {
    setErrorMsg(null);
    setPrintAllOpen(true);
    setPrintAllLoading(true);
    try {
      const docs = await apiFetch<PassengerDocumentFull[]>(
        `/api/passengers/${passenger.id}/documents/full`
      );
      setFullDocsList(docs);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to load passenger documents for printing.'
      );
      setPrintAllOpen(false);
    } finally {
      setPrintAllLoading(false);
    }
  };

  const handleSavePassengerDossier = async () => {
    setErrorMsg(null);
    setSavingDossier(true);
    try {
      await apiFetch(`/api/passengers/${passenger.id}/dossier`, {
        method: 'PATCH',
        body: JSON.stringify({
          selectedDocumentCategories: dossierCategories,
          additionalDocumentsNote: dossierAdditionalDocs,
          remarks: dossierRemarks,
        }),
      });
      setActionNotice(
        `Passenger record ${passenger.passengerIdNumber} saved to cloud database.`
      );
      await onRefresh(passenger.id);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save passenger record.'
      );
    } finally {
      setSavingDossier(false);
    }
  };

  const handleViewDocument = async (docId: number) => {
    setPreviewLoading(true);
    setPreviewDoc(null);
    try {
      const full = await apiFetch<PassengerDocumentFull>(
        `/api/documents/${docId}`
      );
      setPreviewDoc(full);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to load document.'
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleStageDocuments = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setErrorMsg(null);
    const staged: PendingDocumentUpload[] = [];
    for (const file of files) {
      if (!isSupportedDocumentFile(file)) {
        setErrorMsg(
          `Unsupported file "${file.name}". Supported formats: PDF, JPG, JPEG and PNG.`
        );
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrorMsg(`File "${file.name}" exceeds the 10 MB limit.`);
        continue;
      }
      const dataUrl = await readFileAsDataUrl(file);
      staged.push({
        tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        category: uploadCategory,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileData: dataUrl,
      });
    }

    if (staged.length > 0) {
      setQueuedDocs((prev) => [...prev, ...staged]);
      if (!dossierCategories.includes(uploadCategory)) {
        setDossierCategories((prev) => [...prev, uploadCategory]);
      }
    }
    e.target.value = '';
  };

  const handleSaveDocumentsToCloud = async () => {
    if (queuedDocs.length === 0) return;
    setErrorMsg(null);
    setUploadingDocs(true);
    try {
      await apiFetch(`/api/passengers/${passenger.id}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          documents: queuedDocs.map((d) => ({
            category: d.category,
            fileName: d.fileName,
            mimeType: d.mimeType,
            fileSize: d.fileSize,
            fileData: d.fileData,
          })),
        }),
      });
      // Also sync checked categories to dossier
      await apiFetch(`/api/passengers/${passenger.id}/dossier`, {
        method: 'PATCH',
        body: JSON.stringify({
          selectedDocumentCategories: dossierCategories,
        }),
      });
      const count = queuedDocs.length;
      setQueuedDocs([]);
      setActionNotice(
        `${count} document(s) permanently saved to Cloud storage.`
      );
      await onRefresh(passenger.id);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to save documents to cloud.'
      );
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/documents/${docId}`, { method: 'DELETE' });
      await onRefresh(passenger.id);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to delete document.'
      );
    }
  };

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavingService(true);
    try {
      await apiFetch(`/api/passengers/${passenger.id}/services`, {
        method: 'POST',
        body: JSON.stringify({
          serviceType: newServiceType,
          destinationCountry: newDestCountry,
          referenceNumber: newRefNumber,
          processingStatus: newStatus,
          totalCharge: Number(newTotalCharge || 0),
          currency: newCurrency,
          serviceDate: newServiceDate,
          remarks: newServiceRemarks,
        }),
      });
      setShowAddService(false);
      setNewDestCountry('');
      setNewRefNumber('');
      setNewTotalCharge('');
      setNewServiceRemarks('');
      setActionNotice(`${newServiceType} service added.`);
      await onRefresh(passenger.id);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to create service.'
      );
    } finally {
      setSavingService(false);
    }
  };

  const handleUpdateServiceStatus = async (serviceId: number) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          processingStatus: editServiceStatus,
          updateNote: editServiceNote,
        }),
      });
      setUpdatingServiceId(null);
      setEditServiceNote('');
      setActionNotice('Service processing status updated.');
      await onRefresh(passenger.id);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to update service status.'
      );
    }
  };

  const handleDeleteService = async (serviceId: number) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/services/${serviceId}`, { method: 'DELETE' });
      await onRefresh(passenger.id);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to delete service.'
      );
    }
  };

  const handleRecordPayment = async (
    e: React.FormEvent,
    service: PassengerService
  ) => {
    e.preventDefault();
    setErrorMsg(null);
    const amt = Number(paymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setErrorMsg('Enter a valid payment amount greater than 0.');
      return;
    }
    setSavingPayment(true);
    try {
      await apiFetch(`/api/services/${service.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amt,
          paymentMethod,
          paymentDate,
          notes: paymentNotes,
        }),
      });
      setPayingServiceId(null);
      setPaymentAmount('');
      setPaymentNotes('');
      setActionNotice(
        `Payment of ${formatCurrency(amt, service.currency)} recorded.`
      );
      await onRefresh(passenger.id);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to record payment.'
      );
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/payments/${paymentId}`, { method: 'DELETE' });
      await onRefresh(passenger.id);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to delete payment.'
      );
    }
  };

  const statusTextColor = (status: string) => {
    if (status === 'Completed' || status === 'Approved')
      return 'text-emerald-700';
    if (status === 'Cancelled' || status === 'On Hold') return 'text-red-700';
    return 'text-amber-700';
  };

  const toggleDossierCategory = (cat: string) => {
    setDossierCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  return (
    <>
      {/* Interactive CRM Screen View */}
      <div className="screen-only space-y-6 max-w-6xl">
        {/* Top Bar Actions */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Directory
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSavePassengerDossier}
              disabled={savingDossier}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Save className="h-4 w-4" />
              {savingDossier ? 'Saving...' : 'Save Passenger Record'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              Print Dossier
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileDown className="h-4 w-4" />
              {exportingPdf ? 'Exporting PDF...' : 'Export PDF'}
            </button>
            <button
              type="button"
              onClick={handleOpenPrintAllDocuments}
              disabled={documents.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              Print All Documents ({documents.length})
            </button>
            <button
              type="button"
              onClick={() => onEdit(record)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Edit3 className="h-4 w-4" />
              Edit Full Profile
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="no-print rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        )}
        {actionNotice && (
          <div className="no-print rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {actionNotice}
          </div>
        )}

        {/* Passenger Header Sheet */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                {passenger.passportPhotoData ? (
                  <img
                    src={passenger.passportPhotoData}
                    alt={passenger.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-slate-400" />
                )}
              </div>
              <div>
                <p className="font-mono text-xs font-medium text-blue-700">
                  {passenger.passengerIdNumber} · Permanent Saved Dossier
                </p>
                <h2 className="mt-0.5 text-2xl font-bold text-slate-900">
                  {passenger.fullName}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span>{passenger.sex}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    DOB:{' '}
                    <span className="font-mono">{passenger.dateOfBirth}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{passenger.nationality}</span>
                  {passenger.passportNumber && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Passport:{' '}
                        <span className="font-mono font-medium text-slate-900">
                          {passenger.passportNumber}
                        </span>
                      </span>
                    </>
                  )}
                </div>
                {passenger.mobileNumber && (
                  <p className="mt-1 text-xs text-slate-600">
                    Mobile:{' '}
                    <span className="font-mono text-slate-900">
                      {passenger.mobileNumber}
                    </span>
                    {passenger.whatsappNumber && (
                      <span className="ml-3">
                        WhatsApp:{' '}
                        <span className="font-mono text-slate-900">
                          {passenger.whatsappNumber}
                        </span>
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Financial Summary Strip */}
            <div className="grid grid-cols-3 gap-6 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
              <div>
                <p className="text-xs text-slate-500">Total Charge</p>
                <p className="mt-1 font-mono text-base font-semibold text-slate-900 tabular-nums">
                  {financialSummary.totalCharge.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Paid Amount</p>
                <p className="mt-1 font-mono text-base font-semibold text-emerald-700 tabular-nums">
                  {financialSummary.totalPaid.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Due Amount</p>
                <p
                  className={`mt-1 font-mono text-base font-semibold tabular-nums ${
                    financialSummary.dueAmount > 0
                      ? 'text-red-700'
                      : 'text-slate-900'
                  }`}
                >
                  {financialSummary.dueAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="no-print mt-6 flex items-center gap-1 border-t border-slate-100 pt-4">
            {(
              [
                {
                  id: 'services',
                  label: `Services & Payments (${services.length})`,
                },
                {
                  id: 'documents',
                  label: `Documents (${documents.length})`,
                },
                {
                  id: 'profile',
                  label: 'Profile, Family & Emergency',
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Services & Payments */}
        {activeTab === 'services' && (
          <div className="space-y-6">
            <div className="no-print flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Passenger Services &amp; Independent Payments
                </h3>
                <p className="text-xs text-slate-500">
                  Each service tracks its own processing status, payment
                  history, and balance.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddService((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add Service
              </button>
            </div>

            {showAddService && (
              <form
                onSubmit={handleCreateService}
                className="no-print rounded-xl border border-slate-200 bg-white p-6 space-y-4"
              >
                <h4 className="text-sm font-semibold text-slate-900">
                  Register New Service for {passenger.fullName}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Service Type
                    </label>
                    <select
                      value={newServiceType}
                      onChange={(e) => setNewServiceType(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      {SERVICE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Destination Country
                    </label>
                    <input
                      type="text"
                      value={newDestCountry}
                      onChange={(e) => setNewDestCountry(e.target.value)}
                      placeholder="e.g. Saudi Arabia, UAE"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Reference / Tracking No.
                    </label>
                    <input
                      type="text"
                      value={newRefNumber}
                      onChange={(e) => setNewRefNumber(e.target.value)}
                      placeholder="Visa / Ticket / BMET ref"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Processing Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      {SERVICE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Total Charge
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={newTotalCharge}
                      onChange={(e) => setNewTotalCharge(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={newCurrency}
                      onChange={(e) => setNewCurrency(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Service Date
                    </label>
                    <input
                      type="date"
                      value={newServiceDate}
                      onChange={(e) => setNewServiceDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Remarks
                    </label>
                    <input
                      type="text"
                      value={newServiceRemarks}
                      onChange={(e) => setNewServiceRemarks(e.target.value)}
                      placeholder="Initial notes"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddService(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingService}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    {savingService ? 'Saving...' : 'Save Service'}
                  </button>
                </div>
              </form>
            )}

            {services.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="text-sm font-medium text-slate-900">
                  No services recorded for this passenger yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Add Visa Processing, Work Permit, Air Ticket, Medical, BMET,
                  or PDO services to track progress and payments.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-slate-900">
                            {service.serviceType}
                          </h4>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span
                            className={`text-xs font-semibold ${statusTextColor(
                              service.processingStatus
                            )}`}
                          >
                            {service.processingStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {service.destinationCountry || 'Destination N/A'}
                          {service.referenceNumber
                            ? ` · Ref: ${service.referenceNumber}`
                            : ''}
                          {service.serviceDate
                            ? ` · Date: ${service.serviceDate}`
                            : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-5 text-right">
                          <div>
                            <p className="text-[11px] text-slate-500">Charge</p>
                            <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                              {formatCurrency(
                                service.totalCharge,
                                service.currency
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-500">Paid</p>
                            <p className="font-mono text-sm font-semibold text-emerald-700 tabular-nums">
                              {formatCurrency(
                                service.totalPaid,
                                service.currency
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-500">Due</p>
                            <p
                              className={`font-mono text-sm font-semibold tabular-nums ${
                                service.dueAmount > 0
                                  ? 'text-red-700'
                                  : 'text-slate-900'
                              }`}
                            >
                              {formatCurrency(
                                service.dueAmount,
                                service.currency
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="no-print flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setUpdatingServiceId(
                                updatingServiceId === service.id
                                  ? null
                                  : service.id
                              );
                              setEditServiceStatus(service.processingStatus);
                              setPayingServiceId(null);
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                          >
                            Update Status
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPayingServiceId(
                                payingServiceId === service.id
                                  ? null
                                  : service.id
                              );
                              setUpdatingServiceId(null);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Record Payment
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteService(service.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Delete service"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Inline Status Update */}
                    {updatingServiceId === service.id && (
                      <div className="no-print rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <p className="text-xs font-semibold text-slate-800">
                          Update Service Processing Status
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <select
                            value={editServiceStatus}
                            onChange={(e) =>
                              setEditServiceStatus(e.target.value)
                            }
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          >
                            {SERVICE_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={editServiceNote}
                            onChange={(e) => setEditServiceNote(e.target.value)}
                            placeholder="Processing update note (e.g. Embassy submission completed)"
                            className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setUpdatingServiceId(null)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateServiceStatus(service.id)
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Save Status Update
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline Record Payment */}
                    {payingServiceId === service.id && (
                      <form
                        onSubmit={(e) => handleRecordPayment(e, service)}
                        className="no-print rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
                      >
                        <p className="text-xs font-semibold text-slate-800">
                          Record Payment for {service.serviceType}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Amount ({service.currency})
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              required
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Payment Method
                            </label>
                            <select
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            >
                              {PAYMENT_METHODS.map((m) => (
                                <option key={m} value={m}>
                                  {m}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Payment Date
                            </label>
                            <input
                              type="date"
                              required
                              value={paymentDate}
                              onChange={(e) => setPaymentDate(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">
                              Notes
                            </label>
                            <input
                              type="text"
                              value={paymentNotes}
                              onChange={(e) => setPaymentNotes(e.target.value)}
                              placeholder="Optional reference"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPayingServiceId(null)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={savingPayment}
                            className="rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                          >
                            {savingPayment ? 'Recording...' : 'Confirm Payment'}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Payments & History Split */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1">
                      <div>
                        <h5 className="text-xs font-semibold text-slate-700 mb-2">
                          Payment Records ({service.payments.length})
                        </h5>
                        {service.payments.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            No payments recorded yet.
                          </p>
                        ) : (
                          <div className="divide-y divide-slate-100 border-t border-slate-100">
                            {service.payments.map((pay) => (
                              <div
                                key={pay.id}
                                className="flex items-center justify-between gap-2 py-2 text-xs"
                              >
                                <div>
                                  <p className="font-mono font-medium text-slate-900">
                                    {pay.receiptNumber} ·{' '}
                                    {formatCurrency(
                                      pay.amount,
                                      service.currency
                                    )}
                                  </p>
                                  <p className="text-slate-500">
                                    {pay.paymentDate} · {pay.paymentMethod}
                                    {pay.notes ? ` · ${pay.notes}` : ''}
                                  </p>
                                </div>
                                <div className="no-print flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveReceipt({
                                        ...pay,
                                        passenger: {
                                          id: passenger.id,
                                          passengerIdNumber:
                                            passenger.passengerIdNumber,
                                          fullName: passenger.fullName,
                                          passportNumber:
                                            passenger.passportNumber,
                                          mobileNumber: passenger.mobileNumber,
                                        },
                                        service: {
                                          id: service.id,
                                          serviceType: service.serviceType,
                                          destinationCountry:
                                            service.destinationCountry,
                                          currency: service.currency,
                                          totalCharge: service.totalCharge,
                                          processingStatus:
                                            service.processingStatus,
                                        },
                                      })
                                    }
                                    className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                                  >
                                    Receipt
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePayment(pay.id)}
                                    className="rounded p-1 text-slate-400 hover:text-red-600"
                                    aria-label="Delete payment"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <h5 className="text-xs font-semibold text-slate-700 mb-2">
                          Service Processing History ({service.history.length})
                        </h5>
                        {service.history.length === 0 ? (
                          <p className="text-xs text-slate-400">
                            No history entries yet.
                          </p>
                        ) : (
                          <div className="divide-y divide-slate-100 border-t border-slate-100">
                            {service.history.map((h) => (
                              <div key={h.id} className="py-2 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-slate-900">
                                    {h.newStatus}
                                  </span>
                                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400">
                                    <Clock className="h-3 w-3" />
                                    {new Date(h.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-slate-600">
                                  {h.updateNote}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Documents Management & Cloud Save */}
        {activeTab === 'documents' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Documents Management &amp; Cloud Storage
                </h3>
                <p className="text-xs text-slate-500">
                  Supported file formats: PDF, JPG, JPEG and PNG.
                </p>
              </div>
              <div className="no-print flex flex-wrap items-center gap-2">
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  Select Files
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={handleStageDocuments}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSaveDocumentsToCloud}
                  disabled={queuedDocs.length === 0 || uploadingDocs}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                >
                  <CloudUpload className="h-3.5 w-3.5" />
                  {uploadingDocs
                    ? 'Saving to Cloud...'
                    : `Save Documents to Cloud${queuedDocs.length > 0 ? ` (${queuedDocs.length})` : ''}`}
                </button>
                <button
                  type="button"
                  onClick={handleOpenPrintAllDocuments}
                  disabled={documents.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print All Documents
                </button>
              </div>
            </div>

            {/* Queued for Cloud Save */}
            {queuedDocs.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-900">
                    Ready to Save to Cloud ({queuedDocs.length} file(s))
                  </p>
                  <button
                    type="button"
                    onClick={handleSaveDocumentsToCloud}
                    disabled={uploadingDocs}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                    {uploadingDocs ? 'Uploading...' : 'Save Documents to Cloud'}
                  </button>
                </div>
                <div className="divide-y divide-blue-100 rounded-lg border border-blue-200 bg-white">
                  {queuedDocs.map((doc) => (
                    <div
                      key={doc.tempId}
                      className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {doc.fileName}
                        </p>
                        <p className="text-slate-500">
                          {doc.category} · {formatFileSize(doc.fileSize)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setQueuedDocs((prev) =>
                            prev.filter((d) => d.tempId !== doc.tempId)
                          )
                        }
                        className="rounded p-1 text-slate-400 hover:text-red-600"
                        aria-label="Remove queued document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document Checklist + Quick Save */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-700">
                  Document Categories Checklist ({dossierCategories.length}{' '}
                  Selected)
                </p>
                <button
                  type="button"
                  onClick={handleSavePassengerDossier}
                  disabled={savingDossier}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Save className="h-3 w-3" />
                  {savingDossier ? 'Saving...' : 'Save Checklist'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {DOCUMENT_CATEGORIES.map((category) => {
                  const checked = dossierCategories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleDossierCategory(category)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                        checked
                          ? 'border-blue-600 bg-blue-50/70 text-slate-900 font-medium'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                      ) : (
                        <Square className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{category}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                No files saved to cloud storage for this passenger yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="py-2.5 pr-4">File Name</th>
                      <th className="py-2.5 pr-4">Category</th>
                      <th className="py-2.5 pr-4">Type</th>
                      <th className="py-2.5 pr-4 text-right">Size</th>
                      <th className="py-2.5 pr-4">Saved Date</th>
                      <th className="no-print py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-4 font-medium text-slate-900">
                          <span className="inline-flex items-center gap-2">
                            <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                            {doc.fileName}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-slate-700">
                          {doc.category}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">
                          {doc.mimeType}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                          {formatFileSize(doc.fileSize)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </td>
                        <td className="no-print py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleViewDocument(doc.id)}
                              className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              aria-label="Delete document"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Profile, Family & Emergency */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
              <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                Personal Identification &amp; Remarks
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">NID Number</dt>
                  <dd className="mt-0.5 font-mono text-slate-900">
                    {passenger.nidNumber || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">
                    Birth Registration Number
                  </dt>
                  <dd className="mt-0.5 font-mono text-slate-900">
                    {passenger.birthRegistrationNumber || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Passport Number</dt>
                  <dd className="mt-0.5 font-mono text-slate-900">
                    {passenger.passportNumber || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Nationality</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {passenger.nationality}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500">Present Address</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {passenger.presentAddress || '—'}
                  </dd>
                </div>
              </dl>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Additional Documents Note
                  </label>
                  <textarea
                    rows={2}
                    value={dossierAdditionalDocs}
                    onChange={(e) => setDossierAdditionalDocs(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Remarks / Notes
                  </label>
                  <textarea
                    rows={2}
                    value={dossierRemarks}
                    onChange={(e) => setDossierRemarks(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSavePassengerDossier}
                    disabled={savingDossier}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingDossier ? 'Saving...' : 'Save Passenger Record'}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                  Family Contact Information
                </h3>
                {familyMembers.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No family contacts recorded.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {familyMembers.map((f, idx) => (
                      <div
                        key={f.id ?? idx}
                        className="flex items-center justify-between py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {f.fullName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {f.relation}
                            {f.notes ? ` · ${f.notes}` : ''}
                          </p>
                        </div>
                        <span className="font-mono text-xs text-slate-700">
                          {f.mobileNumber || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                  Emergency Contact Details
                </h3>
                {!emergencyContact ? (
                  <p className="text-sm text-slate-500">
                    No emergency contact recorded.
                  </p>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                      {emergencyContact.photoData ? (
                        <img
                          src={emergencyContact.photoData}
                          alt={emergencyContact.contactName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-7 w-7 text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-slate-900">
                        {emergencyContact.contactName}
                      </p>
                      {emergencyContact.relationship && (
                        <p className="text-xs text-slate-500">
                          Relation: {emergencyContact.relationship}
                        </p>
                      )}
                      <p className="font-mono text-xs text-slate-800">
                        {emergencyContact.mobileNumber || '—'}
                      </p>
                      <p className="text-xs text-slate-600">
                        {emergencyContact.address || '—'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Complete Permanent Dossier Print Sheet (only active when no modal is open) */}
      {!printAllOpen && !activeReceipt && (
        <div className="print-dossier-sheet p-6 space-y-6 text-slate-900">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                TOYA AIR TRAVELS
              </h1>
              <p className="text-xs text-slate-600">
                PERMANENT PASSENGER DOSSIER · PASSENGER PROFILE · FAMILY ·
                EMERGENCY · DOCUMENTS · SERVICES
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-bold">
                {passenger.passengerIdNumber}
              </p>
              <p className="text-xs text-slate-500">
                Printed: {new Date().toISOString().slice(0, 10)}
              </p>
            </div>
          </div>

          {/* 01. Passenger Info */}
          <div className="flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
            <div className="flex-1 grid grid-cols-3 gap-3 text-xs">
              <div className="col-span-2">
                <p className="text-slate-500">Full Name</p>
                <p className="text-sm font-bold">{passenger.fullName}</p>
              </div>
              <div>
                <p className="text-slate-500">Passport Number</p>
                <p className="font-mono font-semibold">
                  {passenger.passportNumber || '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Date of Birth</p>
                <p className="font-mono">{passenger.dateOfBirth}</p>
              </div>
              <div>
                <p className="text-slate-500">Sex / Nationality</p>
                <p>
                  {passenger.sex} · {passenger.nationality}
                </p>
              </div>
              <div>
                <p className="text-slate-500">NID Number</p>
                <p className="font-mono">{passenger.nidNumber || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Birth Registration</p>
                <p className="font-mono">
                  {passenger.birthRegistrationNumber || '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Mobile Number</p>
                <p className="font-mono">{passenger.mobileNumber || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">WhatsApp Number</p>
                <p className="font-mono">{passenger.whatsappNumber || '—'}</p>
              </div>
              <div className="col-span-3">
                <p className="text-slate-500">Present Address</p>
                <p>{passenger.presentAddress || '—'}</p>
              </div>
            </div>
            <div className="h-28 w-24 shrink-0 overflow-hidden border border-slate-300 flex items-center justify-center">
              {passenger.passportPhotoData ? (
                <img
                  src={passenger.passportPhotoData}
                  alt={passenger.fullName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[10px] text-slate-400">No Photo</span>
              )}
            </div>
          </div>

          {/* 02. Family & 03. Emergency */}
          <div className="grid grid-cols-2 gap-6 border-b border-slate-200 pb-4 text-xs">
            <div>
              <h2 className="font-bold text-slate-900 mb-2">
                02. Family Contact Information
              </h2>
              {familyMembers.length === 0 ? (
                <p className="text-slate-500">No family contacts recorded.</p>
              ) : (
                <div className="space-y-1">
                  {familyMembers.map((f, idx) => (
                    <div key={f.id ?? idx} className="flex justify-between">
                      <span>
                        <strong>{f.relation}:</strong> {f.fullName}
                      </span>
                      <span className="font-mono">{f.mobileNumber || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="font-bold text-slate-900 mb-2">
                03. Emergency Contact Details
              </h2>
              {!emergencyContact ? (
                <p className="text-slate-500">No emergency contact recorded.</p>
              ) : (
                <div className="flex items-start gap-3">
                  {emergencyContact.photoData && (
                    <img
                      src={emergencyContact.photoData}
                      alt={emergencyContact.contactName}
                      className="h-16 w-16 shrink-0 border border-slate-300 object-cover"
                    />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-semibold">
                      {emergencyContact.contactName}
                    </p>
                    <p className="text-slate-600">
                      {emergencyContact.relationship || 'Emergency'} ·{' '}
                      <span className="font-mono">
                        {emergencyContact.mobileNumber || '—'}
                      </span>
                    </p>
                    <p className="text-slate-600">
                      {emergencyContact.address || '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 04. Documents & Remarks */}
          <div className="border-b border-slate-200 pb-4 text-xs space-y-2">
            <h2 className="font-bold text-slate-900">
              04. Documents &amp; Remarks
            </h2>
            <p>
              <strong>Selected Categories:</strong>{' '}
              {passenger.selectedDocumentCategories?.length
                ? passenger.selectedDocumentCategories.join(' · ')
                : 'None'}
            </p>
            {documents.length > 0 && (
              <p>
                <strong>Archived Files ({documents.length}):</strong>{' '}
                {documents
                  .map((d) => `${d.category} (${d.fileName})`)
                  .join(' · ')}
              </p>
            )}
            {passenger.additionalDocumentsNote && (
              <p>
                <strong>Additional Documents:</strong>{' '}
                {passenger.additionalDocumentsNote}
              </p>
            )}
            {passenger.remarks && (
              <p>
                <strong>Remarks / Notes:</strong> {passenger.remarks}
              </p>
            )}
          </div>

          {/* 05. Services & Payment Summary */}
          <div className="text-xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                05. Services &amp; Financial Ledger
              </h2>
              <p className="font-mono">
                Total: {financialSummary.totalCharge.toLocaleString()} · Paid:{' '}
                {financialSummary.totalPaid.toLocaleString()} · Due:{' '}
                {financialSummary.dueAmount.toLocaleString()}
              </p>
            </div>
            {services.length === 0 ? (
              <p className="text-slate-500">No services recorded.</p>
            ) : (
              <table className="w-full border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-1 text-left">
                      Service
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-left">
                      Ref / Dest
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-left">
                      Status
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-right">
                      Charge
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-right">
                      Paid
                    </th>
                    <th className="border border-slate-300 px-2 py-1 text-right">
                      Due
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id}>
                      <td className="border border-slate-300 px-2 py-1 font-medium">
                        {s.serviceType}
                      </td>
                      <td className="border border-slate-300 px-2 py-1">
                        {[s.destinationCountry, s.referenceNumber]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1">
                        {s.processingStatus}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                        {formatCurrency(s.totalCharge, s.currency)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                        {formatCurrency(s.totalPaid, s.currency)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                        {formatCurrency(s.dueAmount, s.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <DocumentPreviewModal
        document={previewDoc}
        loading={previewLoading}
        onClose={() => {
          setPreviewDoc(null);
          setPreviewLoading(false);
        }}
      />

      <PrintAllDocumentsModal
        open={printAllOpen}
        loading={printAllLoading}
        passengerName={passenger.fullName}
        passengerIdNumber={passenger.passengerIdNumber}
        documents={fullDocsList}
        onClose={() => {
          setPrintAllOpen(false);
          setFullDocsList([]);
        }}
      />

      <PaymentReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </>
  );
}
