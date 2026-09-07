import type { PermissionKey } from '@erp/shared';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAuth({
  children,
  permission,
  anyOf,
}: {
  children: ReactNode;
  permission?: PermissionKey;
  /** Route is reachable if the user holds ANY of these — for pages that serve more than one narrow permission (e.g. Notifications: manage vs. view-logs-only). */
  anyOf?: PermissionKey[];
}) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) return <div>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) {
    return <div>You don't have permission to view this page.</div>;
  }
  if (anyOf && !anyOf.some((p) => hasPermission(p))) {
    return <div>You don't have permission to view this page.</div>;
  }

  return <>{children}</>;
}
