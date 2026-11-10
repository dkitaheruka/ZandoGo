import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
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
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>('');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [currency, setCurrency] = useState<Currency>('USD');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('CASH_ON_DELIVERY');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [step, setStep] = useState<'address' | 'payment' | 'done'>('address');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addressesLoading, setAddressesLoading] = useState(true);

  useEffect(() => {
    api.get<Address[]>('/users/me/addresses')
      .then(({ data }) => {
        setAddresses(data);
        if (data.length > 0) setAddressId(data[0].id);
        else setShowNewAddress(true);
      })
      .catch(() => setMessage("Impossible de charger vos adresses. Réessayez ou contactez le support."))
      .finally(() => setAddressesLoading(false));
  }, []);

  async function handleConfirmAddress() {
    if (!addressId) {
      setMessage('Sélectionnez ou créez une adresse de livraison.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.post('/orders/checkout', { deliveryAddressId: addressId, currency });
      setOrderId(data.id);
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

      if (data.method === 'cash_on_delivery') {
        setStep('done');
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl; // redirection vers le checkout CinetPay
      } else if (data.clientSecret) {
        setClientSecret(data.clientSecret); // déclenche l'affichage du formulaire Stripe
      }
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? 'Le paiement a échoué.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold">Commande confirmée</h1>
        <p className="mt-3 text-encre/60">
          Votre commande est en préparation. Vous paierez en espèces à la livraison.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('/orders')}
            className="rounded-full bg-nuit text-brume font-medium px-8 py-3 hover:bg-nuit/90 transition-colors"
          >
            Voir ma commande
          </button>
          <button
            onClick={() => navigate('/products')}
            className="text-sm text-encre/60 hover:underline"
          >
            Continuer mes achats
          </button>
        </div>
        <p className="mt-4">
          <Link to="/orders" className="text-seve hover:underline text-sm">
            Voir mes commandes
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Finaliser la commande</h1>

      {step === 'address' && (
        <div className="mt-8 space-y-6">
          {addresses.length > 0 && !showNewAddress && (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <label
                  key={addr.id}
                  className="flex items-start gap-3 rounded-lg border border-encre/15 p-4 cursor-pointer has-[:checked]:border-seve"
                >
                  <input
                    type="radio"
                    name="address"
                    checked={addressId === addr.id}
                    onChange={() => setAddressId(addr.id)}
                    className="mt-1"
                  />
                  <span>
                    {addr.commune && <span className="font-medium">{addr.commune}, </span>}
                    {addr.quartier}
                    {addr.referencePoint && (
                      <span className="block text-sm text-encre/50">{addr.referencePoint}</span>
                    )}
                  </span>
                </label>
              ))}
              <button onClick={() => setShowNewAddress(true)} className="text-sm text-seve hover:underline">
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

          <div>
            <label className="block text-sm font-medium mb-2">Devise</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="rounded-lg border border-encre/20 px-4 py-2.5"
            >
              <option value="USD">Dollar américain (USD)</option>
              <option value="CDF">Franc congolais (CDF)</option>
            </select>
          </div>

          {message && <p className="text-sm text-wax">{message}</p>}

          <button
            onClick={handleConfirmAddress}
            disabled={loading || addressesLoading || !addressId}
            className="w-full rounded-full bg-nuit text-brume font-medium py-3 hover:bg-nuit/90 transition-colors disabled:opacity-60"
          >
            {addressesLoading ? 'Chargement des adresses…' : loading ? 'Création de la commande…' : 'Continuer vers le paiement'}
          </button>
        </div>
      )}

      {step === 'payment' && (
        <div className="mt-8 space-y-6">
          <div className="space-y-3">
            {(
              [
                ['MOBILE_MONEY_ORANGE', 'Orange Money'],
                ['MOBILE_MONEY_AIRTEL', 'Airtel Money'],
                ['MOBILE_MONEY_MPESA', 'M-Pesa'],
                ['CARD_STRIPE', 'Carte bancaire'],
                ['CASH_ON_DELIVERY', 'Cash à la livraison'],
              ] as [PaymentMethod, string][]
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex items-center gap-3 rounded-lg border border-encre/15 p-4 cursor-pointer has-[:checked]:border-seve"
              >
                <input
                  type="radio"
                  name="method"
                  checked={method === value}
                  disabled={clientSecret !== null}
                  onChange={() => setMethod(value)}
                />
                {label}
              </label>
            ))}
          </div>

          {method.startsWith('MOBILE_MONEY') && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Numéro de téléphone</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+243 8xx xxx xxx"
                className="w-full rounded-lg border border-encre/20 px-4 py-2.5"
              />
            </div>
          )}

          {message && <p className="text-sm text-wax">{message}</p>}

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
              className="w-full rounded-full bg-seve text-white font-medium py-3 hover:bg-seve/90 transition-colors disabled:opacity-60"
            >
              {loading ? 'Traitement…' : 'Confirmer le paiement'}
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Impossible d'obtenir votre position. Vérifiez les autorisations du navigateur.");
        setLocating(false);
      },
    );
  }

  async function handleSave() {
    if (!coords) {
      setError('Indiquez votre position (bouton ci-dessous) — indispensable pour le livreur.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post<Address>('/users/me/addresses', {
        commune,
        quartier,
        referencePoint,
        latitude: coords.lat,
        longitude: coords.lng,
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
