import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Handshake,
  Check,
  Send,
  ShieldCheck,
  ArrowRight,
  Truck,
  ExternalLink,
  MapPin,
  Navigation,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useStore } from '../lib/store-context';
import type { ChatMessage, Conversation, NegotiationOffer } from '../lib/types';

interface EnrichedConversation extends Conversation {
  city?: string;
  storeId?: string;
  negotiationId?: string;
}

const KINSHASA_ZONES = [
  { label: 'Gombe · Boulevard 30 Juin', lat: -4.3015, lng: 15.3052 },
  { label: 'Ngaliema · Macampagne', lat: -4.3412, lng: 15.2654 },
  { label: 'Limete · 7ème Rue Industrielle', lat: -4.3592, lng: 15.3442 },
  { label: 'Kalamu · Rond-Point Victoire', lat: -4.3376, lng: 15.3081 },
  { label: 'Matete · Marché Central', lat: -4.3845, lng: 15.3612 },
];

function extractGoogleMapsCoords(raw: string): { lat: number; lng: number } | null {
  const atMatch = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
  const qMatch = raw.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
  const plainMatch = raw.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (plainMatch) return { lat: Number(plainMatch[1]), lng: Number(plainMatch[2]) };
  return null;
}

export function ChatPage() {
  const { user } = useAuth();
  const { formatPrimaryPrice } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedId = (location.state as { conversationId?: string } | null)?.conversationId;

  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [negotiations, setNegotiations] = useState<NegotiationOffer[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [acceptingNotice, setAcceptingNotice] = useState<string | null>(null);

  // Google Maps Sharing & Delivery Fee Negotiation inside Chat
  const [mapsModalOpen, setMapsModalOpen] = useState(false);
  const [mapsUrlInput, setMapsUrlInput] = useState('');
  const [deliveryOfferInput, setDeliveryOfferInput] = useState('5');
  const [deliveryBusy, setDeliveryBusy] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  function loadAll() {
    api
      .get<NegotiationOffer[]>('/negotiations')
      .then(({ data }) => setNegotiations(data || []))
      .catch(() => {});

    api
      .get<EnrichedConversation[]>('/chat/conversations')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setConversations(data);
          const requested = requestedId && data.find((c) => c.id === requestedId);
          setActiveId((prev) => (requested ? requested.id : prev || data[0].id));
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadAll();
  }, [requestedId]);

  useEffect(() => {
    const activeConv = conversations.find((c) => c.id === activeId);
    if (activeConv) {
      setMessages(activeConv.messages || []);
      if (activeConv.deliveryNegotiation) {
        setDeliveryOfferInput(String(activeConv.deliveryNegotiation.proposedFeeUsd));
      }
    }
  }, [activeId, conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || !activeId || sending) return;

    const optimisticMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      conversationId: activeId,
      senderId: user?.id || 'usr-1',
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, messages: [...(c.messages || []), optimisticMsg] } : c)),
    );
    setDraft('');
    setSending(true);
    try {
      await api.post(`/chat/conversations/${activeId}/messages`, { content });
    } finally {
      setSending(false);
    }
  }

  async function handleAcceptNegotiatedQuote(neg: NegotiationOffer) {
    setAcceptingNotice('Validation du prix convenu et ajout au panier…');
    try {
      await api.post(`/negotiations/${neg.id}/accept`);
      setAcceptingNotice('Offre spéciale ajoutée au panier avec le tarif négocié !');
      setTimeout(() => {
        navigate('/cart');
      }, 1000);
    } catch {
      setAcceptingNotice('Erreur lors de la validation.');
    }
  }

  async function handleSendLocation(coords: { lat: number; lng: number }, label: string, customUrl?: string) {
    if (!activeId) return;
    setDeliveryBusy(true);
    try {
      const googleMapsUrl =
        customUrl && customUrl.startsWith('http')
          ? customUrl
          : `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
      const { data } = await api.post(`/chat/conversations/${activeId}/location`, {
        lat: coords.lat,
        lng: coords.lng,
        label,
        googleMapsUrl,
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                clientLocation: data.location,
                distanceKm: data.distanceKm,
                messages: [...(c.messages || []), data.message],
              }
            : c,
        ),
      );
      setMapsModalOpen(false);
      setMapsUrlInput('');
      setAcceptingNotice(`Position Google Maps partagée (${data.distanceKm} km calculés jusqu’au point de livraison).`);
    } finally {
      setDeliveryBusy(false);
    }
  }

  async function handleDeliveryOffer(action: 'PROPOSE' | 'ACCEPT') {
    if (!activeId) return;
    const feeUsd = Math.max(0, Number(deliveryOfferInput) || 0);
    setDeliveryBusy(true);
    try {
      const { data } = await api.post(`/chat/conversations/${activeId}/delivery-offer`, {
        action,
        feeUsd,
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                deliveryNegotiation: data.deliveryNegotiation,
                messages: [...(c.messages || []), data.message],
              }
            : c,
        ),
      );
      setAcceptingNotice(
        action === 'ACCEPT'
          ? `Tarif livraison validé à $${feeUsd.toFixed(2)} ! Vous pouvez maintenant payer la commande.`
          : `Offre de $${feeUsd.toFixed(2)} envoyée au livreur.`,
      );
    } finally {
      setDeliveryBusy(false);
    }
  }

  const activeConv = conversations.find((c) => c.id === activeId);
  const activeNegotiation =
    negotiations.find((n) => n.id === activeConv?.negotiationId) ||
    negotiations.find(
      (n) =>
        activeConv?.type === 'CUSTOMER_VENDOR' &&
        ((activeConv?.productId && n.productId === activeConv.productId) ||
          (activeConv?.storeId && n.storeId === activeConv.storeId)),
    );

  const initials = (activeConv?.storeName || 'ZG')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Title */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-encre/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider">
            <span className="px-3 py-0.5 rounded-full bg-seve/10 border border-seve/25 text-seve flex items-center gap-1.5 font-bold text-[10px]">
              <MessageSquare className="w-3.5 h-3.5 text-seve" />
              <span>Messagerie Directe & Négociations</span>
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl lg:text-3xl font-extrabold text-nuit tracking-tight">
            Échanges Vendeurs & Livreurs
          </h1>
          <p className="mt-1 text-xs text-encre/60">
            Discutez le prix du produit ou négociez le tarif avec votre livreur avant de payer en envoyant votre localisation Google Maps.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono bg-nuit text-brume px-3.5 py-2 rounded-card border border-white/10 shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-safran" />
          <span className="text-safran font-semibold">Séquestre MaishaPay Actif</span>
        </div>
      </div>

      {acceptingNotice && (
        <div className="mt-4 p-3.5 rounded-card bg-seve/10 border border-seve/30 text-xs font-medium text-seve flex items-center gap-2">
          <Check className="w-4 h-4 text-seve shrink-0" />
          <span>{acceptingNotice}</span>
        </div>
      )}

      {/* Main Chat & Negotiation Box */}
      <div className="mt-6 grid md:grid-cols-[310px_1fr] border border-encre/10 bg-white rounded-card overflow-hidden shadow-sm h-[42rem]">
        {/* Left: Conversations list */}
        <div className="border-r border-encre/10 flex flex-col bg-brume/50">
          <div className="p-3.5 border-b border-encre/10 text-xs font-display font-bold text-nuit uppercase tracking-wider flex items-center justify-between">
            <span>Conversations ({conversations.length})</span>
            <span className="text-[10px] font-mono text-seve font-semibold bg-seve/10 px-2 py-0.5 rounded border border-seve/25">
              RDC
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-encre/5">
            {conversations.length === 0 ? (
              <div className="p-6 text-xs text-encre/50 text-center">Aucune conversation active.</div>
            ) : (
              conversations.map((c) => {
                const active = c.id === activeId;
                const lastMsg = c.messages[c.messages.length - 1];
                const isDelivery = c.type === 'CUSTOMER_DELIVERY';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-4 transition ${
                      active ? 'bg-nuit text-brume border-l-4 border-seve shadow-xs' : 'hover:bg-encre/5 text-encre'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`font-display font-bold text-xs truncate ${active ? 'text-brume' : 'text-nuit'}`}>
                        {c.storeName || 'Boutique Partenaire'}
                      </span>
                      <span className={`text-[10px] font-mono shrink-0 ${active ? 'text-safran' : 'text-encre/40'}`}>
                        {lastMsg
                          ? new Date(lastMsg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>
                    <p className={`text-xs line-clamp-2 leading-relaxed ${active ? 'text-brume/75' : 'text-encre/60'}`}>
                      {lastMsg ? lastMsg.content : 'Nouvelle conversation'}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          active
                            ? 'bg-safran/20 text-safran border border-safran/35'
                            : 'bg-seve/10 text-seve border border-seve/25'
                        }`}
                      >
                        {isDelivery ? <Truck className="w-3 h-3" /> : <Handshake className="w-3 h-3" />}
                        <span>{isDelivery ? 'Livreur · Tarif & Maps' : 'Devis & Prix'}</span>
                      </span>
                      {c.city && (
                        <span className={`text-[10px] font-sans truncate ${active ? 'text-brume/60' : 'text-encre/50'}`}>
                          · {c.city}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Active Chat Workspace */}
        <div className="flex flex-col min-h-0 bg-white">
          <div className="px-6 py-3 border-b border-encre/10 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-card bg-nuit text-safran font-display font-bold text-xs flex items-center justify-center shrink-0 border border-white/10">
                {initials}
              </div>
              <div>
                <p className="font-display font-bold text-xs text-nuit">
                  {activeConv?.storeName || 'Boutique Partenaire'}
                </p>
                <p className="text-[10px] text-seve font-sans flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-seve" />
                  <span>
                    {activeConv?.type === 'CUSTOMER_DELIVERY'
                      ? `Coursier certifié · ${activeConv.distanceKm ? `${activeConv.distanceKm} km` : 'GPS prêt'}`
                      : 'Vendeur Vérifié RDC · En ligne'}
                  </span>
                </p>
              </div>
            </div>

            {activeConv?.type === 'CUSTOMER_DELIVERY' ? (
              <button
                type="button"
                onClick={() => setMapsModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-seve/10 hover:bg-seve/20 text-seve border border-seve/30 text-xs font-display font-bold transition"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Partager Google Maps</span>
              </button>
            ) : (
              <span className="text-[10px] font-mono text-encre/40 uppercase">#{activeId || 'CONV'}</span>
            )}
          </div>

          {/* Product Anchor Banner */}
          {activeConv && (
            <div className="px-6 py-2.5 bg-brume/50 border-b border-encre/10 flex items-center justify-between gap-4 shrink-0 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={activeConv.productImage || '/src/assets/images/marketplace_parcel_default_1794567970796.jpg'}
                  alt={activeConv.productTitle || 'Produit lié'}
                  className="w-10 h-10 rounded-lg object-cover border border-encre/10 shrink-0"
                />
                <div className="truncate">
                  <span className="text-[10px] uppercase font-display font-bold text-seve tracking-wider block">
                    Objet de la discussion :
                  </span>
                  <span className="font-bold text-nuit truncate block text-xs">
                    {activeConv.productTitle || 'Demande commerciale ZandoGo'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {activeConv.productPriceUsd && (
                  <div className="text-right">
                    <span className="text-[10px] text-encre/50 font-mono block">Tarif affiché</span>
                    <span className="font-display font-bold text-nuit tabular-nums">
                      {formatPrimaryPrice(activeConv.productPriceUsd)}
                    </span>
                  </div>
                )}
                <Link
                  to={activeConv.productId ? `/products/${activeConv.productId}` : '/products'}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-seve hover:text-seve/80 bg-seve/10 px-2.5 py-1.5 rounded-card border border-seve/25 transition"
                >
                  <span>Fiche</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          {/* Delivery Fee Negotiation Card (BEFORE PAYMENT) */}
          {activeConv?.type === 'CUSTOMER_DELIVERY' && activeConv.deliveryNegotiation && (
            <div className="m-4 p-4 rounded-card bg-nuit text-brume border border-white/10 shrink-0 shadow-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-safran/20 text-safran border border-safran/35 flex items-center gap-1">
                    <Handshake className="w-3 h-3" />
                    <span>
                      {activeConv.deliveryNegotiation.status === 'AGREED'
                        ? 'Tarif livraison convenu ✓'
                        : activeConv.deliveryNegotiation.status === 'COUNTERED'
                        ? 'Contre-proposition du livreur'
                        : 'Discussion tarif livraison (avant paiement)'}
                    </span>
                  </span>
                  {activeConv.distanceKm && (
                    <span className="text-[11px] font-mono text-brume/70">
                      Distance GPS : {activeConv.distanceKm} km
                    </span>
                  )}
                </div>

                {activeConv.clientLocation && (
                    <a
                      href={activeConv.clientLocation.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-safran hover:underline"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Voir point Google Maps ↗</span>
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-brume/70">Proposer / ajuster :</span>
                    <div className="relative w-24">
                      <span className="absolute left-2.5 top-1.5 font-mono text-safran font-bold">$</span>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={deliveryOfferInput}
                        onChange={(e) => setDeliveryOfferInput(e.target.value)}
                        className="w-full pl-6 pr-2 py-1 rounded-lg bg-white/10 border border-white/20 text-xs font-display font-bold text-brume outline-none focus:border-safran"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={deliveryBusy}
                      onClick={() => handleDeliveryOffer('PROPOSE')}
                      className="px-3 py-1.5 rounded-lg bg-safran text-nuit font-display font-bold text-xs hover:bg-safran/90 transition"
                    >
                    Proposer
                  </button>
                  {activeConv.deliveryNegotiation.status !== 'AGREED' && (
                    <button
                      type="button"
                      disabled={deliveryBusy}
                      onClick={() => handleDeliveryOffer('ACCEPT')}
                      className="px-3 py-1.5 rounded-lg bg-seve text-brume font-display font-bold text-xs hover:bg-seve/90 transition"
                    >
                      Valider ce tarif
                    </button>
                  )}
                </div>

                <Link
                  to="/orders"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-nuit font-display font-bold text-xs hover:bg-brume transition"
                >
                  <span>Payer la commande</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Negotiation Card if tied to vendor conversation */}
          {activeNegotiation && activeConv?.type === 'CUSTOMER_VENDOR' && (
            <div className="m-4 p-4 rounded-card bg-nuit text-brume border border-white/10 shrink-0 shadow-lg">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-sans font-bold bg-seve/20 text-seve border border-seve/30 flex items-center gap-1">
                      <Check className="w-3 h-3 text-seve" />
                      <span>
                        {activeNegotiation.status === 'ACCEPTED_BY_VENDOR'
                          ? 'Accord Validé par le Fournisseur'
                          : activeNegotiation.status === 'CONVERTED_TO_ORDER'
                          ? 'Transféré au panier'
                          : 'Proposition envoyée au vendeur'}
                      </span>
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 pt-1 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-[10px] text-brume/60 font-sans block uppercase">1. Prix Article</span>
                      <p className="text-brume mt-0.5 font-display">
                        <strong className="text-safran text-sm tabular-nums">
                          ${activeNegotiation.agreedPriceUsd || activeNegotiation.requestedPriceUsd}
                        </strong>{' '}
                        / unité × {activeNegotiation.requestedQty} pcs
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-[10px] text-brume/60 font-sans block uppercase">2. Transport</span>
                      <p className="text-brume mt-0.5 flex items-center gap-1 font-display">
                        <Truck className="w-3.5 h-3.5 text-seve shrink-0" />
                        <span className="truncate">{activeNegotiation.transportMode || 'Coursier Express'}</span>
                      </p>
                      <span className="text-[10px] text-seve font-mono font-semibold block mt-0.5">
                        ${activeNegotiation.agreedDeliveryFeeUsd ?? activeNegotiation.requestedDeliveryFeeUsd ?? 3.5} (
                        {activeNegotiation.destinationCity || 'Kinshasa'})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end justify-between gap-2 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-brume/60 font-sans block">Total convenu</span>
                    <span className="text-lg font-display font-extrabold text-safran tabular-nums">
                      $
                      {(
                        (activeNegotiation.agreedPriceUsd || activeNegotiation.requestedPriceUsd) *
                          activeNegotiation.requestedQty +
                        (activeNegotiation.agreedDeliveryFeeUsd ?? activeNegotiation.requestedDeliveryFeeUsd ?? 3.5)
                      ).toFixed(2)}
                    </span>
                  </div>

                  {activeNegotiation.status === 'ACCEPTED_BY_VENDOR' && (
                    <button
                      type="button"
                      onClick={() => handleAcceptNegotiatedQuote(activeNegotiation)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition shadow-xs"
                    >
                      <span>Commander au prix négocié</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-brume/30">
            {messages.map((m) => {
              const mine = m.senderId === user?.id || m.senderId === 'usr-me' || m.senderId === 'usr-1';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] px-4 py-2.5 rounded-card text-xs leading-relaxed space-y-2 ${
                      mine
                        ? 'bg-seve text-brume rounded-br-none shadow-xs font-sans'
                        : 'bg-white text-encre border border-encre/10 rounded-bl-none shadow-xs font-sans'
                    }`}
                  >
                    <p>{m.content}</p>

                    {m.location && (
                      <a
                        href={m.location.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block p-2.5 rounded-lg border text-[11px] transition ${
                          mine
                            ? 'bg-nuit/35 border-white/20 text-safran hover:bg-nuit/50'
                            : 'bg-brume border-seve/30 text-seve hover:bg-seve/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-display font-bold">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span>{m.location.label || 'Point Google Maps'}</span>
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </div>
                        <span className="block font-mono text-[10px] opacity-80 mt-0.5">
                          GPS : {m.location.lat.toFixed(4)}, {m.location.lng.toFixed(4)}
                          {m.location.distanceKm ? ` · Distance ${m.location.distanceKm} km` : ''}
                        </span>
                      </a>
                    )}

                    {m.deliveryProposal && (
                      <div
                        className={`p-2 rounded-lg text-[11px] font-mono ${
                          mine ? 'bg-white/10 text-brume' : 'bg-safran/20 text-nuit border border-safran/40'
                        }`}
                      >
                        Tarif course proposé : <strong>${m.deliveryProposal.feeUsd.toFixed(2)}</strong>
                      </div>
                    )}

                    <span
                      className={`block text-[9px] font-mono mt-1 ${
                        mine ? 'text-brume/70 text-right' : 'text-encre/40'
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 border-t border-encre/10 bg-white flex items-center gap-2">
            {activeConv?.type === 'CUSTOMER_DELIVERY' && (
              <button
                type="button"
                onClick={() => setMapsModalOpen(true)}
                className="p-2.5 rounded-card border border-encre/15 text-seve hover:bg-seve/10 transition shrink-0"
                title="Envoyer ma localisation Google Maps"
              >
                <MapPin className="w-4 h-4" />
              </button>
            )}
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire votre message (tarif course, repères, délai…)..."
              className="flex-1 px-4 py-2.5 rounded-card border border-encre/20 text-xs text-encre outline-none focus:border-seve focus:ring-1 focus:ring-seve bg-white placeholder-encre/40"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="px-5 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition disabled:opacity-40 flex items-center gap-1.5 shadow-xs"
            >
              <span>Envoyer</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Share Google Maps Modal */}
      {mapsModalOpen && (
        <div className="fixed inset-0 z-50 bg-nuit/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-card max-w-md w-full p-6 shadow-2xl border border-encre/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base text-nuit flex items-center gap-2">
                <MapPin className="w-4 h-4 text-seve" />
                <span>Envoyer ma localisation Google Maps</span>
              </h3>
              <button type="button" onClick={() => setMapsModalOpen(false)} className="text-encre/40 hover:text-nuit">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-encre/65">
              Permettez au livreur de voir votre position exacte sur Google Maps et de convenir d’un prix juste selon le kilométrage réel.
            </p>

            <button
              type="button"
              disabled={deliveryBusy}
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) =>
                      handleSendLocation(
                        { lat: pos.coords.latitude, lng: pos.coords.longitude },
                        'Ma position GPS en direct',
                      ),
                    () => handleSendLocation({ lat: -4.325, lng: 15.322 }, 'Position Kinshasa Centre'),
                    { timeout: 5000 },
                  );
                } else {
                  handleSendLocation({ lat: -4.325, lng: 15.322 }, 'Position Kinshasa Centre');
                }
              }}
              className="w-full py-2.5 px-4 rounded-card bg-seve text-brume font-display font-bold text-xs hover:bg-seve/90 transition flex items-center justify-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              <span>Utiliser ma position GPS actuelle</span>
            </button>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-encre/60">
                Ou sélectionner un repère Kinshasa :
              </p>
              <div className="flex flex-wrap gap-1.5">
                {KINSHASA_ZONES.map((z) => (
                  <button
                    key={z.label}
                    type="button"
                    disabled={deliveryBusy}
                    onClick={() => handleSendLocation({ lat: z.lat, lng: z.lng }, z.label)}
                    className="px-2.5 py-1 rounded-full border border-encre/15 bg-brume/60 hover:border-seve text-[11px] font-medium text-nuit transition"
                  >
                    {z.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-encre/10 space-y-2">
              <label className="block text-[11px] font-semibold text-encre/75">
                Ou coller un lien Google Maps partagé :
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mapsUrlInput}
                  onChange={(e) => setMapsUrlInput(e.target.value)}
                  placeholder="https://www.google.com/maps/@-4.331,15.312,15z"
                  className="flex-1 rounded-card border border-encre/20 px-3 py-2 text-xs outline-none focus:border-seve"
                />
                <button
                  type="button"
                  disabled={!mapsUrlInput.trim() || deliveryBusy}
                  onClick={() => {
                    const parsed = extractGoogleMapsCoords(mapsUrlInput.trim()) || { lat: -4.329, lng: 15.314 };
                    handleSendLocation(parsed, 'Lien Google Maps client', mapsUrlInput.trim());
                  }}
                  className="px-4 py-2 rounded-card bg-nuit text-brume text-xs font-display font-bold disabled:opacity-40"
                >
                  Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
