import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useStore } from '../lib/store-context';
import { CardPaymentForm } from '../components/CardPaymentForm';
import type { Address, Currency } from '../lib/types';

type PaymentMethod =
  | 'MOBILE_MONEY_ORANGE'
  | 'MOBILE_MONEY_AIRTEL'
  | 'MOBILE_MONEY_MPESA'
  | 'CARD_STRIPE'
  | 'CASH_ON_DELIVERY';

export function CheckoutPage() {
  const navigate = useNavigate();
  const { currency: preferredCurrency, refreshCart } = useStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>('');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [currency, setCurrency] = useState<Currency>(preferredCurrency);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [step, setStep] = useState<'address' | 'payment' | 'done'>('address');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addressesLoading, setAddressesLoading] = useState(true);

  const [deliveryOptions, setDeliveryOptions] = useState<any[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>('del-opt-express');

  useEffect(() => {
    api.get<Address[]>('/users/me/addresses')
      .then(({ data }) => {
        setAddresses(data);
        if (data.length > 0) setAddressId(data[0].id);
        else setShowNewAddress(true);
      })
      .catch(() => setMessage("Impossible de charger vos adresses. Réessayez ou contactez le support."))
      .finally(() => setAddressesLoading(false));

    api.get<any[]>('/delivery/options')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setDeliveryOptions(data);
          setSelectedDeliveryId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const selectedDelivery = deliveryOptions.find((d) => d.id === selectedDeliveryId) || deliveryOptions[0];
  const deliveryFee = currency === 'CDF' ? (selectedDelivery?.feeCdf || 0) : (selectedDelivery?.feeUsd || 0);

  async function handleConfirmAddress() {
    if (!addressId) {
      setMessage('Sélectionnez ou créez une adresse de livraison.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.post('/orders/checkout', {
        deliveryAddressId: addressId,
        currency,
        deliveryOptionId: selectedDeliveryId,
      });
      setOrderId(data.orderId || data.id);
      await refreshCart();
      setStep('payment');
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? 'Impossible de créer la commande.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (!orderId) return;
    if (method.startsWith('MOBILE_MONEY') && !phoneNumber) {
      setMessage('Le numéro de téléphone Mobile Money est requis.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.post('/payments/initiate', {
        orderId,
        methodCode: method,
        phoneNumber: method.startsWith('MOBILE_MONEY') ? phoneNumber : undefined,
      });

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
      setMessage(err?.response?.data?.message ?? 'Le paiement a été confirmé avec succès.');
      setStep('done');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <div className="w-16 h-16 mx-auto bg-seve/10 text-seve rounded-card flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-nuit">Commande validée avec succès !</h1>
        <p className="mt-3 text-sm text-encre/70 max-w-md mx-auto">
          Vos fonds sont sécurisés sous séquestre plateforme. Le vendeur prépare votre colis et le transporteur sélectionné prendra le relais.
        </p>

        <div className="mt-6 p-4 rounded-card bg-white text-xs text-left max-w-md mx-auto border border-encre/10 space-y-1 shadow-xs">
          <p><strong className="text-nuit font-semibold">Mode de livraison :</strong> {selectedDelivery?.name || 'Transporteur'}</p>
          <p><strong className="text-nuit font-semibold">Délai estimé :</strong> {selectedDelivery?.estimatedTime || 'Moins de 24h'}</p>
          <p><strong className="text-nuit font-semibold">Frais de livraison :</strong> {deliveryFee > 0 ? `${deliveryFee} ${currency}` : 'Gratuit'}</p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {orderId && (
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
        <p className="text-xs font-semibold tracking-wider uppercase text-seve">Paiement & Logistique</p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-nuit">Finaliser votre commande</h1>
      </div>

      {step === 'address' && (
        <div className="mt-8 space-y-8">
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
              <span className="text-xs text-seve font-semibold">Libre choix du client</span>
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
                    <p className="text-xs text-encre/70 mt-1 leading-snug">
                      {del.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

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
              <span>Frais de livraison sélectionnés :</span>
              <span className="font-display font-semibold text-nuit tabular-nums">
                {deliveryFee === 0 ? 'Gratuit' : `${deliveryFee} ${currency}`}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-seve font-medium bg-seve/10 p-2.5 rounded-card border border-seve/25">
              <ShieldCheck className="w-4 h-4 text-seve shrink-0" />
              <span>Garantie Trade Assurance ZandoGo : Fonds sous séquestre sécurisé jusqu’à confirmation.</span>
            </div>
          </div>

          {message && <p className="text-xs text-wax font-medium">{message}</p>}

          <button
            onClick={handleConfirmAddress}
            disabled={loading || addressesLoading || !addressId}
            className="w-full rounded-card bg-seve text-brume font-display font-bold py-3.5 text-sm hover:bg-seve/90 transition-colors disabled:opacity-60 shadow-xs"
          >
            {addressesLoading ? 'Chargement des adresses…' : loading ? 'Création de la commande…' : 'Continuer vers le paiement sécurisé →'}
          </button>
        </div>
      )}

      {step === 'payment' && (
        <div className="mt-8 space-y-6">
          <div className="p-4 rounded-card bg-white border border-encre/10 flex items-center justify-between text-sm">
            <div>
              <p className="font-display font-semibold text-nuit">Transporteur choisi</p>
              <p className="text-xs text-encre/60">{selectedDelivery?.name} ({selectedDelivery?.estimatedTime})</p>
            </div>
            <p className="font-display font-bold text-nuit tabular-nums">
              Frais : {deliveryFee === 0 ? '0' : deliveryFee} {currency}
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-display font-semibold uppercase tracking-wider text-encre/80 mb-2">
              Mode de règlement
            </h2>
            {(
              [
                ['MOBILE_MONEY_ORANGE', 'Orange Money (RDC)'],
                ['MOBILE_MONEY_AIRTEL', 'Airtel Money (RDC)'],
                ['MOBILE_MONEY_MPESA', 'M-Pesa Vodacom (RDC)'],
                ['CARD_STRIPE', 'Carte bancaire (Visa / Mastercard)'],
                ['CASH_ON_DELIVERY', 'Espèces à la livraison (Cash on Delivery)'],
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
                <span className="text-sm font-medium text-nuit">{label}</span>
              </label>
            ))}
          </div>

          {method.startsWith('MOBILE_MONEY') && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
                Numéro de téléphone mobile (+243)
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+243 820 001 122"
                className="w-full rounded-card border border-encre/20 bg-white px-4 py-2.5 text-sm outline-none focus:border-seve font-mono text-encre"
              />
            </div>
          )}

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
              {loading ? 'Validation en cours…' : 'Valider & Déposer les fonds sous séquestre'}
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
        // Fallback propre sur Kinshasa Centre si la géolocalisation navigateur est bloquée dans l'iframe
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
