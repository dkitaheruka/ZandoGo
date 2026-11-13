import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  FileText,
  Download,
  MapPin,
  MessageSquare,
  Handshake,
  Smartphone,
  CreditCard,
  Navigation,
} from 'lucide-react';
import { api } from '../lib/api';
import { useStore } from '../lib/store-context';
import { useAuth } from '../lib/auth-context';
import { CardPaymentForm } from '../components/CardPaymentForm';
import type { Address, Currency, Order } from '../lib/types';

type PaymentMethod =
  | 'MOBILE_MONEY_ORANGE'
  | 'MOBILE_MONEY_AIRTEL'
  | 'MOBILE_MONEY_MPESA'
  | 'CARD_STRIPE'
  | 'CASH_ON_DELIVERY';

function parseGoogleMapsCoords(input: string): { lat: number; lng: number } | null {
  const atMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
  const qMatch = input.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
  const rawMatch = input.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (rawMatch) return { lat: Number(rawMatch[1]), lng: Number(rawMatch[2]) };
  return null;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, currency: preferredCurrency, refreshCart, formatPrimaryPrice } = useStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>('');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [currency, setCurrency] = useState<Currency>(preferredCurrency);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [orderTotal, setOrderTotal] = useState<number>(0);
  const [orderDeliveryFee, setOrderDeliveryFee] = useState<number>(0);
  const [noDeliveryNeeded, setNoDeliveryNeeded] = useState<boolean>(false);
  const [deliveryConvId, setDeliveryConvId] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number>(5.2);

  // Pre-payment driver negotiation & Google Maps sharing
  const [proposedDeliveryUsd, setProposedDeliveryUsd] = useState<string>('5');
  const [mapsLinkInput, setMapsLinkInput] = useState<string>('');
  const [negotiationStatusText, setNegotiationStatusText] = useState<string | null>(null);
  const [negotiationBusy, setNegotiationBusy] = useState(false);

  const [method, setMethod] = useState<PaymentMethod>('MOBILE_MONEY_MPESA');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '+243820001122');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [step, setStep] = useState<'address' | 'payment' | 'done'>('address');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addressesLoading, setAddressesLoading] = useState(true);

  const [deliveryOptions, setDeliveryOptions] = useState<any[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('del-opt-express');

  // Post-payment metadata (MaishaPay, Africa's Talking SMS, Instant Digital Downloads)
  const [maishaPayRef, setMaishaPayRef] = useState<string | null>(null);
  const [smsRecipient, setSmsRecipient] = useState<string | null>(null);
  const [digitalDownloads, setDigitalDownloads] = useState<
    { productId: string; title: string; downloadUrl: string; fileName: string }[]
  >([]);

  const cartItems = cart?.items ?? [];
  const onlyDigitalInCart =
    cartItems.length > 0 && cartItems.every((it) => it.variant?.product?.productType === 'DIGITAL');

  useEffect(() => {
    api
      .get<Address[]>('/users/me/addresses')
      .then(({ data }) => {
        setAddresses(data);
        if (data.length > 0) setAddressId(data[0].id);
        else setShowNewAddress(true);
      })
      .catch(() => setMessage("Impossible de charger vos adresses. Réessayez ou contactez le support."))
      .finally(() => setAddressesLoading(false));

    api
      .get<any[]>('/delivery/options')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDeliveryOptions(data);
          setSelectedDeliveryId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const selectedDelivery = deliveryOptions.find((d) => d.id === selectedDeliveryId) || deliveryOptions[0];
  const initialDeliveryFee = onlyDigitalInCart
    ? 0
    : currency === 'CDF'
    ? selectedDelivery?.feeCdf || 0
    : selectedDelivery?.feeUsd || 0;

  async function handleConfirmAddress() {
    if (!onlyDigitalInCart && !addressId) {
      setMessage('Sélectionnez ou créez une adresse de livraison.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.post('/orders/checkout', {
        deliveryAddressId: onlyDigitalInCart ? undefined : addressId,
        currency,
        deliveryOptionId: onlyDigitalInCart ? undefined : selectedDeliveryId,
      });
      setOrderId(data.orderId || data.id);
      setOrderNumber(data.orderNumber || null);
      setOrderTotal(Number(data.total || 0));
      setOrderDeliveryFee(Number(data.deliveryFee || 0));
      setNoDeliveryNeeded(Boolean(data.noDeliveryNeeded));
      setDeliveryConvId(data.deliveryConversationId || null);
      if (data.distanceKm) setDistanceKm(Number(data.distanceKm));
      if (data.digitalDownloads) setDigitalDownloads(data.digitalDownloads);
      if (data.deliveryFee) {
        setProposedDeliveryUsd(String(Math.max(1, Number((data.deliveryFee - 1.5).toFixed(2)))));
      }
      await refreshCart();
      setStep('payment');
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? 'Impossible de créer la commande.');
    } finally {
      setLoading(false);
    }
  }

  async function handleShareLocationQuick(useBrowserGps: boolean) {
    if (!deliveryConvId) return;
    setNegotiationBusy(true);
    setNegotiationStatusText(null);
    try {
      let coords: { lat: number; lng: number } | null = null;
      let label = 'Position Google Maps partagée';
      if (!useBrowserGps && mapsLinkInput.trim()) {
        coords = parseGoogleMapsCoords(mapsLinkInput.trim());
        label = 'Lien Google Maps vérifié';
      }
      if (!coords && useBrowserGps && navigator.geolocation) {
        coords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve({ lat: -4.325, lng: 15.322 }),
            { timeout: 4000 },
          );
        });
        label = 'Position GPS directe';
      }
      if (!coords) {
        const chosen = addresses.find((a) => a.id === addressId) || addresses[0];
        coords = { lat: chosen?.latitude || -4.325, lng: chosen?.longitude || 15.322 };
        label = chosen ? `${chosen.commune || 'Kinshasa'} · ${chosen.quartier}` : 'Kinshasa Centre';
      }
      const googleMapsUrl =
        mapsLinkInput.trim().startsWith('http')
          ? mapsLinkInput.trim()
          : `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
      const { data } = await api.post(`/chat/conversations/${deliveryConvId}/location`, {
        lat: coords.lat,
        lng: coords.lng,
        label,
        googleMapsUrl,
      });
      if (data.distanceKm) setDistanceKm(Number(data.distanceKm));
      setNegotiationStatusText(
        `Position Google Maps transmise au livreur (${data.distanceKm || distanceKm} km calculés).`,
      );
    } finally {
      setNegotiationBusy(false);
    }
  }

  async function handleProposeDeliveryFee(action: 'PROPOSE' | 'ACCEPT') {
    if (!deliveryConvId) return;
    const fee = Math.max(0, Number(proposedDeliveryUsd) || 0);
    setNegotiationBusy(true);
    setNegotiationStatusText(null);
    try {
      const { data } = await api.post(`/chat/conversations/${deliveryConvId}/delivery-offer`, {
        action,
        feeUsd: fee,
      });
      if (data.order) {
        setOrderDeliveryFee(Number(data.order.deliveryFee));
        setOrderTotal(Number(data.order.total));
      }
      setNegotiationStatusText(
        action === 'ACCEPT'
          ? `Tarif livraison fixé à $${fee.toFixed(2)} — Total mis à jour avant paiement !`
          : `Proposition de $${fee.toFixed(2)} envoyée au livreur. Vous pouvez aussi discuter dans le chat.`,
      );
    } finally {
      setNegotiationBusy(false);
    }
  }

  async function refreshOrderTotals() {
    if (!orderId) return;
    const { data } = await api.get<Order>(`/orders/${orderId}`);
    if (data) {
      setOrderTotal(Number(data.total));
      if (data.deliveryFee !== undefined) setOrderDeliveryFee(Number(data.deliveryFee));
    }
  }

  async function handlePay() {
    if (!orderId) return;
    if (method.startsWith('MOBILE_MONEY') && !phoneNumber) {
      setMessage('Le numéro de téléphone Mobile Money est requis pour MaishaPay.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.post('/payments/initiate', {
        orderId,
        methodCode: method,
        phoneNumber: phoneNumber || '+243820001122',
      });

      if (data.maishaPayRef) setMaishaPayRef(data.maishaPayRef);
      if (data.smsRecipient) setSmsRecipient(data.smsRecipient);
      if (data.digitalDownloads && data.digitalDownloads.length > 0) {
        setDigitalDownloads(data.digitalDownloads);
      }

      if (data.method === 'cash_on_delivery' || data.status === 'SUCCESS') {
        setStep('done');
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        setStep('done');
      }
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? 'Le paiement a été confirmé via MaishaPay.');
      setStep('done');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <div className="w-16 h-16 mx-auto bg-seve/10 text-seve rounded-card flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-nuit">
          {noDeliveryNeeded ? 'Paiement confirmé — Téléchargement prêt !' : 'Commande validée avec succès !'}
        </h1>
        <p className="mt-3 text-sm text-encre/70 max-w-md mx-auto">
          {noDeliveryNeeded
            ? 'Votre livre / document numérique est débloqué immédiatement sans aucun frais ni délai de livraison.'
            : 'Vos fonds sont sécurisés sous séquestre via l’agrégateur MaishaPay RDC. Le vendeur prépare votre commande.'}
        </p>

        {/* Instant Digital Book Downloads */}
        {digitalDownloads.length > 0 && (
          <div className="mt-6 p-5 rounded-card bg-safran/15 border border-safran/40 text-left max-w-md mx-auto space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-display font-bold text-nuit uppercase tracking-wider">
              <FileText className="w-4 h-4 text-seve" />
              <span>Vos livres & documents PDF à télécharger</span>
            </div>
            {digitalDownloads.map((dl) => (
              <div
                key={dl.productId}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-card bg-white border border-encre/10"
              >
                <div className="min-w-0">
                  <p className="font-bold text-xs text-nuit truncate">{dl.title}</p>
                  <p className="text-[10px] font-mono text-encre/55">{dl.fileName}</p>
                </div>
                <a
                  href={dl.downloadUrl}
                  download={dl.fileName}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card bg-seve hover:bg-seve/90 text-brume text-xs font-display font-bold transition shadow-xs shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger le livre</span>
                </a>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 rounded-card bg-white text-xs text-left max-w-md mx-auto border border-encre/10 space-y-1.5 shadow-xs">
          {orderNumber && (
            <p>
              <strong className="text-nuit font-semibold">Commande :</strong>{' '}
              <span className="font-mono">{orderNumber}</span>
            </p>
          )}
          <p>
            <strong className="text-nuit font-semibold">Agrégateur de paiement :</strong>{' '}
            {maishaPayRef ? `MaishaPay RDC (${maishaPayRef})` : 'Paiement à la livraison'}
          </p>
          <p>
            <strong className="text-nuit font-semibold">Notification SMS (Africa’s Talking) :</strong>{' '}
            <span className="text-seve font-medium">
              SMS envoyé au {smsRecipient || phoneNumber} ✓
            </span>
          </p>
          <p>
            <strong className="text-nuit font-semibold">Logistique :</strong>{' '}
            {noDeliveryNeeded
              ? 'Aucune livraison nécessaire (produit digital)'
              : `${selectedDelivery?.name || 'Transporteur'} · ${orderDeliveryFee > 0 ? `$${orderDeliveryFee.toFixed(2)}` : 'Gratuit'}`}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {orderId && !noDeliveryNeeded && (
            <button
              onClick={() => navigate(`/orders/${orderId}/tracking`)}
              className="rounded-full bg-seve text-brume font-medium px-6 py-3 text-sm hover:bg-seve/90 transition-colors shadow-xs"
            >
              Carte & Suivi GPS en direct
            </button>
          )}
          <button
            onClick={() => navigate('/orders')}
            className="rounded-full bg-nuit text-brume font-medium px-6 py-3 text-sm hover:bg-nuit/90 transition-colors shadow-xs"
          >
            Mes commandes & factures
          </button>
          <button
            onClick={() => navigate('/products')}
            className="text-sm text-encre/70 hover:underline px-3"
          >
            Continuer mes achats
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <div className="border-b border-encre/10 pb-4">
        <p className="text-xs font-semibold tracking-wider uppercase text-seve">
          Agrégateur MaishaPay & SMS Africa’s Talking
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-nuit">Finaliser votre commande</h1>
      </div>

      {step === 'address' && (
        <div className="mt-8 space-y-8">
          {onlyDigitalInCart ? (
            <div className="p-5 rounded-card bg-seve/10 border border-seve/30 space-y-2">
              <div className="flex items-center gap-2 font-display font-bold text-nuit text-sm">
                <FileText className="w-5 h-5 text-seve" />
                <span>Livraison Numérique Immédiate (Aucune livraison requise)</span>
              </div>
              <p className="text-xs text-encre/75 leading-relaxed">
                Votre panier contient uniquement des livres / documents numériques PDF. Vous n’avez pas besoin de sélectionner un livreur ni de payer des frais de livraison ($0.00). Juste après votre paiement via MaishaPay, votre lien de téléchargement direct sera affiché et envoyé par SMS.
              </p>
            </div>
          ) : (
            <>
              {/* Section 1: Delivery Address */}
              <div>
                <h2 className="text-sm font-display font-semibold uppercase tracking-wider text-encre/80 mb-3">
                  1. Adresse de livraison en République Démocratique du Congo
                </h2>
                {addresses.length > 0 && !showNewAddress && (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-3 rounded-card border p-4 cursor-pointer transition-all ${
                          addressId === addr.id ? 'border-seve bg-seve/5 shadow-xs' : 'border-encre/15 bg-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="address"
                          checked={addressId === addr.id}
                          onChange={() => setAddressId(addr.id)}
                          className="mt-1 accent-seve"
                        />
                        <div className="text-sm">
                          <p className="font-display font-medium text-nuit">
                            {addr.commune && <span>{addr.commune}, </span>}
                            {addr.quartier}
                          </p>
                          {addr.referencePoint && (
                            <p className="text-xs text-encre/60 mt-0.5">{addr.referencePoint}</p>
                          )}
                        </div>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => setShowNewAddress(true)}
                      className="text-xs font-semibold text-seve hover:underline"
                    >
                      + Ajouter une nouvelle adresse
                    </button>
                  </div>
                )}

                {showNewAddress && (
                  <NewAddressForm
                    onCreated={(addr) => {
                      setAddresses((prev) => [addr, ...prev]);
                      setAddressId(addr.id);
                      setShowNewAddress(false);
                    }}
                    onCancel={() => setShowNewAddress(false)}
                    canCancel={addresses.length > 0}
                  />
                )}
              </div>

              {/* Section 2: Choose Delivery Provider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-display font-semibold uppercase tracking-wider text-encre/80">
                    2. Choisissez votre mode de transport
                  </h2>
                  <span className="text-xs text-seve font-semibold">Tarif négociable à l’étape suivante</span>
                </div>

                <div className="space-y-3">
                  {deliveryOptions.map((del) => (
                    <label
                      key={del.id}
                      className={`flex items-start gap-3 rounded-card border p-4 cursor-pointer transition-all ${
                        selectedDeliveryId === del.id ? 'border-seve bg-seve/5 shadow-xs' : 'border-encre/15 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        checked={selectedDeliveryId === del.id}
                        onChange={() => setSelectedDeliveryId(del.id)}
                        className="mt-1 accent-seve"
                      />
                      <div className="flex-1 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="font-display font-semibold text-nuit">{del.name}</p>
                          <p className="font-display font-bold text-nuit tabular-nums">
                            {del.feeUsd === 0
                              ? 'Gratuit'
                              : currency === 'CDF'
                              ? `${del.feeCdf.toLocaleString('fr-FR')} CDF`
                              : `${del.feeUsd.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} $`}
                          </p>
                        </div>
                        <p className="text-xs text-seve mt-1 font-medium inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{del.estimatedTime}</span>
                        </p>
                        <p className="text-xs text-encre/70 mt-1 leading-snug">{del.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Section 3: Currency & Summary */}
          <div className="p-4 rounded-card bg-white border border-encre/10 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-encre/70">Devise de facturation</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="rounded-card border border-encre/20 bg-brume/50 px-3 py-1.5 text-xs font-semibold outline-none text-encre"
              >
                <option value="USD">Dollar américain (USD $)</option>
                <option value="CDF">Franc congolais (CDF)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-encre/10 flex items-center justify-between text-xs text-encre/60">
              <span>Frais de livraison :</span>
              <span className="font-display font-semibold text-nuit tabular-nums">
                {initialDeliveryFee === 0 ? 'Gratuit ($0)' : `${initialDeliveryFee} ${currency}`}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-seve font-medium bg-seve/10 p-2.5 rounded-card border border-seve/25">
              <ShieldCheck className="w-4 h-4 text-seve shrink-0" />
              <span>
                Protection MaishaPay & Séquestre ZandoGo · Notifications SMS Africa’s Talking incluses.
              </span>
            </div>
          </div>

          {message && <p className="text-xs text-wax font-medium">{message}</p>}

          <button
            onClick={handleConfirmAddress}
            disabled={loading || (!onlyDigitalInCart && (addressesLoading || !addressId))}
            className="w-full rounded-card bg-seve text-brume font-display font-bold py-3.5 text-sm hover:bg-seve/90 transition-colors disabled:opacity-60 shadow-xs"
          >
            {loading
              ? 'Préparation de la commande…'
              : onlyDigitalInCart
              ? 'Valider et payer via MaishaPay →'
              : 'Continuer (Négocier livraison & Payer) →'}
          </button>
        </div>
      )}

      {step === 'payment' && (
        <div className="mt-8 space-y-6">
          {/* Order Summary Card */}
          <div className="p-4 rounded-card bg-white border border-encre/10 flex items-center justify-between text-sm shadow-xs">
            <div>
              <p className="font-display font-semibold text-nuit">
                {noDeliveryNeeded ? 'Livraison Numérique Immédiate' : selectedDelivery?.name || 'Coursier ZandoGo'}
              </p>
              <p className="text-xs text-encre/60">
                Commande {orderNumber || ''} ·{' '}
                {noDeliveryNeeded ? 'Téléchargement instantané ($0 frais)' : `Frais course : $${orderDeliveryFee.toFixed(2)} (${distanceKm} km)`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-encre/50 block">Total à payer</span>
              <p className="font-display text-lg font-extrabold text-nuit tabular-nums">
                {formatPrimaryPrice(orderTotal)}
              </p>
            </div>
          </div>

          {/* Pre-payment Driver Negotiation + Google Maps Location Sharing */}
          {!noDeliveryNeeded && deliveryConvId && (
            <div className="p-5 rounded-card bg-nuit text-brume border border-white/10 space-y-4 shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-safran font-bold">
                    <Handshake className="w-3.5 h-3.5" />
                    <span>Optionnel — Avant paiement</span>
                  </span>
                  <h3 className="font-display font-bold text-sm text-brume mt-0.5">
                    Discuter le prix de livraison & envoyer votre Google Maps au livreur
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={refreshOrderTotals}
                  className="text-[10px] font-mono text-safran hover:underline shrink-0"
                >
                  Actualiser total
                </button>
              </div>

              {/* Share Google Maps Position */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2.5 text-xs">
                <p className="font-semibold text-brume flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-seve" />
                  <span>1. Envoyer votre localisation Google Maps ({distanceKm} km estimés)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={mapsLinkInput}
                    onChange={(e) => setMapsLinkInput(e.target.value)}
                    placeholder="Collez un lien Google Maps ou laissez vide pour GPS…"
                    className="flex-1 min-w-[200px] rounded-lg bg-white/10 border border-white/15 px-3 py-1.5 text-xs text-brume placeholder-brume/45 outline-none focus:border-safran"
                  />
                  <button
                    type="button"
                    disabled={negotiationBusy}
                    onClick={() => handleShareLocationQuick(!mapsLinkInput.trim())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{mapsLinkInput.trim() ? 'Envoyer ce lien Maps' : 'Envoyer mon GPS'}</span>
                  </button>
                </div>
              </div>

              {/* Propose or Agree Delivery Fee */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2.5 text-xs">
                <p className="font-semibold text-brume flex items-center gap-1.5">
                  <Handshake className="w-3.5 h-3.5 text-safran" />
                  <span>2. Proposer un tarif de livraison abordable ($ USD)</span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1.5 font-mono text-safran font-bold">$</span>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={proposedDeliveryUsd}
                      onChange={(e) => setProposedDeliveryUsd(e.target.value)}
                      className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs font-display font-bold text-brume outline-none focus:border-safran"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={negotiationBusy}
                    onClick={() => handleProposeDeliveryFee('PROPOSE')}
                    className="px-3 py-1.5 rounded-lg bg-safran text-nuit font-display font-bold text-xs hover:bg-safran/90 transition"
                  >
                    Proposer au livreur
                  </button>
                  <button
                    type="button"
                    disabled={negotiationBusy}
                    onClick={() => handleProposeDeliveryFee('ACCEPT')}
                    className="px-3 py-1.5 rounded-lg bg-white/15 text-brume font-semibold text-xs hover:bg-white/25 transition"
                  >
                    Valider ce tarif
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/chat', { state: { conversationId: deliveryConvId } })}
                    className="inline-flex items-center gap-1 text-safran hover:underline text-xs font-semibold ml-auto"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ouvrir le chat</span>
                  </button>
                </div>
              </div>

              {negotiationStatusText && (
                <p className="text-[11px] text-safran font-medium bg-safran/15 border border-safran/30 px-3 py-2 rounded-lg">
                  {negotiationStatusText}
                </p>
              )}
            </div>
          )}

          {/* MaishaPay Payment Gateway Methods */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-semibold uppercase tracking-wider text-encre/80">
                Règlement via Agrégateur MaishaPay RDC
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-seve/10 text-seve border border-seve/25">
                MAISHAPAY SECURE
              </span>
            </div>

            {(
              [
                ['MOBILE_MONEY_MPESA', 'M-Pesa Vodacom RDC (via MaishaPay)'],
                ['MOBILE_MONEY_AIRTEL', 'Airtel Money RDC (via MaishaPay)'],
                ['MOBILE_MONEY_ORANGE', 'Orange Money RDC (via MaishaPay)'],
                ['CARD_STRIPE', 'Carte bancaire Visa / Mastercard (via MaishaPay)'],
                ...(noDeliveryNeeded
                  ? []
                  : ([['CASH_ON_DELIVERY', 'Espèces à la livraison (Cash on Delivery)']] as [PaymentMethod, string][])),
              ] as [PaymentMethod, string][]
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex items-center gap-3 rounded-card border p-4 cursor-pointer transition-all ${
                  method === value ? 'border-seve bg-seve/5 shadow-xs' : 'border-encre/15 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="method"
                  checked={method === value}
                  disabled={clientSecret !== null}
                  onChange={() => setMethod(value)}
                  className="accent-seve"
                />
                {value === 'CARD_STRIPE' ? (
                  <CreditCard className="w-4 h-4 text-seve shrink-0" />
                ) : (
                  <Smartphone className="w-4 h-4 text-seve shrink-0" />
                )}
                <span className="text-sm font-medium text-nuit">{label}</span>
              </label>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
              Numéro Mobile RDC (+243) pour paiement MaishaPay & SMS Africa’s Talking
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+243 820 001 122"
              className="w-full rounded-card border border-encre/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-seve font-mono text-encre"
            />
          </div>

          {message && <p className="text-xs text-wax font-medium">{message}</p>}

          {clientSecret ? (
            <CardPaymentForm
              clientSecret={clientSecret}
              returnUrl={`${window.location.origin}/orders`}
              onError={setMessage}
            />
          ) : (
            <button
              onClick={handlePay}
              disabled={loading}
              className="w-full rounded-card bg-seve text-brume font-display font-bold py-3.5 text-sm hover:bg-seve/90 transition-colors disabled:opacity-60 shadow-xs"
            >
              {loading
                ? 'Traitement MaishaPay & envoi SMS Africa’s Talking…'
                : `Payer ${formatPrimaryPrice(orderTotal)} via MaishaPay`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NewAddressForm({
  onCreated,
  onCancel,
  canCancel,
}: {
  onCreated: (addr: Address) => void;
  onCancel: () => void;
  canCancel: boolean;
}) {
  const [commune, setCommune] = useState('');
  const [quartier, setQuartier] = useState('');
  const [referencePoint, setReferencePoint] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function useCurrentPosition() {
    setLocating(true);
    setError(null);
    if (!navigator.geolocation) {
      setCoords({ lat: -4.325, lng: 15.322 });
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setCoords({ lat: -4.325, lng: 15.322 });
        setLocating(false);
      },
      { timeout: 6000 },
    );
  }

  async function handleSave() {
    if (!commune.trim() || !quartier.trim()) {
      setError('Indiquez au moins la commune et le quartier.');
      return;
    }
    const targetCoords = coords || { lat: -4.325, lng: 15.322 };
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post<Address>('/users/me/addresses', {
        commune: commune.trim(),
        quartier: quartier.trim(),
        referencePoint: referencePoint.trim(),
        latitude: targetCoords.lat,
        longitude: targetCoords.lng,
        isDefault: true,
      });
      onCreated(data);
    } catch {
      setError("Impossible d'enregistrer l'adresse.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-encre/15 p-4 space-y-3">
      <input
        value={commune}
        onChange={(e) => setCommune(e.target.value)}
        placeholder="Commune"
        className="w-full rounded-lg border border-encre/20 px-4 py-2"
      />
      <input
        value={quartier}
        onChange={(e) => setQuartier(e.target.value)}
        placeholder="Quartier"
        className="w-full rounded-lg border border-encre/20 px-4 py-2"
      />
      <input
        value={referencePoint}
        onChange={(e) => setReferencePoint(e.target.value)}
        placeholder="Repère (ex: après le rond-point X, 2ème rue à droite)"
        className="w-full rounded-lg border border-encre/20 px-4 py-2"
      />

      <button type="button" onClick={useCurrentPosition} className="text-sm text-seve hover:underline">
        {locating ? 'Localisation…' : coords ? 'Position enregistrée ✓' : 'Utiliser ma position actuelle'}
      </button>

      {error && <p className="text-sm text-wax">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-nuit text-brume text-sm font-medium px-5 py-2 hover:bg-nuit/90 transition-colors disabled:opacity-60"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer cette adresse'}
        </button>
        {canCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-encre/50 hover:underline">
            Annuler
          </button>
        )}
      </div>
    </div>
  );
}
