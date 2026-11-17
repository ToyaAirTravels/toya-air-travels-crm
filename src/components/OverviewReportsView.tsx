import { useState } from 'react';
import {
  Download,
  Edit3,
  Eye,
  FileDown,
  Plus,
  Printer,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadCsv } from '../lib/fileUtils';
import {
  generatePassengerDossierPdf,
  triggerBlobDownload,
} from '../lib/pdfExport';
import type {
  DashboardStats,
  PassengerFullRecord,
  PassengerSummary,
} from '../types';

interface OverviewReportsViewProps {
  mode: 'overview' | 'directory';
  stats: DashboardStats | null;
  passengers: PassengerSummary[];
  loading: boolean;
  onNewPassenger: () => void;
  onViewPassenger: (id: number) => void;
  onEditPassenger: (id: number) => void;
  onDeletePassenger: (passenger: PassengerSummary) => void;
}

export function OverviewReportsView({
  mode,
  stats,
  passengers,
  loading,
  onNewPassenger,
  onViewPassenger,
  onEditPassenger,
  onDeletePassenger,
}: OverviewReportsViewProps) {
  const { apiFetch } = useAuth();
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'due' | 'active'>('all');
  const [exportingId, setExportingId] = useState<number | null>(null);

  const handleRowExportPdf = async (passenger: PassengerSummary) => {
    setExportingId(passenger.id);
    try {
      const full = await apiFetch<PassengerFullRecord>(
        `/api/passengers/${passenger.id}`
      );
      const bytes = await generatePassengerDossierPdf(full);
      triggerBlobDownload(
        bytes,
        `TOYA-Dossier-${passenger.passengerIdNumber}.pdf`
      );
    } catch (err) {
      console.error('Export PDF failed:', err);
    } finally {
      setExportingId(null);
    }
  };

  const filtered = passengers.filter((p) => {
    if (filterMode === 'due' && p.dueAmount <= 0) return false;
    if (filterMode === 'active' && p.serviceCount === 0) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.passengerIdNumber.toLowerCase().includes(q) ||
      (p.passportNumber || '').toLowerCase().includes(q) ||
      (p.nidNumber || '').toLowerCase().includes(q) ||
      (p.mobileNumber || '').toLowerCase().includes(q)
    );
  });

  const handleExportCsv = () => {
    downloadCsv(
      filtered.map((p) => ({
        PassengerID: p.passengerIdNumber,
        FullName: p.fullName,
        DateOfBirth: p.dateOfBirth,
        Sex: p.sex,
        Nationality: p.nationality,
        PassportNumber: p.passportNumber || '',
        NIDNumber: p.nidNumber || '',
        BirthRegNumber: p.birthRegistrationNumber || '',
        Mobile: p.mobileNumber || '',
        WhatsApp: p.whatsappNumber || '',
        Address: p.presentAddress || '',
        Services: p.serviceCount,
        Documents: p.documentCount,
        TotalCharge: p.totalCharge,
        TotalPaid: p.totalPaid,
        DueAmount: p.dueAmount,
      })),
      `toya-passengers-report-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="space-y-6 print-container">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            {mode === 'overview'
              ? 'Passenger History & Operational Reports'
              : 'Passenger Directory'}
          </h2>
          <p className="text-sm text-slate-500">
            Search, inspect, edit, print dossiers, and export passenger records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </button>
          <button
            type="button"
            onClick={onNewPassenger}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Register Passenger
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip (shown in Overview mode) */}
      {mode === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">
              Registered Passengers
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {stats?.totalPassengers ?? passengers.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {stats?.totalDocuments ?? 0} documents archived
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">
              Active Services
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {stats?.activeServices ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {stats?.totalServices ?? 0} total services logged
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">
              Total Payments Collected
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
              {(stats?.totalCollected ?? 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Of {(stats?.totalRevenueBilled ?? 0).toLocaleString()} billed
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">
              Outstanding Due Balance
            </p>
            <p
              className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
                (stats?.totalDue ?? 0) > 0 ? 'text-red-700' : 'text-slate-900'
              }`}
            >
              {(stats?.totalDue ?? 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Across all active services
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="no-print rounded-xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Name, Passenger ID, Passport, NID, or Mobile..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'All Passengers' },
              { id: 'due', label: 'With Due Balance' },
              { id: 'active', label: 'With Services' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterMode(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filterMode === f.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Passenger Records Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-10 w-full animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900">
              {passengers.length === 0
                ? 'No passengers registered yet'
                : 'No passengers match your search criteria'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {passengers.length === 0
                ? 'Register your first passenger to begin tracking family contacts, documents, services, and payments.'
                : 'Try clearing the search box or changing the filter tab.'}
            </p>
            {passengers.length === 0 && (
              <button
                type="button"
                onClick={onNewPassenger}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                <Plus className="h-4 w-4" />
                Register First Passenger
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Passenger</th>
                  <th className="py-3 px-4">Passport / NID</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Services</th>
                  <th className="py-3 px-4 text-right">Docs</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Due</th>
                  <th className="no-print py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                          {p.passportPhotoData ? (
                            <img
                              src={p.passportPhotoData}
                              alt={p.fullName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-4 w-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onViewPassenger(p.id)}
                            className="font-medium text-slate-900 hover:text-blue-700 text-left truncate block"
                          >
                            {p.fullName}
                          </button>
                          <p className="font-mono text-xs text-slate-500">
                            {p.passengerIdNumber} · {p.sex}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono text-xs text-slate-900">
                        {p.passportNumber || 'No Passport'}
                      </p>
                      <p className="font-mono text-xs text-slate-500">
                        {p.nidNumber ? `NID: ${p.nidNumber}` : '—'}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono text-xs text-slate-900">
                        {p.mobileNumber || '—'}
                      </p>
                      <p className="text-xs text-slate-500 truncate max-w-[180px]">
                        {p.emergencyContactSummary
                          ? `Emg: ${p.emergencyContactSummary.contactName}`
                          : p.nationality}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {p.serviceCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {p.documentCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-medium text-emerald-700 tabular-nums">
                      {p.totalPaid.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums ${
                        p.dueAmount > 0 ? 'text-red-700' : 'text-slate-700'
                      }`}
                    >
                      {p.dueAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="no-print py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onViewPassenger(p.id)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                          title="Open Passenger Dossier"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Dossier
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRowExportPdf(p)}
                          disabled={exportingId === p.id}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap"
                          title="Export Dossier PDF"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          {exportingId === p.id ? '...' : 'PDF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditPassenger(p.id)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Edit Passenger"
                          aria-label="Edit passenger"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePassenger(p)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete Passenger"
                          aria-label="Delete passenger"
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
    </div>
  );
}
