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
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-encre/10 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider font-display">
              <span className="px-2.5 py-0.5 rounded-card bg-seve/10 border border-seve/20 text-seve flex items-center gap-1.5 font-bold text-[10px]">
                <Handshake className="w-3.5 h-3.5 text-seve" />
                <span>Négociation Commerciale Directe</span>
              </span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-nuit tracking-tight">
              Devis & Négociations Produit & Transport
            </h1>
            <p className="mt-1 text-xs text-encre/70">
              Concluez des accords sur-mesure sur le prix et le transport avec vos clients acheteurs dans toute la RDC.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-display bg-white border border-encre/10 px-3 py-1.5 rounded-card text-encre/70 shadow-xs">
            <span>Demandes actives :</span>
            <span className="font-bold text-seve tabular-nums">
              {negotiations.filter((n) => n.status === 'PENDING_VENDOR_REVIEW').length} en attente
            </span>
          </div>
        </div>

        {notice && (
          <div className="p-3.5 rounded-card bg-seve/10 border border-seve/25 text-xs font-medium text-seve flex items-center gap-2 animate-in fade-in font-display">
            <Check className="w-4 h-4 shrink-0 text-seve" />
            <span>{notice}</span>
          </div>
        )}

        {/* List of Negotiations */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-encre/50">
            Chargement des demandes de négociation…
          </div>
        ) : negotiations.length === 0 ? (
          <div className="py-16 text-center bg-white border border-encre/10 rounded-card p-8">
            <Handshake className="w-10 h-10 text-encre/30 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-nuit font-display">Aucune négociation en cours</h3>
            <p className="text-xs text-encre/60 mt-1 max-w-sm mx-auto">
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
                  className="bg-white border border-encre/10 rounded-card p-6 shadow-xs hover:border-seve/40 transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Product & Buyer Details */}
                    <div className="flex items-start gap-4">
                      {neg.productImage ? (
                        <img
                          src={neg.productImage}
                          alt=""
                          className="w-16 h-16 rounded-card object-cover bg-brume border border-encre/10 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-card bg-brume flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 text-encre/40" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-nuit">{neg.productTitle}</h4>
                          <span className="text-[10px] font-mono text-encre/40">ID: #{neg.id}</span>
                        </div>
                        <p className="text-xs text-encre/60 mt-0.5">
                          Acheteur : <strong className="text-nuit">{neg.buyerName}</strong> · Destination : <span className="text-seve font-semibold">{neg.destinationCity || 'Kinshasa'}</span>
                        </p>
                        {neg.transportMode && (
                          <p className="text-xs text-encre/70 mt-0.5 flex items-center gap-1 font-display">
                            <Truck className="w-3.5 h-3.5 text-seve" />
                            <span>Transport proposé : <strong>{neg.transportMode}</strong> (${neg.requestedDeliveryFeeUsd ?? 3.5})</span>
                          </p>
                        )}
                        {neg.notes && (
                          <p className="text-xs text-encre/70 italic mt-1 bg-brume/50 p-2 rounded-card border border-encre/10">
                            "{neg.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-card text-xs font-semibold bg-safran/20 text-nuit border border-safran/40 font-display">
                          <Clock className="w-3 h-3 text-nuit" />
                          Proposition en attente
                        </span>
                      )}
                      {isAccepted && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-card text-xs font-semibold bg-seve/10 text-seve border border-seve/20 font-display">
                          <Check className="w-3 h-3 text-seve" />
                          Prix & Transport validés
                        </span>
                      )}
                      {isConverted && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-card text-xs font-semibold bg-nuit text-safran border border-white/10 font-display">
                          <Package className="w-3 h-3 text-safran" />
                          Commande passée
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pricing Comparison Bar */}
                  <div className="mt-5 pt-4 border-t border-encre/10 flex flex-wrap items-center justify-between gap-4">
                    <div className="grid grid-cols-3 gap-6 text-xs">
                      <div>
                        <span className="block text-[11px] text-encre/50 font-mono">Quantité</span>
                        <span className="font-bold text-nuit font-display text-sm tabular-nums">
                          {neg.requestedQty} unités
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-encre/50 font-mono">Prix proposé client</span>
                        <span className="font-bold text-seve font-display text-sm tabular-nums">
                          ${neg.requestedPriceUsd.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[11px] text-encre/50 font-mono">Prix convenu final</span>
                        <span className="font-bold text-nuit font-display text-sm tabular-nums">
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
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition disabled:opacity-50 shadow-xs"
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
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card bg-nuit hover:bg-nuit/90 text-safran font-display font-bold text-xs transition border border-safran/35"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Contre-proposition</span>
                          </button>
                        </>
                      )}

                      {editingId === neg.id && (
                        <div className="flex items-center gap-2 bg-brume p-2 rounded-card border border-encre/10">
                          <span className="text-xs font-semibold text-nuit">Prix convenu ($) :</span>
                          <input
                            type="number"
                            step="0.5"
                            value={proposedPrice}
                            onChange={(e) => setProposedPrice(Number(e.target.value))}
                            className="w-20 px-2 py-1 text-xs border border-encre/20 rounded-card font-display font-bold text-nuit bg-white"
                          />
                          <button
                            type="button"
                            disabled={busyId === neg.id}
                            onClick={() => handleSetAgreedPrice(neg)}
                            className="px-3 py-1 bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs rounded-card transition"
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 text-encre/50 hover:text-nuit"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {isAccepted && (
                        <span className="text-xs text-seve font-medium font-display">
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
