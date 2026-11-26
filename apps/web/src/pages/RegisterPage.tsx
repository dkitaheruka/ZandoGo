import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export function RegisterPage() {
  const { register, refreshUser } = useAuth();
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

  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await register({
        fullName: fullName.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        password,
        preferredCurrency: currency,
      });
      if (result?.verificationPending) {
        setDevOtpPreview(result.devOtpPreview || null);
        setOtpStep(true);
      } else {
        navigate(redirectTarget, { replace: true });
      }
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

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { code: otpCode.trim() });
      await refreshUser();
      navigate(redirectTarget, { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Code OTP invalide ou expiré.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError(null);
    setOtpNotice(null);
    try {
      const { data } = await api.post<{ message?: string; devOtpPreview?: string }>('/auth/resend-otp');
      if (data?.devOtpPreview) setDevOtpPreview(data.devOtpPreview);
      setOtpNotice(data?.message || 'Nouveau code OTP envoyé.');
    } catch {
      setError('Impossible de renvoyer un code pour le moment.');
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <div className="rounded-card bg-white border border-encre/10 p-8 shadow-xs">
        {!otpStep ? (
          <>
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
          </>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-seve">
              <ShieldCheck className="w-6 h-6" />
              <h1 className="font-display text-2xl font-bold text-nuit">Confirmez votre compte</h1>
            </div>
            <p className="text-encre/70 leading-relaxed">
              Votre compte est créé ! Saisissez le code OTP à 6 chiffres envoyé à votre numéro/e-mail pour activer le badge Compte Vérifié.
            </p>

            {devOtpPreview && (
              <div className="p-3 rounded-card bg-safran/20 border border-safran/50 flex items-center justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-nuit">Code OTP (Mode test local)</p>
                  <p className="font-mono font-bold text-sm text-nuit">{devOtpPreview}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOtpCode(devOtpPreview)}
                  className="px-3 py-1.5 rounded-card bg-nuit text-safran font-display font-bold text-[11px]"
                >
                  Pré-remplir
                </button>
              </div>
            )}

            {otpNotice && <p className="text-seve font-medium">{otpNotice}</p>}

            <div>
              <label className="mb-1.5 block font-semibold text-encre/80" htmlFor="register-otp">
                Code OTP à 6 chiffres
              </label>
              <input
                id="register-otp"
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 font-mono text-sm tracking-widest text-nuit outline-none focus:border-seve"
              />
            </div>

            {error && <p className="text-xs text-wax font-medium" role="alert">{error}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={loading || otpCode.trim().length < 4}
                className="flex-1 rounded-card bg-seve py-3 font-display font-bold text-brume hover:bg-seve/90 disabled:opacity-60"
              >
                {loading ? 'Validation…' : 'Activer mon compte'}
              </button>
              <button
                type="button"
                onClick={handleResendOtp}
                className="px-4 py-3 rounded-card border border-encre/15 font-semibold text-encre/80 hover:text-nuit"
              >
                Renvoyer
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate(redirectTarget, { replace: true })}
              className="w-full text-center text-[11px] text-encre/55 hover:text-nuit underline pt-1"
            >
              Vérifier plus tard depuis mon profil →
            </button>
          </form>
        )}
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
