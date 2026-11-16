import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MapPin,
  Navigation,
  Truck,
  CheckCircle2,
  ShieldCheck,
  Phone,
  MessageSquare,
  Play,
  Pause,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { DeliveryJob } from '../lib/types';

const STEPS: { key: DeliveryJob['status']; label: string; desc: string }[] = [
  { key: 'ASSIGNED', label: 'Coursier assigné', desc: 'En route vers la boutique pour enlèvement' },
  { key: 'PICKED_UP', label: 'Colis récupéré', desc: 'Vérifié et pris en charge par le livreur' },
  { key: 'IN_TRANSIT', label: 'En cours de livraison', desc: 'Acheminement vers votre adresse RDC' },
  { key: 'DELIVERED', label: 'Colis remis', desc: 'Preuve & code OTP validés' },
];

const STATUS_LABEL: Record<string, string> = {
  AWAITING_ASSIGNMENT: "Recherche d'un livreur…",
  ASSIGNED: 'Livreur assigné, en route vers le vendeur',
  PICKED_UP: 'Colis récupéré en boutique',
  IN_TRANSIT: 'En route vers vous',
  DELIVERED: 'Colis livré',
  FAILED: 'Échec de la livraison',
};

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [delivery, setDelivery] = useState<DeliveryJob | null>(null);
  const [progress, setProgress] = useState<number>(0.58);
  const [simulating, setSimulating] = useState<boolean>(true);
  const [position, setPosition] = useState<{ lat: number; lng: number; recordedAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    api
      .get<DeliveryJob[]>(`/delivery/by-order/${orderId}`)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          setError("Aucune livraison n'a encore été créée pour cette commande.");
        } else {
          const job = data[0];
          setDelivery(job);
          if (job.status === 'DELIVERED') {
            setProgress(1);
            setSimulating(false);
          } else if (job.status === 'ASSIGNED') {
            setProgress(0.2);
          } else if (job.status === 'PICKED_UP') {
            setProgress(0.4);
          }
          const lastPing = job.trackingPings?.[job.trackingPings.length - 1];
          if (lastPing) {
            setPosition(lastPing);
          } else {
            setPosition({
              lat: job.pickupLat + (job.dropoffLat - job.pickupLat) * 0.58,
              lng: job.pickupLng + (job.dropoffLng - job.pickupLng) * 0.58,
              recordedAt: new Date().toISOString(),
            });
          }
        }
      })
      .catch(() => setError('Impossible de charger le suivi de cette commande.'));
  }, [orderId]);

  // WebSocket live tracking listener
  useEffect(() => {
    if (!delivery) return;
    const deliveryId = delivery.id;

    const socket = getSocket('/tracking');
    socket.emit('tracking:join', deliveryId);

    function onLocation(update: { deliveryId: string; lat: number; lng: number; recordedAt: string }) {
      if (update.deliveryId === deliveryId) setPosition(update);
    }
    function onStatus(update: { deliveryId: string; status: string }) {
      if (update.deliveryId === deliveryId) {
        setDelivery((prev) => (prev ? { ...prev, status: update.status as DeliveryJob['status'] } : prev));
      }
    }

    socket.on('delivery:location_update', onLocation);
    socket.on('delivery:status_change', onStatus);

    return () => {
      socket.emit('tracking:leave', deliveryId);
      socket.off('delivery:location_update', onLocation);
      socket.off('delivery:status_change', onStatus);
    };
  }, [delivery?.id]);

  // Smooth preview telemetry simulation along the Goma route
  useEffect(() => {
    if (!delivery || !simulating || delivery.status === 'DELIVERED') return;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev >= 0.96 ? 0.22 : Number((prev + 0.04).toFixed(2));
        const nextLat = delivery.pickupLat + (delivery.dropoffLat - delivery.pickupLat) * next;
        const nextLng = delivery.pickupLng + (delivery.dropoffLng - delivery.pickupLng) * next;
        setPosition({
          lat: Number(nextLat.toFixed(5)),
          lng: Number(nextLng.toFixed(5)),
          recordedAt: new Date().toISOString(),
        });
        return next;
      });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [delivery, simulating]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center space-y-4">
        <p className="text-encre/70 text-sm">{error}</p>
        <Link to="/orders" className="inline-flex items-center gap-1.5 text-xs font-semibold text-seve hover:underline">
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux commandes</span>
        </Link>
      </div>
    );
  }
  if (!delivery) {
    return <div className="mx-auto max-w-3xl px-6 py-20 text-encre/50 font-mono text-xs">Chargement du suivi GPS…</div>;
  }

  const currentStepIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.key === delivery.status),
  );

  // SVG Route Coordinates (start at 75,215 -> curve -> end at 525,75)
  const p0 = { x: 75, y: 215 };
  const ctrl = { x: 295, y: 115 };
  const p2 = { x: 525, y: 75 };
  const t = delivery.status === 'DELIVERED' ? 1 : progress;
  const markerX = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * ctrl.x + t * t * p2.x;
  const markerY = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * ctrl.y + t * t * p2.y;
  const etaMinutes = Math.max(1, Math.round((1 - t) * 24));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/orders" className="inline-flex items-center gap-1.5 text-xs font-semibold text-encre/60 hover:text-nuit mb-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour à mes commandes</span>
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-nuit">
            Suivi GPS — {delivery.subOrder.order.orderNumber}
          </h1>
          <p className="text-xs text-encre/60 mt-1">
            Retrait : <strong className="text-nuit">{delivery.subOrder.store.storeName}</strong> → Livraison :{' '}
            <strong className="text-nuit">
              {delivery.subOrder.order.deliveryAddress?.commune || 'Goma (Himbi)'},{' '}
              {delivery.subOrder.order.deliveryAddress?.quartier || 'Centre'}
            </strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {delivery.status !== 'DELIVERED' && (
            <button
              type="button"
              onClick={() => setSimulating((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-card border border-encre/15 bg-white hover:border-seve text-xs font-semibold text-nuit transition shadow-xs"
            >
              {simulating ? <Pause className="w-3.5 h-3.5 text-safran" /> : <Play className="w-3.5 h-3.5 text-seve" />}
              <span>{simulating ? 'Pause télémétrie' : 'Simuler trajet en direct'}</span>
            </button>
          )}
          <span className="px-3.5 py-2 rounded-card bg-nuit text-safran font-display font-bold text-xs">
            {delivery.status === 'DELIVERED' ? 'Livré' : `ETA ~ ${etaMinutes} min`}
          </span>
        </div>
      </div>

      {/* Milestone Stepper */}
      <div className="rounded-card border border-encre/10 bg-white p-5 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STEPS.map((st, idx) => {
            const done = idx <= currentStepIdx;
            const current = idx === currentStepIdx;
            return (
              <div
                key={st.key}
                className={`p-3 rounded-card border transition ${
                  current
                    ? 'border-seve bg-seve/5'
                    : done
                    ? 'border-seve/30 bg-brume/40'
                    : 'border-encre/10 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-display font-bold shrink-0 ${
                      done ? 'bg-seve text-brume' : 'bg-encre/10 text-encre/60'
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <span className="font-display font-bold text-xs text-nuit">{st.label}</span>
                </div>
                <p className="text-[11px] text-encre/65 mt-1.5 leading-snug">{st.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_0.9fr] gap-6 items-start">
        {/* Interactive Corridor Map */}
        <div className="rounded-card border border-encre/10 bg-white overflow-hidden shadow-xs">
          <div className="px-5 py-3.5 border-b border-encre/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-display font-bold text-nuit">
              <Navigation className="w-4 h-4 text-seve" />
              <span>Corridor Urbain & Télémétrie en Direct</span>
            </div>
            <span className="font-mono text-[11px] text-seve font-semibold flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-seve animate-pulse" />
              SIGNAL ACTIF
            </span>
          </div>

          <div className="relative bg-brume">
            <svg viewBox="0 0 600 280" className="w-full h-auto block" role="img" aria-label="Carte de trajet livraison RDC">
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#202A27" strokeOpacity="0.06" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="600" height="280" fill="url(#grid)" />

              {/* Stylized Lake Kivu & Goma main boulevards */}
              <path d="M 0 38 Q 220 12 420 44 T 600 28" fill="none" stroke="#26735B" strokeOpacity="0.16" strokeWidth="26" />
              <text x="20" y="25" fontSize="10" fill="#26735B" opacity="0.6" fontFamily="monospace">
                LAC KIVU · GOMA
              </text>
              <path d="M 30 230 L 570 95" stroke="#202A27" strokeOpacity="0.08" strokeWidth="8" strokeLinecap="round" />
              <path d="M 140 50 L 340 265" stroke="#202A27" strokeOpacity="0.07" strokeWidth="6" strokeLinecap="round" />

              {/* Planned delivery route */}
              <path
                d={`M ${p0.x} ${p0.y} Q ${ctrl.x} ${ctrl.y} ${p2.x} ${p2.y}`}
                fill="none"
                stroke="#172320"
                strokeOpacity="0.22"
                strokeWidth="4"
                strokeDasharray="7 6"
              />

              {/* Active progress trace */}
              <path
                d={`M ${p0.x} ${p0.y} Q ${(p0.x + markerX) / 2} ${(p0.y + markerY) / 2 - 18} ${markerX} ${markerY}`}
                fill="none"
                stroke="#26735B"
                strokeWidth="4.5"
                strokeLinecap="round"
              />

              {/* Pickup Hub */}
              <circle cx={p0.x} cy={p0.y} r="9" fill="#172320" stroke="#F6F4EE" strokeWidth="3" />
              <rect x={p0.x - 10} y={p0.y + 14} width="136" height="24" rx="6" fill="#ffffff" stroke="#202A27" strokeOpacity="0.15" />
              <text x={p0.x - 2} y={p0.y + 30} fontSize="10" fontWeight="bold" fill="#172320" fontFamily="sans-serif">
                Retrait · {delivery.subOrder.store.storeName.slice(0, 18)}
              </text>

              {/* Dropoff Destination */}
              <circle cx={p2.x} cy={p2.y} r="10" fill="#B84C43" stroke="#F6F4EE" strokeWidth="3" />
              <rect x={p2.x - 135} y={p2.y - 34} width="142" height="24" rx="6" fill="#172320" />
              <text x={p2.x - 126} y={p2.y - 18} fontSize="10" fontWeight="bold" fill="#F2B84B" fontFamily="sans-serif">
                Client · {delivery.subOrder.order.deliveryAddress?.commune || 'Goma (Himbi)'}
              </text>

              {/* Moving Courier Marker */}
              <g transform={`translate(${markerX}, ${markerY})`}>
                <circle r="18" fill="#26735B" fillOpacity="0.18" />
                <circle r="11" fill="#F2B84B" stroke="#172320" strokeWidth="2.5" />
                <circle r="3.5" fill="#172320" />
              </g>
            </svg>
          </div>

          <div className="p-4 bg-white border-t border-encre/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="font-mono text-encre/70 tabular-nums">
              {position ? (
                <span>
                  GPS : {position.lat.toFixed(4)}, {position.lng.toFixed(4)} · MàJ{' '}
                  {new Date(position.recordedAt).toLocaleTimeString('fr-FR')}
                </span>
              ) : (
                <span>En attente du premier ping GPS…</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <a
                href={mapsUrl(delivery.pickupLat, delivery.pickupLng)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-seve hover:underline font-medium inline-flex items-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Retrait Maps</span>
              </a>
              <a
                href={mapsUrl(position?.lat ?? delivery.dropoffLat, position?.lng ?? delivery.dropoffLng)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-nuit hover:underline font-semibold inline-flex items-center gap-1"
              >
                <Navigation className="w-3.5 h-3.5 text-seve" />
                <span>Ouvrir Google Maps ↗</span>
              </a>
            </div>
          </div>
        </div>

        {/* Right Info Stack: Courier + OTP Code + Escrow */}
        <div className="space-y-4">
          <div className="rounded-card border border-encre/10 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-display font-bold text-seve">
                Statut Actuel
              </span>
              <Truck className="w-4 h-4 text-seve" />
            </div>
            <p className="font-display text-lg font-bold text-nuit">
              {STATUS_LABEL[delivery.status] ?? delivery.status}
            </p>

            {delivery.agent && (
              <div className="pt-3 border-t border-encre/10 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-nuit">{delivery.agent.user.fullName}</p>
                  <p className="text-[11px] text-encre/60">
                    {delivery.agent.vehicleType || 'Moto Express'} · {delivery.distanceKm ? `${delivery.distanceKm} km` : 'Goma · Nord-Kivu'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {delivery.agent.user.phone && (
                    <a
                      href={`tel:${delivery.agent.user.phone}`}
                      className="p-2 rounded-lg bg-brume text-nuit hover:bg-encre/10 transition"
                      title={delivery.agent.user.phone}
                    >
                      <Phone className="w-4 h-4 text-seve" />
                    </a>
                  )}
                  <Link
                    to="/chat"
                    className="p-2 rounded-lg bg-nuit text-safran hover:bg-nuit/90 transition"
                    title="Écrire au coursier"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Handover Security OTP */}
          {delivery.otpCode && (
            <div className="rounded-card bg-nuit text-brume p-5 border border-white/10 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-display font-semibold text-safran">
                  <KeyRound className="w-4 h-4" />
                  <span>Code de Remise Sécurisée (OTP)</span>
                </span>
                <span className="font-mono text-xl font-extrabold tracking-widest text-safran bg-white/10 px-3 py-1 rounded-lg border border-safran/35">
                  {delivery.otpCode}
                </span>
              </div>
              <p className="text-[11px] text-brume/70 leading-relaxed">
                Communiquez ce code à 4 chiffres au livreur uniquement lorsque vous avez inspecté et accepté votre colis.
              </p>
            </div>
          )}

          <div className="rounded-card border border-seve/25 bg-seve/10 p-4 text-xs text-seve flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Votre paiement reste bloqué sous séquestre ZandoGo jusqu’à validation finale de réception.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
