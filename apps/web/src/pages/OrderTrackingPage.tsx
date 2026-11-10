import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

interface DeliveryInfo {
  id: string;
  status: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  agent: { user: { fullName: string } } | null;
}

const STATUS_LABEL: Record<string, string> = {
  AWAITING_ASSIGNMENT: "Recherche d'un livreur…",
  ASSIGNED: 'Livreur assigné, en route vers le vendeur',
  PICKED_UP: 'Colis récupéré',
  IN_TRANSIT: 'En route vers vous',
  DELIVERED: 'Livré',
  FAILED: 'Échec de la livraison',
};

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [delivery, setDelivery] = useState<DeliveryInfo | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number; recordedAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    api
      .get<DeliveryInfo[]>(`/delivery/by-order/${orderId}`)
      .then(({ data }) => {
        if (data.length === 0) {
          setError("Aucune livraison n'a encore été créée pour cette commande.");
        } else {
          setDelivery(data[0]);
        }
      })
      .catch(() => setError('Impossible de charger le suivi de cette commande.'));
  }, [orderId]);

  useEffect(() => {
    if (!delivery) return;
    // Capturé ici : dans les fonctions imbriquées ci-dessous, TypeScript ne garde plus
    // l'information que `delivery` n'est pas nul.
    const deliveryId = delivery.id;

    const socket = getSocket('/tracking');
    socket.emit('tracking:join', deliveryId);

    function onLocation(update: { deliveryId: string; lat: number; lng: number; recordedAt: string }) {
      if (update.deliveryId === deliveryId) setPosition(update);
    }
    function onStatus(update: { deliveryId: string; status: string }) {
      if (update.deliveryId === deliveryId) {
        setDelivery((prev) => (prev ? { ...prev, status: update.status } : prev));
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

  if (error) return <div className="mx-auto max-w-2xl px-6 py-20 text-encre/60">{error}</div>;
  if (!delivery) return <div className="mx-auto max-w-2xl px-6 py-20 text-encre/50">Chargement…</div>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Suivi de livraison</h1>

      <div className="mt-8 border border-encre/10 p-6">
        <p className="text-sm text-encre/50">Statut</p>
        <p className="font-display text-xl font-semibold mt-1">
          {STATUS_LABEL[delivery.status] ?? delivery.status}
        </p>
        {delivery.agent && (
          <p className="mt-2 text-sm text-encre/60">Livreur : {delivery.agent.user.fullName}</p>
        )}
      </div>

      <div className="mt-6 border border-encre/10 p-6">
        <p className="text-sm text-encre/50">Position en direct</p>
        {position ? (
          <>
            <p className="mt-2">
              Dernière mise à jour : {new Date(position.recordedAt).toLocaleTimeString('fr-FR')}
            </p>
            <a
              href={mapsUrl(position.lat, position.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-seve hover:underline"
            >
              Voir sur la carte
            </a>
          </>
        ) : (
          <p className="mt-2 text-encre/60">
            Aucune position reçue pour l'instant — elle apparaîtra ici dès que le livreur sera en
            route.
          </p>
        )}
      </div>

      <div className="mt-6 flex gap-6 text-sm">
        <a
          href={mapsUrl(delivery.pickupLat, delivery.pickupLng)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-seve hover:underline"
        >
          Point de retrait
        </a>
        <a
          href={mapsUrl(delivery.dropoffLat, delivery.dropoffLng)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-seve hover:underline"
        >
          Point de livraison
        </a>
      </div>

      <p className="mt-8 text-xs text-encre/40">
        Cette page se met à jour automatiquement en direct — inutile de recharger.
      </p>
    </div>
  );
}
