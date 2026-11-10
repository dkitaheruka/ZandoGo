import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const isEmail = identifier.includes('@');
      await login(isEmail ? { email: identifier } : { phone: identifier }, password);
      const returnTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(returnTo ?? '/', { replace: true });
    } catch (err: any) {
      // 429 = trop de tentatives (limitation de débit) : à distinguer d'un mauvais mot de passe,
      // sinon l'utilisateur réessaie et prolonge son propre blocage.
      setError(
        err?.response?.status === 429
          ? 'Trop de tentatives. Patientez une minute avant de réessayer.'
          : 'Identifiants invalides. Vérifiez votre email/téléphone et votre mot de passe.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-3xl font-semibold">Se connecter</h1>
      <p className="mt-2 text-encre/60">Retrouvez vos commandes et votre suivi de livraison.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="identifier">
            Email ou téléphone
          </label>
          <input
            id="identifier"
            type="text"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full rounded-lg border border-encre/20 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none"
            placeholder="vous@exemple.com ou +243..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-encre/20 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none"
          />
        </div>

        {error && <p className="text-sm text-wax">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-nuit text-brume font-medium py-3 hover:bg-nuit/90 transition-colors disabled:opacity-60"
        >
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="mt-6 text-sm text-encre/60">
        Pas encore de compte ?{' '}
        <Link to="/register" className="text-seve hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
