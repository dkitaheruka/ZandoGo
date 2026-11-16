import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'CDF'>('USD');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        password,
        preferredCurrency: currency,
      });
      navigate(redirectTarget, { replace: true });
    } catch (reason) {
      const message = (reason as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(' ')
          : (message ?? 'Impossible de créer votre compte. Vérifiez vos informations et réessayez.'),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <div className="rounded-card bg-white border border-encre/10 p-8 shadow-xs">
        <h1 className="font-display text-3xl font-bold text-nuit">Créer un compte</h1>
        <p className="mt-2 text-xs text-encre/60">Rejoignez la place de marché ZandoGo et commandez en toute sécurité.</p>

        <form onSubmit={submit} className="mt-6 space-y-4 text-xs">
          <Field label="Nom complet" value={fullName} onChange={setFullName} required autoComplete="name" />
          <Field label="Adresse e-mail (requise pour acheter & retrouver vos adresses)" value={email} onChange={setEmail} type="email" required autoComplete="email" />
          <Field label="Téléphone (+243 / SMS Africa's Talking)" value={phone} onChange={setPhone} type="tel" autoComplete="tel" />

          <div>
            <label htmlFor="register-password" className="mb-1.5 block font-semibold text-encre/80">Mot de passe (10 caractères minimum)</label>
            <input
              id="register-password"
              type="password"
              required
              minLength={10}
              maxLength={64}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs text-encre outline-none focus:border-seve focus:ring-1 focus:ring-seve"
            />
          </div>

          <div>
            <label htmlFor="register-currency" className="mb-1.5 block font-semibold text-encre/80">Devise préférée</label>
            <select
              id="register-currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as typeof currency)}
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs text-encre outline-none focus:border-seve"
            >
              <option value="USD">Dollar américain (USD $)</option>
              <option value="CDF">Franc congolais (CDF)</option>
            </select>
          </div>

          {error && <p className="text-xs text-wax font-medium" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={loading || (!email.trim() && !phone.trim())}
            className="w-full rounded-card bg-seve py-3.5 font-display font-bold text-xs text-brume transition shadow-xs hover:bg-seve/90 disabled:opacity-60 mt-2"
          >
            {loading ? 'Création du compte…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-6 text-xs text-encre/60 text-center">
          Déjà inscrit ?{' '}
          <Link
            to={searchParams.get('redirect') ? `/login?redirect=${encodeURIComponent(redirectTarget)}` : '/login'}
            className="text-seve font-semibold hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block font-semibold text-encre/80">{label}</label>
      <input
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs text-encre outline-none focus:border-seve focus:ring-1 focus:ring-seve"
      />
    </div>
  );
}
