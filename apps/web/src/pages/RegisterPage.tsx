import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
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
      navigate('/');
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
      <h1 className="font-display text-3xl font-semibold">Créer un compte</h1>
      <p className="mt-2 text-encre/60">Rejoignez la place de marché et suivez vos commandes.</p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field label="Nom complet" value={fullName} onChange={setFullName} required autoComplete="name" />
        <Field label="Adresse email (facultatif si téléphone renseigné)" value={email} onChange={setEmail} type="email" autoComplete="email" />
        <Field label="Téléphone (facultatif si email renseigné)" value={phone} onChange={setPhone} type="tel" autoComplete="tel" />
        <div>
          <label htmlFor="register-password" className="mb-1.5 block text-sm font-medium">Mot de passe (10 caractères minimum)</label>
          <input
            id="register-password"
            type="password"
            required
            minLength={10}
            maxLength={64}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-encre/20 px-4 py-2.5"
          />
        </div>
        <div>
          <label htmlFor="register-currency" className="mb-1.5 block text-sm font-medium">Devise préférée</label>
          <select id="register-currency" value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)} className="w-full rounded-lg border border-encre/20 px-4 py-2.5">
            <option value="USD">Dollar américain (USD)</option>
            <option value="CDF">Franc congolais (CDF)</option>
          </select>
        </div>
        {error && <p className="text-sm text-wax" role="alert">{error}</p>}
        <button type="submit" disabled={loading || (!email.trim() && !phone.trim())} className="w-full rounded-full bg-nuit py-3 font-medium text-brume transition-colors hover:bg-nuit/90 disabled:opacity-60">
          {loading ? 'Création du compte…' : 'Créer mon compte'}
        </button>
      </form>
      <p className="mt-6 text-sm text-encre/60">
        Déjà inscrit ? <Link to="/login" className="text-seve hover:underline">Se connecter</Link>
      </p>
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
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-encre/20 px-4 py-2.5"
      />
    </div>
  );
}
