import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import type { AdminUser } from '../types';

interface AuthContextValue {
  user: User | null;
  adminProfile: AdminUser | null;
  idToken: string | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
          const res = await fetch('/api/auth/me', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            setAdminProfile(data.admin);
            setAuthError(null);
          } else {
            const errBody = await res.json().catch(() => ({}));
            setAuthError(errBody.error || 'Unable to verify admin access.');
            setAdminProfile(null);
          }
        } catch (err) {
          console.error('Auth sync error:', err);
          setAuthError('Authentication verification failed. Please retry.');
        }
      } else {
        setIdToken(null);
        setAdminProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Google Sign-In was cancelled.';
      setAuthError(msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setIdToken(null);
    setAdminProfile(null);
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
      const currentUser = auth.currentUser;
      const freshToken = currentUser ? await currentUser.getIdToken() : idToken;
      if (!freshToken) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${freshToken}`);
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Request failed with status ${response.status}`
        );
      }

      return response.json() as Promise<T>;
    },
    [idToken]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        adminProfile,
        idToken,
        loading,
        authError,
        signInWithGoogle,
        signOut,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
