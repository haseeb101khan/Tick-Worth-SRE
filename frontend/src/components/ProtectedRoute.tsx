import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';

export const STAFF_ROLES: Role[] = ['SHOPKEEPER', 'WAREHOUSE_MANAGER', 'OWNER'];

/**
 * Unauthenticated users go to /login (remembering where they came from);
 * authenticated users without an allowed role go to their home page
 * (staff → /dashboard, customers → catalog).
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={STAFF_ROLES.includes(user.role) ? '/dashboard' : '/'} replace />;
  }
  return <>{children}</>;
}
