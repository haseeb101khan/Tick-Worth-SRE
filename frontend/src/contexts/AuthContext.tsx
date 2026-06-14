import { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '../types';
import * as authService from '../services/authService';

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore synchronously so protected routes don't redirect on a hard refresh.
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? (JSON.parse(stored) as User) : null;
  });

  function persist(token: string, u: User) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  }

  async function login(email: string, password: string) {
    const { token, user: u } = await authService.login(email, password);
    persist(token, u);
    return u;
  }

  async function register(name: string, email: string, password: string) {
    const { token, user: u } = await authService.register(name, email, password);
    persist(token, u);
    return u;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
