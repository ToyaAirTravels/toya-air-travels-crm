import { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  CreditCard,
  FileCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Plane,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminUsersView } from './components/AdminUsersView';
import { DocumentsVaultView } from './components/DocumentsVaultView';
import { OverviewReportsView } from './components/OverviewReportsView';
import { PassengerDetailView } from './components/PassengerDetailView';
import { PassengerRegistrationForm } from './components/PassengerRegistrationForm';
import { PaymentsWorkspace } from './components/PaymentsWorkspace';
import { ServicesWorkspace } from './components/ServicesWorkspace';
import { SignInView } from './components/SignInView';
import type {
  AppModule,
  DashboardStats,
  PassengerFullRecord,
  PassengerSummary,
} from './types';

function WorkspaceShell() {
  const { user, adminProfile, loading, signOut, apiFetch } = useAuth();

  const [activeModule, setActiveModule] = useState<AppModule>('register');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [passengers, setPassengers] = useState<PassengerSummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Selected passenger dossier or edit target
  const [selectedDossier, setSelectedDossier] =
    useState<PassengerFullRecord | null>(null);
  const [editingRecord, setEditingRecord] =
    useState<PassengerFullRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PassengerSummary | null>(
    null
  );

  const loadWorkspaceData = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setGlobalError(null);
    try {
      const [pList, statsData] = await Promise.all([
        apiFetch<PassengerSummary[]>('/api/passengers'),
        apiFetch<DashboardStats>('/api/dashboard/stats'),
      ]);
      setPassengers(pList);
      setStats(statsData);
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to load agency records.'
      );
    } finally {
      setDataLoading(false);
    }
  }, [user, apiFetch]);

  useEffect(() => {
    if (user && adminProfile) {
      loadWorkspaceData();
    }
  }, [user, adminProfile, loadWorkspaceData]);

  const openPassengerDossier = async (passengerId: number) => {
    setGlobalError(null);
    try {
      const record = await apiFetch<PassengerFullRecord>(
        `/api/passengers/${passengerId}`
      );
      setSelectedDossier(record);
      setEditingRecord(null);
      setActiveModule('directory');
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to load passenger dossier.'
      );
    }
  };

  const openPassengerEdit = async (passengerId: number) => {
    setGlobalError(null);
    try {
      const record = await apiFetch<PassengerFullRecord>(
        `/api/passengers/${passengerId}`
      );
      setEditingRecord(record);
      setSelectedDossier(null);
      setActiveModule('register');
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to load passenger for editing.'
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/passengers/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      await loadWorkspaceData();
    } catch (err: unknown) {
      setGlobalError(
        err instanceof Error ? err.message : 'Failed to delete passenger.'
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Verifying session...
      </div>
    );
  }

  if (!user || !adminProfile) {
    return <SignInView />;
  }

  const navItems: {
    id: AppModule;
    label: string;
    icon: typeof LayoutDashboard;
  }[] = [
    { id: 'register', label: 'Registration Form', icon: UserPlus },
    { id: 'overview', label: 'Overview & Reports', icon: LayoutDashboard },
    { id: 'directory', label: 'Passenger Directory', icon: Users },
    { id: 'services', label: 'Passenger Services', icon: Briefcase },
    { id: 'payments', label: 'Payments & Receipts', icon: CreditCard },
    { id: 'documents', label: 'Document Vault', icon: FileCheck },
    { id: 'admin', label: 'Admin Accounts', icon: ShieldCheck },
  ];

  const moduleTitleMap: Record<AppModule, string> = {
    register: editingRecord
      ? `Edit Profile / ${editingRecord.passenger.fullName}`
      : 'Passenger Registration Form',
    overview: 'Passenger History & Reports',
    directory: selectedDossier
      ? `Passenger Directory / ${selectedDossier.passenger.fullName}`
      : 'Passenger Directory',
    services: 'Passenger Services Processing',
    payments: 'Payment Management & Receipts',
    documents: 'Documents Management',
    admin: 'Admin & Staff Accounts',
  };

  const navigateTo = (mod: AppModule) => {
    setActiveModule(mod);
    setSelectedDossier(null);
    if (mod !== 'register') {
      setEditingRecord(null);
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Navigation Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 flex flex-col transition-transform lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white">
              <Plane className="h-4 w-4" />
            </div>
            <span className="truncate font-display text-sm font-bold tracking-wide text-white whitespace-nowrap">
              TOYA AIR TRAVELS
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4 space-y-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">
              {adminProfile.fullName || adminProfile.email}
            </p>
            <p className="truncate text-[11px] text-slate-400">
              {adminProfile.email} · {adminProfile.role}
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on Left, Single Primary Action on Right */}
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="truncate text-sm font-medium text-slate-600">
              Toya Air Travels <span className="mx-1.5 text-slate-300">/</span>
              <span className="text-slate-900 font-semibold">
                {moduleTitleMap[activeModule]}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingRecord(null);
                setSelectedDossier(null);
                setActiveModule('register');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              New Passenger
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8">
          {globalError && (
            <div className="no-print mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {globalError}
            </div>
          )}

          {activeModule === 'register' && (
            <PassengerRegistrationForm
              editingRecord={editingRecord}
              onSuccess={async (saved) => {
                await loadWorkspaceData();
                setEditingRecord(null);
                setSelectedDossier(saved);
                setActiveModule('directory');
              }}
              onCancelEdit={
                editingRecord
                  ? () => {
                      setEditingRecord(null);
                      setActiveModule('directory');
                    }
                  : undefined
              }
            />
          )}

          {(activeModule === 'overview' ||
            (activeModule === 'directory' && !selectedDossier)) && (
            <OverviewReportsView
              mode={activeModule === 'overview' ? 'overview' : 'directory'}
              stats={stats}
              passengers={passengers}
              loading={dataLoading}
              onNewPassenger={() => {
                setEditingRecord(null);
                setActiveModule('register');
              }}
              onViewPassenger={openPassengerDossier}
              onEditPassenger={openPassengerEdit}
              onDeletePassenger={(p) => setDeleteTarget(p)}
            />
          )}

          {activeModule === 'directory' && selectedDossier && (
            <PassengerDetailView
              record={selectedDossier}
              onBack={() => setSelectedDossier(null)}
              onEdit={(rec) => {
                setEditingRecord(rec);
                setSelectedDossier(null);
                setActiveModule('register');
              }}
              onRefresh={async (passengerId) => {
                const updated = await apiFetch<PassengerFullRecord>(
                  `/api/passengers/${passengerId}`
                );
                setSelectedDossier(updated);
                await loadWorkspaceData();
              }}
            />
          )}

          {activeModule === 'services' && (
            <ServicesWorkspace
              passengers={passengers}
              onOpenPassenger={openPassengerDossier}
            />
          )}

          {activeModule === 'payments' && (
            <PaymentsWorkspace onOpenPassenger={openPassengerDossier} />
          )}

          {activeModule === 'documents' && (
            <DocumentsVaultView
              passengers={passengers}
              onOpenPassengerDocs={openPassengerDossier}
            />
          )}

          {activeModule === 'admin' && <AdminUsersView />}
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm passenger deletion"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Delete Passenger Record?
            </h3>
            <p className="text-sm text-slate-600">
              This will permanently remove{' '}
              <span className="font-semibold text-slate-900">
                {deleteTarget.fullName}
              </span>{' '}
              (<span className="font-mono">{deleteTarget.passengerIdNumber}</span>)
              along with their family contacts, uploaded documents, services, and
              payment records.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceShell />
    </AuthProvider>
  );
}
