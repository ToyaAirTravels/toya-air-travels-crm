import { Printer, X } from 'lucide-react';
import { formatCurrency } from '../lib/fileUtils';
import type { PaymentWithDetails } from '../types';

interface PaymentReceiptModalProps {
  receipt: PaymentWithDetails | null;
  onClose: () => void;
}

export function PaymentReceiptModal({
  receipt,
  onClose,
}: PaymentReceiptModalProps) {
  if (!receipt) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Payment Receipt"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white overflow-hidden print-container">
        <div className="no-print flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-base font-semibold text-slate-900">
            Official Payment Receipt
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              Print Receipt
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Close receipt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                TOYA AIR TRAVELS
              </h2>
              <p className="text-xs text-slate-500">
                Passenger Services & Aviation Travel Agency
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-500">Receipt No.</p>
              <p className="font-mono text-sm font-semibold text-slate-900">
                {receipt.receiptNumber}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Passenger Name</p>
              <p className="font-medium text-slate-900">
                {receipt.passenger?.fullName || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Passenger ID</p>
              <p className="font-mono text-slate-900">
                {receipt.passenger?.passengerIdNumber || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Passport Number</p>
              <p className="font-mono text-slate-900">
                {receipt.passenger?.passportNumber || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Payment Date</p>
              <p className="font-mono text-slate-900">{receipt.paymentDate}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Service</span>
              <span className="font-medium text-slate-900">
                {receipt.service?.serviceType || 'Agency Service'}
                {receipt.service?.destinationCountry
                  ? ` · ${receipt.service.destinationCountry}`
                  : ''}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-600">Payment Method</span>
              <span className="font-medium text-slate-900">
                {receipt.paymentMethod}
              </span>
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                Amount Received
              </span>
              <span className="font-mono text-lg font-bold text-emerald-700">
                {formatCurrency(
                  receipt.amount,
                  receipt.service?.currency || 'BDT'
                )}
              </span>
            </div>
          </div>

          {receipt.notes && (
            <div className="text-xs text-slate-600">
              <span className="font-medium text-slate-700">Notes: </span>
              {receipt.notes}
            </div>
          )}

          <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Recorded by: {receipt.recordedByEmail || 'Agency Staff'}</span>
            <span>Authorized Signature</span>
          </div>
        </div>
      </div>
    </div>
  );
}
