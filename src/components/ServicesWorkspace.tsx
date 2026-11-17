import React, { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/fileUtils';
import {
  CURRENCIES,
  SERVICE_STATUSES,
  SERVICE_TYPES,
} from '../types';
import type { PassengerService, PassengerSummary } from '../types';

interface ServicesWorkspaceProps {
  passengers: PassengerSummary[];
  onOpenPassenger: (passengerId: number) => void;
}

export function ServicesWorkspace({
  passengers,
  onOpenPassenger,
}: ServicesWorkspaceProps) {
  const { apiFetch } = useAuth();
  const [services, setServices] = useState<PassengerService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add service modal/panel
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPassengerId, setSelectedPassengerId] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>(SERVICE_TYPES[0]);
  const [destinationCountry, setDestinationCountry] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [totalCharge, setTotalCharge] = useState('');
  const [currency, setCurrency] = useState<string>('BDT');
  const [processingStatus, setProcessingStatus] = useState<string>('Pending');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline quick status update
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nextStatus, setNextStatus] = useState('Pending');
  const [updateNote, setUpdateNote] = useState('');

  const loadServices = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<PassengerService[]>('/api/services');
      setServices(data);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to load services.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPassengerId) {
      setErrorMsg('Please select a passenger.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiFetch(`/api/passengers/${selectedPassengerId}/services`, {
        method: 'POST',
        body: JSON.stringify({
          serviceType,
          destinationCountry,
          referenceNumber,
          processingStatus,
          totalCharge: Number(totalCharge || 0),
          currency,
          serviceDate: new Date().toISOString().slice(0, 10),
          remarks,
        }),
      });
      setShowCreate(false);
      setDestinationCountry('');
      setReferenceNumber('');
      setTotalCharge('');
      setRemarks('');
      await loadServices();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to create service.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStatus = async (serviceId: number) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/services/${serviceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          processingStatus: nextStatus,
          updateNote,
        }),
      });
      setEditingId(null);
      setUpdateNote('');
      await loadServices();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to update status.'
      );
    }
  };

  const filtered = services.filter((s) => {
    if (statusFilter !== 'All' && s.processingStatus !== statusFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.serviceType.toLowerCase().includes(q) ||
      (s.destinationCountry || '').toLowerCase().includes(q) ||
      (s.referenceNumber || '').toLowerCase().includes(q) ||
      (s.passenger?.fullName || '').toLowerCase().includes(q) ||
      (s.passenger?.passengerIdNumber || '').toLowerCase().includes(q) ||
      (s.passenger?.passportNumber || '').toLowerCase().includes(q)
    );
  });

  const statusColor = (status: string) => {
    if (status === 'Completed' || status === 'Approved') return 'text-emerald-700';
    if (status === 'Cancelled' || status === 'On Hold') return 'text-red-700';
    return 'text-amber-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Passenger Services Processing
          </h2>
          <p className="text-sm text-slate-500">
            Visa processing, work permits, air tickets, medicals, BMET, and PDO
            training with independent status tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Assign New Service
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreateService}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            Assign Service to Passenger
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Passenger <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={selectedPassengerId}
                onChange={(e) => setSelectedPassengerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select passenger...</option>
                {passengers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.passengerIdNumber} — {p.fullName}
                    {p.passportNumber ? ` (${p.passportNumber})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Service Type
              </label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
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
                Processing Status
              </label>
              <select
                value={processingStatus}
                onChange={(e) => setProcessingStatus(e.target.value)}
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
                Destination Country
              </label>
              <input
                type="text"
                value={destinationCountry}
                onChange={(e) => setDestinationCountry(e.target.value)}
                placeholder="e.g. Saudi Arabia"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reference No.
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Tracking / Visa ref"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              />
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
                value={totalCharge}
                onChange={(e) => setTotalCharge(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Service instructions or remarks"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Create Service'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Status Filter */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by passenger, ID, passport, service, or ref..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {['All', 'Pending', 'In Progress', 'Submitted', 'Approved', 'Completed'].map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            )
          )}
        </div>
      </div>

      {/* Services Data Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading passenger services...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-900">
              No passenger services match your filter
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Assign a service to a passenger to begin processing and billing.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Passenger</th>
                  <th className="py-3 px-4">Service &amp; Destination</th>
                  <th className="py-3 px-4">Ref No.</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Charge</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <React.Fragment key={s.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => onOpenPassenger(s.passengerId)}
                          className="text-left group"
                        >
                          <p className="font-medium text-slate-900 group-hover:text-blue-700">
                            {s.passenger?.fullName || `Passenger #${s.passengerId}`}
                          </p>
                          <p className="font-mono text-xs text-slate-500">
                            {s.passenger?.passengerIdNumber || '—'}
                          </p>
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">
                          {s.serviceType}
                        </p>
                        <p className="text-xs text-slate-500">
                          {s.destinationCountry || '—'}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">
                        {s.referenceNumber || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold ${statusColor(
                            s.processingStatus
                          )}`}
                        >
                          {s.processingStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-900 tabular-nums">
                        {formatCurrency(s.totalCharge, s.currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-emerald-700 tabular-nums">
                        {formatCurrency(s.totalPaid, s.currency)}
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums ${
                          s.dueAmount > 0 ? 'text-red-700' : 'text-slate-700'
                        }`}
                      >
                        {formatCurrency(s.dueAmount, s.currency)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(editingId === s.id ? null : s.id);
                              setNextStatus(s.processingStatus);
                            }}
                            className="rounded px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenPassenger(s.passengerId)}
                            className="rounded px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                          >
                            Dossier
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingId === s.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <select
                              value={nextStatus}
                              onChange={(e) => setNextStatus(e.target.value)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                            >
                              {SERVICE_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={updateNote}
                              onChange={(e) => setUpdateNote(e.target.value)}
                              placeholder="Enter status update note..."
                              className="flex-1 min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveStatus(s.id)}
                              className="rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800"
                            >
                              Save Update
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
