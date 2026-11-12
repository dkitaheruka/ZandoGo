import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Handshake,
  Check,
  X,
  Clock,
  Package,
  DollarSign,
  Truck,
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
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 uppercase tracking-wider">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 flex items-center gap-1.5 font-bold text-[10px]">
                <Handshake className="w-3.5 h-3.5 text-cyan-600" />
                <span>Négociation Commerciale Directe</span>
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-slate-950 tracking-tight">
              Devis & Négociations Produit & Transport
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Concluez des accords sur-mesure sur le prix et le transport avec vos clients acheteurs dans toute la RDC.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 shadow-xs">
            <span>Demandes actives :</span>
            <span className="font-bold text-cyan-700 tabular-nums">
              {negotiations.filter((n) => n.status === 'PENDING_VENDOR_REVIEW').length} en attente
            </span>
          </div>
        </div>

        {notice && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2 animate-in fade-in">
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
          <div className="py-16 text-center bg-white border border-slate-200 rounded-3xl p-8">
            <Handshake className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">Aucune négociation en cours</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Lorsque les clients souhaitent convenir d'un prix de vente ou d'un mode de transport, leur demande apparaîtra ici.
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
                          <h4 className="font-bold text-sm text-slate-900">{neg.productTitle}</h4>
                          <span className="text-[10px] font-mono text-slate-400">ID: #{neg.id}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Acheteur : <strong className="text-slate-700">{neg.buyerName}</strong> · Destination : <span className="text-cyan-700 font-semibold">{neg.destinationCity || 'Kinshasa'}</span>
                        </p>
                        {neg.transportMode && (
                          <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1 font-mono">
                            <Truck className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Transport proposé : <strong>{neg.transportMode}</strong> (${neg.requestedDeliveryFeeUsd ?? 3.5})</span>
                          </p>
                        )}
                        {neg.notes && (
                          <p className="text-xs text-slate-600 italic mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            "{neg.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-50 text-cyan-900 border border-cyan-200">
                          <Clock className="w-3 h-3 text-cyan-600" />
                          Proposition en attente
                        </span>
                      )}
                      {isAccepted && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Prix & Transport validés
                        </span>
                      )}
                      {isConverted && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#0B0F19] text-cyan-300 border border-cyan-500/40">
                          <Package className="w-3 h-3 text-cyan-400" />
                          Commande passée
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing Comparison Bar */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="grid grid-cols-3 gap-6 text-xs">
                      <div>
                        <span className="block text-[11px] text-slate-400 font-mono">Quantité</span>
                        <span className="font-bold text-slate-900 font-mono text-sm tabular-nums">
                          {neg.requestedQty} unités
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-slate-400 font-mono">Prix proposé client</span>
                        <span className="font-bold text-cyan-800 font-mono text-sm tabular-nums">
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
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50 shadow-xs"
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
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B0F19] hover:bg-slate-900 text-cyan-300 font-bold text-xs transition border border-cyan-500/30"
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
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition"
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
