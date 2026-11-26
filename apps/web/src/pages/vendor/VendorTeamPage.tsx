import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Shield, Trash2, UserPlus, Users } from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { OnlineBadge } from '../../components/OnlineBadge';
import { api } from '../../lib/api';
import { useUserPresence } from '../../lib/presence-context';
import type { VendorStore } from '../../lib/types';

interface StaffRow {
  roleId?: string;
  userId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: 'VENDOR_STAFF' | 'VENDOR_OWNER';
  status?: string;
  createdAt?: string;
  assignedAt?: string;
}

export function VendorTeamPage() {
  const { storeId = 'store-1' } = useParams();
  const [store, setStore] = useState<VendorStore | null>(null);
  const [members, setMembers] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const getUserPresence = useUserPresence(members.map((m) => m.userId));

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<VendorStore>(`/vendors/stores/${storeId}`).catch(() => ({ data: null })),
      api.get<StaffRow[]>(`/vendors/stores/${storeId}/staff`).catch(() => ({ data: [] })),
    ])
      .then(([storeRes, staffRes]) => {
        if (storeRes.data) setStore(storeRes.data);
        setMembers(Array.isArray(staffRes.data) ? staffRes.data : []);
      })
      .catch(() => setError('Impossible de charger l’équipe de cette boutique.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [storeId]);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api.post<StaffRow>(`/vendors/stores/${storeId}/staff`, {
        identifier: identifier.trim(),
      });
      setMembers((prev) => [...prev, data]);
      setIdentifier('');
      setNotice(`${data.fullName} a été ajouté(e) en tant que gestionnaire de boutique.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || 'Impossible d’ajouter ce collaborateur.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(memberUserId: string) {
    setError(null);
    setNotice(null);
    try {
      await api.delete(`/vendors/stores/${storeId}/staff/${memberUserId}`);
      setMembers((prev) => prev.filter((m) => m.userId !== memberUserId));
      setConfirmRemoveId(null);
      setNotice('Accès collaborateur révoqué.');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : msg || 'Impossible de retirer ce collaborateur.');
    }
  }

  return (
    <VendorLayout storeId={storeId} storeName={store?.storeName || 'Boutique'}>
      <div className="max-w-4xl space-y-6">
        <div className="border-b border-encre/10 pb-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider font-display">
            <Users className="w-4 h-4 text-seve" />
            <span>Équipe &amp; Délégation Boutique</span>
          </div>
          <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-nuit tracking-tight">
            Collaborateurs &amp; Droits d’accès
          </h1>
          <p className="mt-1 text-xs text-encre/70">
            Ajoutez des gérants ou magasiniers (rôle VENDOR_STAFF) pour gérer vos produits, stocks et commandes sans partager l’accès bancaire principal.
          </p>
        </div>

        <form
          onSubmit={handleInvite}
          className="rounded-card border border-encre/10 bg-white p-5 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-display font-bold text-nuit">
            <UserPlus className="w-4 h-4 text-seve" />
            <span>Ajouter un collaborateur ZandoGo</span>
          </div>
          <p className="text-xs text-encre/65">
            Indiquez l’adresse e-mail ou le numéro de téléphone d’un utilisateur déjà inscrit sur ZandoGo.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="collaborateur@zandogo.cd ou +2438..."
              className="flex-1 min-w-[240px] rounded-card border border-encre/20 px-3.5 py-2.5 text-sm outline-none focus:border-seve"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition disabled:opacity-50"
            >
              {submitting ? 'Ajout…' : 'Accorder l’accès Staff'}
            </button>
          </div>
        </form>

        {notice && (
          <div className="rounded-card bg-seve/10 border border-seve/25 px-4 py-3 text-xs text-seve flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="rounded-card bg-wax/10 border border-wax/25 px-4 py-3 text-xs text-wax">
            {error}
          </div>
        )}

        <div className="rounded-card border border-encre/10 bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-brume/50 border-b border-encre/10 flex items-center justify-between text-xs font-display font-bold text-nuit">
            <span>Membres actifs ({members.length})</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-encre/60">
              <Shield className="w-3.5 h-3.5 text-seve" />
              Permissions : Catalogue, Stock, Expéditions
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-encre/50 font-mono">Chargement de l’équipe…</div>
          ) : members.length === 0 ? (
            <div className="p-10 text-center text-xs text-encre/60">
              Aucun collaborateur supplémentaire. Seul le propriétaire gère actuellement cette boutique.
            </div>
          ) : (
            <ul className="divide-y divide-encre/5">
              {members.map((member) => {
                const dateVal = member.createdAt || member.assignedAt;
                return (
                  <li key={member.userId} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-display font-bold text-sm text-nuit">{member.fullName}</p>
                      <p className="text-xs text-encre/65">
                        {member.email || member.phone || 'Identifiant vérifié'}
                        {dateVal ? ` · Ajouté le ${new Date(dateVal).toLocaleDateString('fr-FR')}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OnlineBadge
                        compact
                        isOnline={getUserPresence(member.userId)?.isOnline}
                        lastSeenAt={getUserPresence(member.userId)?.lastSeenAt}
                      />
                      <span className="px-2.5 py-1 rounded-card bg-seve/10 text-seve font-mono text-[11px] font-semibold">
                        {member.role}
                      </span>
                      {confirmRemoveId === member.userId ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRemove(member.userId)}
                            className="px-3 py-1 rounded-card bg-wax text-white text-xs font-semibold hover:bg-wax/90"
                          >
                            Confirmer retrait
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveId(null)}
                            className="text-xs text-encre/60 hover:text-nuit"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(member.userId)}
                          className="inline-flex items-center gap-1 text-xs text-wax hover:underline font-medium"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Retirer
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </VendorLayout>
  );
}
