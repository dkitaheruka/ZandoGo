import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Handshake,
  Check,
  X,
  Clock,
  MapPin,
  Package,
  DollarSign,
  ExternalLink,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';
import type { NegotiationOffer } from '../../lib/types';

export function VendorNegotiationsPage() {
  const { storeId = 'store-1' } = useParams();
  const [negotiations, setNegotiations] = useState<NegotiationOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [proposedPrice, setProposedPrice] = useState<number>(0);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .get<NegotiationOffer[]>('/negotiations')
      .then(({ data }) => setNegotiations(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAcceptDirect(neg: NegotiationOffer) {
    setBusyId(neg.id);
    try {
      await api.patch(`/negotiations/${neg.id}`, {
        agreedPriceUsd: neg.requestedPriceUsd,
        status: 'ACCEPTED_BY_VENDOR',
      });
      setNegotiations((prev) =>
        prev.map((n) =>
          n.id === neg.id
            ? { ...n, agreedPriceUsd: neg.requestedPriceUsd, status: 'ACCEPTED_BY_VENDOR' }
            : n,
        ),
      );
      setNotice(`Prix de $${neg.requestedPriceUsd}/unité accepté pour ${neg.buyerName}.`);
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setNotice('Erreur lors de la validation.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetAgreedPrice(neg: NegotiationOffer) {
    if (!proposedPrice || proposedPrice <= 0) return;
    setBusyId(neg.id);
    try {
      await api.patch(`/negotiations/${neg.id}`, {
        agreedPriceUsd: proposedPrice,
        status: 'ACCEPTED_BY_VENDOR',
      });
      setNegotiations((prev) =>
        prev.map((n) =>
          n.id === neg.id
            ? { ...n, agreedPriceUsd: proposedPrice, status: 'ACCEPTED_BY_VENDOR' }
            : n,
        ),
      );
      setEditingId(null);
      setNotice(`Offre sur mesure de $${proposedPrice}/unité validée pour ${neg.buyerName}.`);
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setNotice('Erreur lors de la validation du prix.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <VendorLayout storeId={storeId}>
      <div className="max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wider">
              <Handshake className="w-4 h-4" />
              <span>Négociation Commerciale Directe</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 tracking-tight">
              Devis & Négociations de Prix B2B
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Concluez des accords de prix personnalisés avec vos clients professionnels et acheteurs en gros dans toute la RDC.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600">
            <span>Demandes actives :</span>
            <span className="font-bold text-amber-700 tabular-nums">
              {negotiations.filter((n) => n.status === 'PENDING_VENDOR_REVIEW').length} en attente
            </span>
          </div>
        </div>

        {notice && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
        )}

        {/* List of Negotiations */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-slate-400">
            Chargement des demandes de négociation…
          </div>
        ) : negotiations.length === 0 ? (
          <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl p-8">
            <Handshake className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">Aucune négociation de prix en cours</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Lorsque les clients souhaitent négocier le prix de gros d'un article, leur proposition apparaîtra ici.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {negotiations.map((neg) => {
              const isPending = neg.status === 'PENDING_VENDOR_REVIEW';
              const isAccepted = neg.status === 'ACCEPTED_BY_VENDOR';
              const isConverted = neg.status === 'CONVERTED_TO_ORDER';

              return (
                <div
                  key={neg.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Product & Buyer Details */}
                    <div className="flex items-start gap-4">
                      {neg.productImage ? (
                        <img
                          src={neg.productImage}
                          alt=""
                          className="w-16 h-16 rounded-xl object-cover bg-slate-100 border border-slate-100 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 text-slate-400" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 text-sm">{neg.productTitle}</h3>
                          <Link
                            to={`/products/${neg.productId}`}
                            target="_blank"
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span className="font-medium text-slate-900">Acheteur : {neg.buyerName}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {neg.destinationCity || 'RDC'}
                          </span>
                          <span>·</span>
                          <span className="text-slate-400 font-mono">
                            {new Date(neg.createdAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {neg.notes && (
                          <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                            « {neg.notes} »
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          Proposition en attente
                        </span>
                      )}
                      {isAccepted && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3" />
                          Prix convenu & validé
                        </span>
                      )}
                      {isConverted && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          <Package className="w-3 h-3" />
                          Commande passée
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing Comparison Bar */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="grid grid-cols-3 gap-6 text-xs">
                      <div>
                        <span className="block text-[11px] text-slate-400 font-mono">Quantité demandée</span>
                        <span className="font-bold text-slate-900 font-mono text-sm tabular-nums">
                          {neg.requestedQty} unités
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-400 font-mono">Prix proposé client</span>
                        <span className="font-bold text-amber-700 font-mono text-sm tabular-nums">
                          ${neg.requestedPriceUsd.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-400 font-mono">Prix convenu final</span>
                        <span className="font-bold text-emerald-700 font-mono text-sm tabular-nums">
                          {neg.agreedPriceUsd ? `$${neg.agreedPriceUsd.toFixed(2)}` : 'Non fixé'}
                        </span>
                      </div>
                    </div>

                    {/* Actions for Vendor */}
                    <div className="flex items-center gap-2">
                      {isPending && editingId !== neg.id && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === neg.id}
                            onClick={() => handleAcceptDirect(neg)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs transition disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accepter à ${neg.requestedPriceUsd}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(neg.id);
                              setProposedPrice(neg.requestedPriceUsd + 2);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Contre-proposition</span>
                          </button>
                        </>
                      )}

                      {editingId === neg.id && (
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <span className="text-xs font-semibold text-slate-700">Prix convenu ($) :</span>
                          <input
                            type="number"
                            step="0.5"
                            value={proposedPrice}
                            onChange={(e) => setProposedPrice(Number(e.target.value))}
                            className="w-20 px-2 py-1 text-xs border border-slate-300 rounded font-mono font-bold"
                          />
                          <button
                            type="button"
                            disabled={busyId === neg.id}
                            onClick={() => handleSetAgreedPrice(neg)}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold text-xs rounded transition"
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {isAccepted && (
                        <span className="text-xs text-emerald-700 font-medium font-mono">
                          ✓ Offre transmise à l'acheteur ({neg.buyerName})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
