import { useState } from 'react';
import { FileText, FolderOpen, Search } from 'lucide-react';
import type { PassengerSummary } from '../types';

interface DocumentsVaultViewProps {
  passengers: PassengerSummary[];
  onOpenPassengerDocs: (passengerId: number) => void;
}

export function DocumentsVaultView({
  passengers,
  onOpenPassengerDocs,
}: DocumentsVaultViewProps) {
  const [search, setSearch] = useState('');

  const filtered = passengers.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.passengerIdNumber.toLowerCase().includes(q) ||
      (p.passportNumber || '').toLowerCase().includes(q) ||
      (p.selectedDocumentCategories || []).some((c) =>
        c.toLowerCase().includes(q)
      )
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Documents Management Vault
        </h2>
        <p className="text-sm text-slate-500">
          Passport copies, NID cards, birth certificates, visas, air tickets,
          medicals, BMET, PDO, and clearance files (PDF, JPG, JPEG, PNG).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by passenger name, ID, passport, or document type..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No passenger document folders found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">Passenger</th>
                  <th className="py-3 px-4">Selected Categories</th>
                  <th className="py-3 px-4 text-right">Uploaded Files</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{p.fullName}</p>
                      <p className="font-mono text-xs text-slate-500">
                        {p.passengerIdNumber}
                        {p.passportNumber ? ` · ${p.passportNumber}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-md">
                      {p.selectedDocumentCategories &&
                      p.selectedDocumentCategories.length > 0 ? (
                        <span>
                          {p.selectedDocumentCategories.join(' · ')}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          No categories checked
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        {p.documentCount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOpenPassengerDocs(p.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Manage Files
                      </button>
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
