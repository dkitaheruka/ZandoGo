import { useEffect, useMemo, useState } from 'react';
import { Eye, Globe, Radio, RefreshCw, Search, ShieldCheck, Store, Truck, UserCheck, Users } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { OnlineBadge, formatLastSeen } from '../../components/OnlineBadge';
import { api } from '../../lib/api';
import { usePresence } from '../../lib/presence-context';
import type { AdminPresenceSnapshot } from '../../lib/types';

type TabKey = 'users' | 'visitors' | 'offline';

function roleLabel(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'ADMIN':
      return 'Admin';
    case 'VENDOR_OWNER':
      return 'Vendeur Propriétaire';
    case 'VENDOR_STAFF':
      return 'Staff Boutique';
    case 'DELIVERY_AGENT':
      return 'Livreur / Coursier';
    default:
      return 'Client';
  }
}

export function AdminPresencePage() {
  const { adminSnapshot } = usePresence();
  const [snapshot, setSnapshot] = useState<AdminPresenceSnapshot | null>(adminSnapshot);
  const [loading, setLoading] = useState(!adminSnapshot);
  const [tab, setTab] = useState<TabKey>('users');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  function loadSnapshot() {
    setError(null);
    api
      .get<AdminPresenceSnapshot>('/presence/admin/live')
      .then(({ data }) => {
        if (data?.summary) setSnapshot(data);
      })
      .catch(() => setError('Impossible de récupérer la liste des sessions actives.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSnapshot();
    const timer = window.setInterval(loadSnapshot, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (adminSnapshot) {
      setSnapshot(adminSnapshot);
      setLoading(false);
    }
  }, [adminSnapshot]);

  const filteredUsers = useMemo(() => {
    const list = snapshot?.connectedUsers || [];
    return list.filter((u) => {
      if (roleFilter !== 'ALL' && !u.roles.includes(roleFilter)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          u.fullName.toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          u.currentPath.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [snapshot?.connectedUsers, roleFilter, search]);

  const filteredVisitors = useMemo(() => {
    const list = snapshot?.visitors || [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (v) =>
        v.visitorId.toLowerCase().includes(q) ||
        v.currentPath.toLowerCase().includes(q) ||
        v.userAgentSummary.toLowerCase().includes(q),
    );
  }, [snapshot?.visitors, search]);

  const summary = snapshot?.summary;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-safran flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Présence &amp; Audience en Temps Réel</span>
            </p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Utilisateurs Connectés &amp; Visiteurs Actifs
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Suivez en direct les comptes authentifiés, vendeurs, coursiers et visiteurs en navigation sur la plateforme.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {snapshot?.generatedAt && (
              <span className="text-[11px] font-mono text-brume/55">
                MAJ {new Date(snapshot.generatedAt).toLocaleTimeString('fr-FR')}
              </span>
            )}
            <button
              type="button"
              onClick={loadSnapshot}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-card bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-brume transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </button>
          </div>
        </div>

        {/* Live KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-card bg-nuit/70 border border-white/10">
            <div className="flex items-center justify-between text-xs text-brume/65">
              <span>Sessions en direct</span>
              <Globe className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">
              {summary?.totalActive ?? 0}
            </p>
            <p className="text-[11px] text-emerald-300 mt-0.5">Actifs sur les 60 dernières sec.</p>
          </div>

          <div className="p-4 rounded-card bg-nuit/70 border border-white/10">
            <div className="flex items-center justify-between text-xs text-brume/65">
              <span>Comptes connectés</span>
              <UserCheck className="w-4 h-4 text-safran" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">
              {summary?.authenticatedCount ?? 0}
            </p>
            <p className="text-[11px] text-brume/60 mt-0.5">
              {summary?.customersOnlineCount ?? 0} client(s) · {summary?.vendorsOnlineCount ?? 0} vendeur(s)
            </p>
          </div>

          <div className="p-4 rounded-card bg-nuit/70 border border-white/10">
            <div className="flex items-center justify-between text-xs text-brume/65">
              <span>Visiteurs anonymes</span>
              <Eye className="w-4 h-4 text-sky-400" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">
              {summary?.visitorsCount ?? 0}
            </p>
            <p className="text-[11px] text-brume/60 mt-0.5">Navigation catalogue sans compte</p>
          </div>

          <div className="p-4 rounded-card bg-nuit/70 border border-white/10">
            <div className="flex items-center justify-between text-xs text-brume/65">
              <span>Boutiques &amp; Livreurs</span>
              <Truck className="w-4 h-4 text-seve" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-white tabular-nums">
              {(summary?.vendorsOnlineCount ?? 0) + (summary?.driversOnlineCount ?? 0)}
            </p>
            <p className="text-[11px] text-brume/60 mt-0.5">
              {summary?.vendorsOnlineCount ?? 0} vendeur(s) · {summary?.driversOnlineCount ?? 0} livreur(s)
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('users')}
              className={`px-3.5 py-2 rounded-card text-xs font-display font-semibold border transition inline-flex items-center gap-1.5 ${
                tab === 'users'
                  ? 'bg-seve text-brume border-seve'
                  : 'bg-white/5 text-brume/70 border-white/10 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Connectés ({snapshot?.connectedUsers.length ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('visitors')}
              className={`px-3.5 py-2 rounded-card text-xs font-display font-semibold border transition inline-flex items-center gap-1.5 ${
                tab === 'visitors'
                  ? 'bg-seve text-brume border-seve'
                  : 'bg-white/5 text-brume/70 border-white/10 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Visiteurs ({snapshot?.visitors.length ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('offline')}
              className={`px-3.5 py-2 rounded-card text-xs font-display font-semibold border transition ${
                tab === 'offline'
                  ? 'bg-seve text-brume border-seve'
                  : 'bg-white/5 text-brume/70 border-white/10 hover:text-white'
              }`}
            >
              Récemment hors ligne ({snapshot?.recentlyOffline.length ?? 0})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {tab === 'users' && (
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-card bg-nuit border border-white/15 px-3 py-2 text-xs text-brume outline-none focus:border-safran"
              >
                <option value="ALL">Tous les rôles</option>
                <option value="CUSTOMER">Clients</option>
                <option value="VENDOR_OWNER">Vendeurs</option>
                <option value="VENDOR_STAFF">Staff Boutique</option>
                <option value="DELIVERY_AGENT">Livreurs</option>
                <option value="ADMIN">Admins</option>
              </select>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-brume/45 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, page (/products)…"
                className="pl-8 pr-3 py-2 rounded-card bg-nuit border border-white/15 text-xs text-white placeholder:text-brume/40 outline-none focus:border-safran w-56"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-card border border-wax/40 bg-wax/15 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-card bg-nuit/60 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : tab === 'users' ? (
          filteredUsers.length === 0 ? (
            <div className="py-14 text-center rounded-card bg-nuit/60 border border-white/10 text-xs text-brume/60">
              Aucun utilisateur connecté ne correspond à ce filtre.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-card border border-white/10 bg-nuit/80">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-white/5 text-brume/70 border-b border-white/10 font-display uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">Rôle</th>
                    <th className="px-4 py-3">Page consultée</th>
                    <th className="px-4 py-3">Canal</th>
                    <th className="px-4 py-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.map((u) => (
                    <tr key={u.userId} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5">
                        <p className="font-display font-bold text-white">{u.fullName}</p>
                        <p className="text-[11px] text-brume/55">{u.email || u.userId}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-card bg-white/5 border border-white/10 text-[11px] text-safran font-medium">
                          {u.primaryRole.includes('VENDOR') ? (
                            <Store className="w-3 h-3" />
                          ) : u.primaryRole === 'DELIVERY_AGENT' ? (
                            <Truck className="w-3 h-3" />
                          ) : (
                            <ShieldCheck className="w-3 h-3" />
                          )}
                          <span>{roleLabel(u.primaryRole)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-brume/85">{u.currentPath}</td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-brume/60">{u.channel}</td>
                      <td className="px-4 py-3.5">
                        <OnlineBadge isOnline lastSeenAt={u.lastSeenAt} dark />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'visitors' ? (
          filteredVisitors.length === 0 ? (
            <div className="py-14 text-center rounded-card bg-nuit/60 border border-white/10 text-xs text-brume/60">
              Aucun visiteur anonyme actif en ce moment.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-card border border-white/10 bg-nuit/80">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-white/5 text-brume/70 border-b border-white/10 font-display uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Session visiteur</th>
                    <th className="px-4 py-3">Page en cours</th>
                    <th className="px-4 py-3">Appareil / Navigateur</th>
                    <th className="px-4 py-3">Pages vues</th>
                    <th className="px-4 py-3">Dernier signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredVisitors.map((v) => (
                    <tr key={v.visitorId} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3.5 font-mono text-white">{v.visitorId.slice(0, 18)}</td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-safran">{v.currentPath}</td>
                      <td className="px-4 py-3.5 text-brume/75">{v.userAgentSummary}</td>
                      <td className="px-4 py-3.5 font-mono tabular-nums text-white">{v.pageViews}</td>
                      <td className="px-4 py-3.5">
                        <OnlineBadge isOnline lastSeenAt={v.lastSeenAt} dark />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (snapshot?.recentlyOffline.length ?? 0) === 0 ? (
          <div className="py-14 text-center rounded-card bg-nuit/60 border border-white/10 text-xs text-brume/60">
            Aucune déconnexion récente enregistrée dans les 15 dernières minutes.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-white/10 bg-nuit/80">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-white/5 text-brume/70 border-b border-white/10 font-display uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Dernière activité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {snapshot!.recentlyOffline.map((r) => (
                  <tr key={r.userId} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5 font-display font-bold text-white">{r.fullName}</td>
                    <td className="px-4 py-3.5 text-brume/75">{roleLabel(r.primaryRole)}</td>
                    <td className="px-4 py-3.5 text-brume/60">{formatLastSeen(r.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
