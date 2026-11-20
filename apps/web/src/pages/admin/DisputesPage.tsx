import { useEffect, useState } from 'react';
import { ShieldAlert, Lock, Unlock, AlertTriangle, Sparkles, X } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import { getPreferredAiModel } from '../../lib/ai-preference';
import { useAuth } from '../../lib/auth-context';

type Decision = 'RESOLVED_REFUND' | 'RESOLVED_RELEASE' | 'RESOLVED_PARTIAL';

interface Dispute {
  id: string;
  orderNumber?: string;
  buyerName?: string;
  storeId?: string;
  storeName?: string;
  amountUsd?: number;
  reasonCategory?: string;
  reason?: string;
  description?: string;
  evidenceImages?: string[];
  evidenceUrls?: string[];
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
  payoutFrozen?: boolean;
  storePayoutBlocked?: boolean;
  status: string;
  openedAt?: string;
  slaDeadline?: string;
  order?: {
    orderNumber: string;
    total: string | number;
    currency: 'USD' | 'CDF';
    subOrders?: { storeId: string; store?: { storeName?: string; payoutBlocked?: boolean } }[];
  };
}

const DECISION_LABEL: Record<Decision, string> = {
  RESOLVED_REFUND: 'Rembourser l’acheteur (Séquestre retourné)',
  RESOLVED_RELEASE: 'Donner raison au vendeur (Fonds libérés)',
  RESOLVED_PARTIAL: 'Remboursement partiel négocié',
};

