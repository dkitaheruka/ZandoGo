import { useState, type FormEvent } from 'react';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

export function CardPaymentForm({
  clientSecret,
  returnUrl,
  onError,
}: {
  clientSecret: string;
  returnUrl: string;
  onError: (message: string | null) => void;
}) {
  if (!stripePromise) {
    return <p className="text-sm text-wax" role="alert">Le paiement par carte n'est pas configuré. Contactez le support.</p>;
  }
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CardForm clientSecret={clientSecret} returnUrl={returnUrl} onError={onError} />
    </Elements>
  );
}

function CardForm({
  clientSecret,
  returnUrl,
  onError,
}: {
  clientSecret: string;
  returnUrl: string;
  onError: (message: string | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    onError(null);
    const card = elements.getElement(CardElement);
    if (!card) {
      onError('Le formulaire de carte est indisponible. Rechargez la page et réessayez.');
      setLoading(false);
      return;
    }
    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
        return_url: returnUrl,
      });
      if (error) onError(error.message ?? 'Le paiement par carte a échoué.');
      else if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        window.location.assign(returnUrl);
      } else {
        onError('Le paiement n’a pas été confirmé. Vérifiez le statut auprès de votre banque.');
      }
    } catch {
      onError('Le service de paiement est momentanément indisponible. Réessayez dans quelques instants.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg border border-encre/20 bg-white px-4 py-4">
        <CardElement options={{ hidePostalCode: true }} />
      </div>
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full rounded-full bg-seve py-3 font-medium text-white transition-colors hover:bg-seve/90 disabled:opacity-60"
      >
        {loading ? 'Confirmation du paiement…' : 'Payer par carte'}
      </button>
    </form>
  );
}
