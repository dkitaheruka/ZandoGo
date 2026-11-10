import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth-context';
import type { UserRole } from '../lib/types';

export function RequireAuth({
  children,
  requireRole,
}: {
  children: ReactNode;
  requireRole?: UserRole[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="mx-auto max-w-6xl px-6 py-16 text-encre/60" role="status">Vérification de la session…</p>;
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requireRole && !user.roles.some(({ role }) => requireRole.includes(role))) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-semibold">Accès non autorisé</h1>
        <p className="mt-3 text-encre/60">Votre compte ne dispose pas des droits requis.</p>
      </div>
    );
  }
  return children;
}