export function DisputesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.some((r) => r.role === 'SUPER_ADMIN' || r.role === 'ADMIN') ?? true;

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get<Dispute[]>('/disputes')
      .then(({ data }) => setDisputes(data || []))
      .catch(() => setDisputes([]))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-safran">
              Arbitrage, Séquestre & Protection Retraits
            </p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Litiges & Gel des Retraits Vendeurs
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Procédure d’arbitrage sous 48h. En cas de litige pertinent / critique, bloquez immédiatement les retraits Mobile Money de la boutique concernée.
            </p>
          </div>
          <span className="font-display text-xs text-brume/60 tabular-nums">
            {disputes.length} litige{disputes.length > 1 ? 's' : ''} en file
          </span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-28 rounded-card bg-nuit/60 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : disputes.length === 0 ? (
          <div className="py-16 text-center rounded-card bg-nuit/60 border border-white/10">
            <p className="text-sm font-display font-bold text-white">Aucun litige ouvert sur la plateforme</p>
            <p className="text-xs text-brume/60 mt-1">Tous les paiements sous séquestre se déroulent nominalement.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {disputes.map((dispute) => (
              <DisputeCard key={dispute.id} dispute={dispute} canResolve={isSuperAdmin} onResolved={load} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function DisputeCard({
  dispute,
  canResolve,
  onResolved,
}: {
  dispute: Dispute;
  canResolve: boolean;
  onResolved: () => void;
}) {
  const [decision, setDecision] = useState<Decision>('RESOLVED_REFUND');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [freezeBusy, setFreezeBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [previewEvidenceUrl, setPreviewEvidenceUrl] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{
    summary: string;
    recommendedDecision: Decision;
    recommendedFreezePayout: boolean;
    draftResolutionNote: string;
    engine: string;
    model: string;
  } | null>(null);

  async function handleAnalyzeDispute() {
    setAiLoading(true);
    setAiError(null);
    try {
      const { data } = await api.post(`/assistant/disputes/${dispute.id}/analyze`, {
        preferredModel: getPreferredAiModel() || undefined,
      });
      setAiAnalysis(data);
    } catch (err: any) {
      setAiError(
        err?.response?.data?.message ||
          "Analyse IA indisponible : démarrez Ollama en local ou vérifiez le service en ligne.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  const orderNum = dispute.order?.orderNumber || dispute.orderNumber || 'KND-2026-0988';
  const totalDisplay = dispute.order?.total
    ? `${dispute.order.total} ${dispute.order.currency}`
    : `${dispute.amountUsd || 380} USD`;

  const derivedStoreName =
    dispute.storeName || dispute.order?.subOrders?.[0]?.store?.storeName || 'Boutique vendeur';
  const isPayoutFrozen = Boolean(
    dispute.payoutFrozen || dispute.storePayoutBlocked || dispute.order?.subOrders?.some((so) => so.store?.payoutBlocked),
  );
  const isCritical = dispute.severity === 'HIGH';
  const evidenceList =
    dispute.evidenceUrls && dispute.evidenceUrls.length > 0
      ? dispute.evidenceUrls
      : dispute.evidenceImages || [];

  async function handleTogglePayoutFreeze(blocked: boolean) {
    setFreezeBusy(true);
    setFeedback(null);
    try {
      await api.patch(`/disputes/${dispute.id}/payout-block`, {
        blocked,
        reason: blocked
          ? `Retraits bloqués suite au litige critique sur ${orderNum}`
          : undefined,
      });
      setFeedback(
        blocked
          ? `Retraits Mobile Money de "${derivedStoreName}" bloqués sur le portefeuille vendeur.`
          : `Retraits de "${derivedStoreName}" débloqués.`,
      );
      onResolved();
    } catch {
      setFeedback('Impossible de modifier le blocage des retraits pour ce litige.');
    } finally {
      setFreezeBusy(false);
    }
  }

  async function handleResolve() {
    setBusy(true);
    setFeedback(null);
    try {
      await api.patch(`/disputes/${dispute.id}/resolve`, {
        status: decision,
        resolutionNote: note,
      });
      setFeedback('Décision enregistrée avec succès. Le statut du portefeuille vendeur a été actualisé.');
      setTimeout(onResolved, 600);
    } catch {
      setFeedback('Erreur lors de l’enregistrement de l’arbitrage.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-card bg-nuit/60 border p-6 shadow-xs ${
        isCritical ? 'border-wax/50' : 'border-white/10'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-bold text-white text-base">Commande {orderNum}</span>
            <span className="text-brume/40">·</span>
            <span className="font-display text-safran font-semibold tabular-nums">{totalDisplay} sous séquestre</span>
            {isCritical && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-card text-[10px] font-display font-bold bg-wax text-white">
                <AlertTriangle className="w-3 h-3" />
                <span>LITIGE PERTINENT / CRITIQUE</span>
              </span>
            )}
            {isPayoutFrozen && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-card text-[10px] font-display font-bold bg-wax/20 text-wax border border-wax/40">
                <Lock className="w-3 h-3" />
                <span>Retraits vendeur gelés</span>
              </span>
            )}
          </div>
          <p className="text-xs text-brume/70 mt-1">
            Acheteur : <strong className="text-brume">{dispute.buyerName || 'Client vérifié'}</strong> · Boutique :{' '}
            <strong className="text-brume">{derivedStoreName}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canResolve && (
            <>
              <button
                type="button"
                disabled={aiLoading}
                onClick={handleAnalyzeDispute}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-display font-semibold bg-safran/15 text-safran border border-safran/35 hover:bg-safran/25 transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{aiLoading ? 'Analyse IA…' : 'Analyser ce litige (IA)'}</span>
              </button>

              <button
                type="button"
                disabled={freezeBusy}
                onClick={() => handleTogglePayoutFreeze(!isPayoutFrozen)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-display font-semibold transition disabled:opacity-50 ${
                  isPayoutFrozen
                    ? 'bg-seve/15 text-seve border border-seve/35 hover:bg-seve/25'
                    : 'bg-wax text-white hover:bg-wax/90'
                }`}
              >
                {isPayoutFrozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                <span>
                  {freezeBusy
                    ? 'Mise à jour…'
                    : isPayoutFrozen
                    ? 'Débloquer retraits vendeur'
                    : 'Bloquer retraits du vendeur'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 p-3.5 rounded-card bg-white/5 border border-white/10 text-xs text-brume/80 space-y-2.5">
        <p className="font-display font-semibold text-white mb-1 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-safran" />
          <span>Motif de la contestation ({dispute.reasonCategory || 'LITIGE'}) :</span>
        </p>
        <p>{dispute.reason || dispute.description || 'Colis non reçu dans le délai imparti de 48 heures.'}</p>

        {evidenceList.length > 0 && (
          <div className="pt-2 border-t border-white/10 space-y-1.5">
            <p className="text-[11px] font-display font-semibold text-safran">
              Preuves photo fournies par l’acheteur ({evidenceList.length}) :
            </p>
            <div className="flex flex-wrap gap-2">
              {evidenceList.map((imgUrl, idx) => (
                <button
                  key={`${dispute.id}-ev-${idx}`}
                  type="button"
                  onClick={() => setPreviewEvidenceUrl(imgUrl)}
                  className="rounded-lg overflow-hidden border border-white/20 hover:border-safran transition"
                  title="Agrandir la photo preuve"
                >
                  <img
                    src={imgUrl}
                    alt={`Preuve litige ${idx + 1}`}
                    className="h-16 w-20 object-cover block"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {previewEvidenceUrl && (
        <div
          className="fixed inset-0 z-50 bg-nuit/90 flex items-center justify-center p-4"
          onClick={() => setPreviewEvidenceUrl(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewEvidenceUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-safran inline-flex items-center gap-1 text-xs font-display font-bold"
            >
              <X className="w-4 h-4" />
              <span>Fermer</span>
            </button>
            <img
              src={previewEvidenceUrl}
              alt="Preuve photo agrandie"
              className="w-full max-h-[80vh] object-contain rounded-card bg-black/40 border border-white/15"
            />
          </div>
        </div>
      )}

      {aiError && (
        <div className="mt-3 p-3 rounded-card bg-wax/10 border border-wax/30 text-xs text-wax">
          {aiError}
        </div>
      )}

      {aiAnalysis && (
        <div className="mt-4 p-4 rounded-card bg-safran/10 border border-safran/35 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display font-bold text-safran flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Synthèse & Recommandation IA (Décision finale Super Admin)</span>
            </span>
            <span className="font-mono text-[10px] text-brume/60">
              {aiAnalysis.engine === 'ollama' ? `Ollama local (${aiAnalysis.model})` : `Cloud (${aiAnalysis.model})`}
            </span>
          </div>
          <p className="text-brume/90 leading-relaxed">{aiAnalysis.summary}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-brume/70">
              Recommandation : <strong className="text-white">{DECISION_LABEL[aiAnalysis.recommendedDecision]}</strong>
              {aiAnalysis.recommendedFreezePayout ? ' · Gel retraits conseillé' : ''}
            </span>
            <button
              type="button"
              onClick={() => {
                setDecision(aiAnalysis.recommendedDecision);
                setNote(aiAnalysis.draftResolutionNote);
              }}
              className="px-3 py-1 rounded-card bg-safran text-nuit font-display font-bold hover:bg-safran/90 transition"
            >
              Pré-remplir le formulaire
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div className="mt-4 p-3 rounded-card bg-safran/15 border border-safran/35 text-xs text-safran font-display font-medium">
          {feedback}
        </div>
      )}

      {canResolve && (
        <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
          <label className="block text-xs font-display font-semibold uppercase tracking-wider text-brume/70">
            Rendre la décision d’arbitrage :
          </label>

          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as Decision)}
            className="w-full rounded-card bg-white/5 border border-white/10 px-4 py-2.5 text-xs text-brume outline-none focus:border-safran"
          >
            {(Object.keys(DECISION_LABEL) as Decision[]).map((d) => (
              <option key={d} value={d} className="bg-nuit text-white">
                {DECISION_LABEL[d]}
              </option>
            ))}
          </select>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Motif officiel de l’arbitrage (ex: Transporteur a confirmé l'échec de la remise au domicile)..."
            className="w-full rounded-card bg-white/5 border border-white/10 p-3 text-xs text-brume outline-none focus:border-safran resize-none"
          />

          <button
            onClick={handleResolve}
            disabled={busy}
            className="px-6 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-white text-xs font-display font-semibold transition-colors disabled:opacity-50 shadow-xs"
          >
            {busy ? 'Traitement…' : 'Appliquer l’arbitrage & Clôturer le litige'}
          </button>
        </div>
      )}
    </div>
  );
}
