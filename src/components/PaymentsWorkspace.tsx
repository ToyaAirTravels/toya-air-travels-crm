import React, { useEffect, useState } from 'react';
import { Download, Plus, Printer, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadCsv, formatCurrency } from '../lib/fileUtils';
import { PAYMENT_METHODS } from '../types';
import type { PassengerService, PaymentWithDetails } from '../types';
import { PaymentReceiptModal } from './PaymentReceiptModal';

interface PaymentsWorkspaceProps {
  onOpenPassenger: (passengerId: number) => void;
}

export function PaymentsWorkspace({ onOpenPassenger }: PaymentsWorkspaceProps) {
  const { apiFetch } = useAuth();
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [services, setServices] = useState<PassengerService[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Record payment form
  const [showRecord, setShowRecord] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [activeReceipt, setActiveReceipt] = useState<PaymentWithDetails | null>(
    null
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [payData, svcData] = await Promise.all([
        apiFetch<PaymentWithDetails[]>('/api/payments'),
        apiFetch<PassengerService[]>('/api/services'),
      ]);
      setPayments(payData);
      setServices(svcData);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to load payment records.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServiceId) {
      setErrorMsg('Please select a passenger service.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiFetch(`/api/services/${selectedServiceId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          paymentMethod,
          paymentDate,
          notes,
        }),
      });
      setShowRecord(false);
      setAmount('');
      setNotes('');
      await loadData();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to record payment.'
      );
    } finally {
      setSaving(false);
    }
  };

  const totalChargeAll = services.reduce((s, x) => s + x.totalCharge, 0);
  const totalPaidAll = services.reduce((s, x) => s + x.totalPaid, 0);
  const totalDueAll = services.reduce((s, x) => s + x.dueAmount, 0);

  const filtered = payments.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.receiptNumber.toLowerCase().includes(q) ||
      (p.passenger?.fullName || '').toLowerCase().includes(q) ||
      (p.passenger?.passengerIdNumber || '').toLowerCase().includes(q) ||
      (p.service?.serviceType || '').toLowerCase().includes(q) ||
      p.paymentMethod.toLowerCase().includes(q)
    );
  });

  const handleExportCsv = () => {
    downloadCsv(
      filtered.map((p) => ({
        ReceiptNumber: p.receiptNumber,
        PaymentDate: p.paymentDate,
        PassengerID: p.passenger?.passengerIdNumber || '',
        PassengerName: p.passenger?.fullName || '',
        Service: p.service?.serviceType || '',
        Method: p.paymentMethod,
        Currency: p.service?.currency || 'BDT',
        Amount: p.amount,
        Notes: p.notes || '',
      })),
      `toya-payments-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Payment Management &amp; Receipts
          </h2>
          <p className="text-sm text-slate-500">
            Track total charges, paid amounts, due balances, and official
            payment receipts.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            onClick={() => setShowRecord((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Financial Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Total Billed Across Services
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {totalChargeAll.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Total Paid Amount
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {totalPaidAll.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Total Outstanding Due
          </p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-red-700 tabular-nums">
            {totalDueAll.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {showRecord && (
        <form
          onSubmit={handleRecordPayment}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <h3 className="text-sm font-semibold text-slate-900">
            Record Service Payment
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Passenger Service <span className="text-red-600">*</span>
              </label>
              <select
                required
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select passenger service...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.passenger?.passengerIdNumber} · {s.passenger?.fullName} —{' '}
                    {s.serviceType} (Due: {s.currency}{' '}
                    {s.dueAmount.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
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
              <label className="block text-xs font-medium text-slate-700 mb-1">
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
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Transaction ID, bank reference, or remarks"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRecord(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {saving ? 'Recording...' : 'Save Payment Receipt'}
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt number, passenger name, ID, or method..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Receipts Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading payment ledger...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-900">
              No payment receipts recorded yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Record a payment against a passenger service to generate receipts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Receipt No.</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Passenger</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900">
                      {p.receiptNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {p.paymentDate}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onOpenPassenger(p.passengerId)}
                        className="text-left group"
                      >
                        <p className="font-medium text-slate-900 group-hover:text-blue-700">
                          {p.passenger?.fullName || `Passenger #${p.passengerId}`}
                        </p>
                        <p className="font-mono text-xs text-slate-500">
                          {p.passenger?.passengerIdNumber || '—'}
                        </p>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {p.service?.serviceType || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {p.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                      {formatCurrency(p.amount, p.service?.currency || 'BDT')}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveReceipt(p)}
                        className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PaymentReceiptModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />
    </div>
  );
}
