import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { DeliveryJob } from '../lib/types';

type ProofType = 'PHOTO' | 'SIGNATURE' | 'OTP_CODE';
type Coords = { lat: number; lng: number };

const STATUS_LABEL: Record<DeliveryJob['status'], { label: string; className: string }> = {
  AWAITING_ASSIGNMENT: { label: "En attente d'assignation", className: 'bg-encre/10 text-encre/70' },
  ASSIGNED: { label: 'À récupérer', className: 'bg-safran/25 text-nuit' },
  PICKED_UP: { label: 'Colis récupéré', className: 'bg-seve/15 text-seve' },
  IN_TRANSIT: { label: 'En route', className: 'bg-seve/15 text-seve' },
  DELIVERED: { label: 'Livrée', className: 'bg-seve text-white' },
  FAILED: { label: 'Échec', className: 'bg-wax/15 text-wax' },
};

const ACTIVE_STATUSES: DeliveryJob['status'][] = ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'];
const PING_INTERVAL_MS = 12_000;

function getPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error("Position indisponible : autorisez la géolocalisation pour confirmer la livraison.")),
      { enableHighAccuracy: true, timeout: 10_000 },
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
  const [proofType, setProofType] = useState<ProofType>('PHOTO');
  const [fileUrl, setFileUrl] = useState('');
  const [otp, setOtp] = useState('');

  const isActive = ACTIVE_STATUSES.includes(job.status);
  const order = job.subOrder.order;
  const store = job.subOrder.store;
  const status = STATUS_LABEL[job.status];
  const address = order.deliveryAddress;
  const cashDue = order.paymentTransactions.some(
    (t) => t.methodCode === 'CASH_ON_DELIVERY' && t.status === 'PENDING',
  );

  // Tant que la course est active, on envoie la position toutes les 12 s.
  // C'est ce flux qui alimente le suivi en direct affiché au client.
  useEffect(() => {
    if (!isActive) return;

    const last: { current: Coords | null } = { current: null };
    const watchId = navigator.geolocation.watchPosition(
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
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(timer);
    };
  }, [isActive, job.id]);

  function describeError(err: any, fallback: string) {
    const apiMessage = err?.response?.data?.message;
    return Array.isArray(apiMessage) ? apiMessage.join(' ') : (apiMessage ?? err?.message ?? fallback);
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
      const position = await getPosition();
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
    <div className="border border-encre/10 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">Commande {order.orderNumber}</p>
          <p className="text-sm text-encre/50">Retrait chez {store.storeName}</p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 flex-shrink-0 ${status.className}`}>{status.label}</span>
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
          {job.distanceKm !== undefined && ` · ${job.distanceKm.toFixed(1)} km à vol d'oiseau`}
        </p>
        <p className="flex gap-4">
          <a
            href={mapsUrl(job.pickupLat, job.pickupLng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-seve hover:underline"
          >
            Point de retrait
          </a>
          <a
            href={mapsUrl(job.dropoffLat, job.dropoffLng)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-seve hover:underline"
          >
            Point de livraison
          </a>
        </p>
      </div>

      {cashDue && (
        <div className="mt-4 border-l-4 border-safran bg-safran/15 px-4 py-3 text-sm">
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
              className="bg-nuit text-brume text-sm font-medium px-5 py-2 hover:bg-nuit/90 transition-colors disabled:opacity-60"
            >
              J'ai récupéré le colis
            </button>
          )}
          {job.status === 'PICKED_UP' && (
            <button
              disabled={busy}
              onClick={() => changeStatus('IN_TRANSIT')}
              className="bg-nuit text-brume text-sm font-medium px-5 py-2 hover:bg-nuit/90 transition-colors disabled:opacity-60"
            >
              Je suis en route
            </button>
          )}
          {(job.status === 'PICKED_UP' || job.status === 'IN_TRANSIT') && (
            <button
              disabled={busy}
              onClick={() => setShowProof((v) => !v)}
              className="bg-seve text-white text-sm font-medium px-5 py-2 hover:bg-seve/90 transition-colors disabled:opacity-60"
            >
              Confirmer la livraison
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => changeStatus('FAILED')}
            className="border border-wax text-wax text-sm font-medium px-5 py-2 hover:bg-wax/10 transition-colors disabled:opacity-60"
          >
            Signaler un échec
          </button>
        </div>
      )}

      {showProof && isActive && (
        <div className="mt-5 pt-5 border-t border-encre/10 space-y-3">
          <p className="text-sm font-medium">Preuve de livraison (obligatoire)</p>
          <select
            value={proofType}
            onChange={(e) => setProofType(e.target.value as ProofType)}
            className="w-full border border-encre/20 px-3 py-2 text-sm"
          >
            <option value="PHOTO">Photo du colis remis</option>
            <option value="SIGNATURE">Signature du client</option>
            <option value="OTP_CODE">Code communiqué par le client</option>
          </select>

          {proofType === 'OTP_CODE' ? (
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Code du client"
              className="w-full border border-encre/20 px-3 py-2 text-sm"
            />
          ) : (
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="Lien du fichier (l'envoi direct n'est pas encore branché)"
              className="w-full border border-encre/20 px-3 py-2 text-sm"
            />
          )}

          <button
            disabled={busy || !proofReady}
            onClick={complete}
            className="bg-seve text-white text-sm font-medium px-5 py-2 hover:bg-seve/90 transition-colors disabled:opacity-50"
          >
            {busy ? 'Confirmation…' : 'Valider la remise'}
          </button>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-wax">{error}</p>}
    </div>
  );
}
