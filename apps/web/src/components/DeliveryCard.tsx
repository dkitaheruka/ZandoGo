import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { DeliveryJob } from '../lib/types';

type ProofType = 'PHOTO' | 'SIGNATURE' | 'OTP_CODE';
type Coords = { lat: number; lng: number };

const STATUS_LABEL: Record<DeliveryJob['status'], { label: string; className: string }> = {
  AWAITING_ASSIGNMENT: { label: "En attente d'assignation", className: 'bg-encre/10 text-encre/70' },
  ASSIGNED: { label: 'À récupérer', className: 'bg-safran/20 text-nuit' },
  PICKED_UP: { label: 'Colis récupéré', className: 'bg-seve/15 text-seve' },
  IN_TRANSIT: { label: 'En route', className: 'bg-seve/15 text-seve' },
  DELIVERED: { label: 'Livrée', className: 'bg-seve text-white' },
  FAILED: { label: 'Échec', className: 'bg-wax/15 text-wax' },
};

const ACTIVE_STATUSES: DeliveryJob['status'][] = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];
const PING_INTERVAL_MS = 12_000;

function getPosition(fallback: Coords): Promise<Coords> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(fallback);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(fallback),
      { enableHighAccuracy: true, timeout: 6_000 },
    );
  });
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function DeliveryCard({ job, onChanged }: { job: DeliveryJob; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProof, setShowProof] = useState(false);
  const [proofType, setProofType] = useState<ProofType>('OTP_CODE');
  const [fileUrl, setFileUrl] = useState('');
  const [otp, setOtp] = useState('');
  const [counterFee, setCounterFee] = useState(String(job.negotiatedFeeUsd ?? job.estimatedFee));

  const isActive = ACTIVE_STATUSES.includes(job.status);
  const order = job.subOrder.order;
  const store = job.subOrder.store;
  const status = STATUS_LABEL[job.status];
  const address = order.deliveryAddress;
  const cashDue = order.paymentTransactions.some(
    (t) => t.methodCode === 'CASH_ON_DELIVERY' && t.status === 'PENDING',
  );

  useEffect(() => {
    if (!isActive) return;

    const last: { current: Coords | null } = { current: null };
    const watchId = navigator.geolocation?.watchPosition(
      (pos) => {
        last.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true },
    );

    const timer = window.setInterval(() => {
      if (last.current) {
        api.post(`/delivery/deliveries/${job.id}/ping`, last.current).catch(() => {});
      }
    }, PING_INTERVAL_MS);

    return () => {
      if (watchId !== undefined && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      window.clearInterval(timer);
    };
  }, [isActive, job.id]);

  function describeError(err: any, fallback: string) {
    const apiMessage = err?.response?.data?.message;
    return Array.isArray(apiMessage) ? apiMessage.join(' ') : (apiMessage ?? err?.message ?? fallback);
  }

  async function handleNegotiateFee(action: 'ACCEPT' | 'COUNTER') {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/delivery/deliveries/${job.id}/negotiate`, {
        action,
        feeUsd: action === 'ACCEPT' ? Number(job.negotiatedFeeUsd ?? job.estimatedFee) : Number(counterFee),
      });
      onChanged();
    } catch (err) {
      setError(describeError(err, 'Impossible de mettre à jour le tarif.'));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: 'PICKED_UP' | 'IN_TRANSIT' | 'FAILED') {
    if (next === 'FAILED' && !window.confirm('Signaler un échec de livraison pour cette course ?')) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/delivery/deliveries/${job.id}/status`, { status: next });
      onChanged();
    } catch (err) {
      setError(describeError(err, 'Action impossible.'));
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      const position = await getPosition({ lat: job.dropoffLat, lng: job.dropoffLng });
      await api.post(`/delivery/deliveries/${job.id}/complete`, {
        proofType,
        fileUrl: proofType === 'OTP_CODE' ? undefined : fileUrl,
        otpValue: proofType === 'OTP_CODE' ? otp : undefined,
        lat: position.lat,
        lng: position.lng,
      });
      onChanged();
    } catch (err) {
      setError(describeError(err, 'Confirmation impossible.'));
    } finally {
      setBusy(false);
    }
  }

  const proofReady = proofType === 'OTP_CODE' ? otp.trim().length > 0 : fileUrl.trim().length > 0;

  return (
    <div className="rounded-card border border-encre/10 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display font-semibold text-nuit">Commande {order.orderNumber}</p>
          <p className="text-sm text-encre/60">Retrait chez {store.storeName}</p>
        </div>
        <span className={`text-xs font-display font-medium px-3 py-1 rounded-card flex-shrink-0 ${status.className}`}>{status.label}</span>
      </div>

      <div className="mt-4 text-sm space-y-1.5">
        {address && (
          <p>
            <span className="text-encre/50">Livrer à : </span>
            {[address.commune, address.quartier].filter(Boolean).join(', ')}
            {address.referencePoint && <span className="block text-encre/60">{address.referencePoint}</span>}
          </p>
        )}
        <p className="text-encre/60">
          Course : {Number(job.estimatedFee).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $
          {job.distanceKm !== undefined && ` · ${job.distanceKm.toFixed(1)} km (Google Maps)`}
        </p>
        <p className="flex flex-wrap gap-4 text-xs font-semibold">
          <a
            href={mapsUrl(job.pickupLat, job.pickupLng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-seve hover:underline"
          >
            Point de retrait (Maps) ↗
          </a>
          <a
            href={job.clientGoogleMapsUrl || mapsUrl(job.dropoffLat, job.dropoffLng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-seve hover:underline"
          >
            Localisation client Google Maps ↗
          </a>
        </p>
      </div>

      {(job.feeNegotiationStatus === 'PENDING_DRIVER' || job.feeNegotiationStatus === 'COUNTERED') && (
        <div className="mt-4 rounded-card border border-seve/30 bg-seve/5 p-3.5 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-nuit">
              Proposition tarif livraison (avant paiement)
            </span>
            <span className="font-mono font-bold text-seve">
              Proposé : ${Number(job.negotiatedFeeUsd ?? job.estimatedFee).toFixed(2)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => handleNegotiateFee('ACCEPT')}
              className="px-3.5 py-1.5 rounded-card bg-seve text-white font-display font-bold hover:bg-seve/90 transition"
            >
              Accepter ${Number(job.negotiatedFeeUsd ?? job.estimatedFee).toFixed(2)}
            </button>
            <input
              type="number"
              step="0.5"
              min="1"
              value={counterFee}
              onChange={(e) => setCounterFee(e.target.value)}
              className="w-20 rounded-card border border-encre/20 bg-white px-2.5 py-1.5 font-mono font-bold text-nuit"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => handleNegotiateFee('COUNTER')}
              className="px-3.5 py-1.5 rounded-card bg-nuit text-brume font-display font-bold hover:bg-nuit/90 transition"
            >
              Contre-offre ($)
            </button>
          </div>
        </div>
      )}

      {cashDue && (
        <div className="mt-4 rounded-card border-l-4 border-safran bg-safran/15 px-4 py-3 text-sm">
          <strong>Cash à encaisser : </strong>
          {Number(order.total).toLocaleString('fr-FR')} {order.currency}
          <span className="block text-encre/60">
            L'encaissement est enregistré, avec votre position, à la confirmation de livraison.
          </span>
        </div>
      )}

      {isActive && (
        <div className="mt-5 flex flex-wrap gap-3">
          {job.status === 'ASSIGNED' && (
            <button
              disabled={busy}
              onClick={() => changeStatus('PICKED_UP')}
              className="rounded-card bg-nuit text-brume text-sm font-medium px-5 py-2 hover:bg-nuit/90 transition-colors disabled:opacity-60"
            >
              J'ai récupéré le colis
            </button>
          )}
          {job.status === 'PICKED_UP' && (
            <button
              disabled={busy}
              onClick={() => changeStatus('IN_TRANSIT')}
              className="rounded-card bg-nuit text-brume text-sm font-medium px-5 py-2 hover:bg-nuit/90 transition-colors disabled:opacity-60"
            >
              Je suis en route
            </button>
          )}
          {(job.status === 'PICKED_UP' || job.status === 'IN_TRANSIT') && (
            <button
              disabled={busy}
              onClick={() => setShowProof((v) => !v)}
              className="rounded-card bg-seve text-white text-sm font-medium px-5 py-2 hover:bg-seve/90 transition-colors disabled:opacity-60"
            >
              Confirmer la livraison
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => changeStatus('FAILED')}
            className="rounded-card border border-wax text-wax text-sm font-medium px-5 py-2 hover:bg-wax/10 transition-colors disabled:opacity-60"
          >
            Signaler un échec
          </button>
        </div>
      )}

      {showProof && isActive && (
        <div className="mt-5 pt-5 border-t border-encre/10 space-y-3">
          <p className="text-sm font-medium text-nuit">Preuve de livraison (obligatoire)</p>
          <select
            value={proofType}
            onChange={(e) => setProofType(e.target.value as ProofType)}
            className="w-full rounded-card border border-encre/20 px-3 py-2 text-sm bg-brume/40"
          >
            <option value="OTP_CODE">Code OTP communiqué par le client</option>
            <option value="PHOTO">Photo du colis remis</option>
            <option value="SIGNATURE">Signature du client</option>
          </select>

          {proofType === 'OTP_CODE' ? (
            <div className="space-y-1.5">
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Ex : 4829"
                className="w-full rounded-card border border-encre/20 px-3 py-2 text-sm font-mono"
              />
              {job.otpCode && (
                <button
                  type="button"
                  onClick={() => setOtp(job.otpCode || '')}
                  className="text-xs text-seve hover:underline"
                >
                  Pré-remplir le code de démonstration ({job.otpCode})
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <input
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="Lien vers la photo ou signature"
                className="w-full rounded-card border border-encre/20 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setFileUrl('/src/assets/images/marketplace_parcel_default_1794567970796.jpg')}
                className="text-xs text-seve hover:underline"
              >
                Utiliser une capture preuve de remise
              </button>
            </div>
          )}

          <button
            disabled={busy || !proofReady}
            onClick={complete}
            className="rounded-card bg-seve text-white text-sm font-medium px-5 py-2 hover:bg-seve/90 transition-colors disabled:opacity-50"
          >
            {busy ? 'Confirmation…' : 'Valider la remise'}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-wax">{error}</p>}
    </div>
  );
}
