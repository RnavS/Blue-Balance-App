import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toError = (value: unknown): Error => {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  return new Error('Unexpected auth error');
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number = 20000): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out. Please check your SMTP setup and try again.')), ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        }),
      );
      return { error: error as Error | null };
    } catch (error) {
      return { error: toError(error) };
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
      );
      return { error: error as Error | null };
    } catch (error) {
      return { error: toError(error) };
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        }),
      );
      return { error: error as Error | null };
    } catch (error) {
      return { error: toError(error) };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectUrl,
        }),
      );
      return { error: error as Error | null };
    } catch (error) {
      return { error: toError(error) };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
