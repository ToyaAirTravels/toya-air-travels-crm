import { Plane, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function SignInView() {
  const { signInWithGoogle, authError } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Plane className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              TOYA AIR TRAVELS
            </h1>
            <p className="text-xs text-slate-500">
              Passenger Registration & Agency Management
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-6">
          <h2 className="text-base font-semibold text-slate-900">
            Authorized Staff Sign-In
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            Sign in with your authorized Google account to manage passenger profiles,
            travel documents, service workflows, and payment receipts.
          </p>

          {authError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={signInWithGoogle}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
            Sign in with Google
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Protected agency portal · Role-verified staff access
        </p>
      </div>
    </div>
  );
}
