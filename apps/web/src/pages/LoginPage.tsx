import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTarget =
    searchParams.get('redirect') ||
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ||
    '/';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const isEmail = identifier.includes('@');
      await login(isEmail ? { email: identifier } : { phone: identifier }, password);
      navigate(redirectTarget, { replace: true });
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
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-card bg-white border border-encre/10 p-8 shadow-xs">
        <h1 className="font-display text-3xl font-bold text-nuit">Se connecter</h1>
        <p className="mt-2 text-xs text-encre/60">
          Connectez-vous avec votre e-mail ou téléphone pour commander, payer et récupérer vos adresses de livraison.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-encre/80 mb-1.5" htmlFor="identifier">
              Email ou téléphone (+243)
            </label>
            <input
              id="identifier"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none text-encre"
              placeholder="vous@exemple.com ou +243..."
            />
          </div>

          <div>
            <label className="block font-semibold text-encre/80 mb-1.5" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none text-encre"
            />
          </div>

          {error && <p className="text-xs text-wax font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-card bg-seve text-brume font-display font-bold py-3.5 hover:bg-seve/90 transition shadow-xs disabled:opacity-60 text-xs mt-2"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-6 text-xs text-encre/60 text-center">
          Pas encore de compte ?{' '}
          <Link
            to={searchParams.get('redirect') ? `/register?redirect=${encodeURIComponent(redirectTarget)}` : '/register'}
            className="text-seve font-semibold hover:underline"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
