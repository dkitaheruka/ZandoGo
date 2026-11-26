import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, CheckCircle2, ArrowLeft, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devOtpPreview, setDevOtpPreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRequestCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const isEmail = identifier.includes('@');
      const { data } = await api.post<{ message?: string; devOtpPreview?: string }>(
        '/auth/forgot-password',
        isEmail ? { email: identifier.trim() } : { phone: identifier.trim() },
      );
      setNotice(data?.message || 'Si ce compte existe, un code OTP à 6 chiffres a été envoyé.');
      setDevOtpPreview(data?.devOtpPreview || null);
      setStep('reset');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Impossible d’envoyer le code pour le moment.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      const isEmail = identifier.includes('@');
      await api.post('/auth/reset-password', {
        ...(isEmail ? { email: identifier.trim() } : { phone: identifier.trim() }),
        code: code.trim(),
        newPassword,
      });
      setStep('done');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Code invalide ou expiré.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-14">
      <div className="rounded-card bg-white border border-encre/10 p-8 shadow-xs space-y-5">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-encre/60 hover:text-seve">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour à la connexion</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-card bg-seve/10 border border-seve/25 flex items-center justify-center text-seve">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-nuit">Mot de passe oublié</h1>
            <p className="text-xs text-encre/60">Réinitialisation sécurisée par code OTP (SMS / e-mail).</p>
          </div>
        </div>

        {step === 'request' && (
          <form onSubmit={handleRequestCode} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-encre/80 mb-1.5" htmlFor="fp-identifier">
                Adresse e-mail ou numéro (+243)
              </label>
              <input
                id="fp-identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="vous@exemple.com ou +243..."
                className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none text-encre"
              />
            </div>

            {error && <p className="text-xs text-wax font-medium">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-card bg-seve text-brume font-display font-bold py-3 hover:bg-seve/90 transition shadow-xs disabled:opacity-60"
            >
              {busy ? 'Envoi du code…' : 'Envoyer le code de réinitialisation'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
            {notice && (
              <div className="p-3 rounded-card bg-seve/10 border border-seve/25 text-seve font-medium">
                {notice}
              </div>
            )}

            {devOtpPreview && (
              <div className="p-3 rounded-card bg-safran/20 border border-safran/50 flex items-center justify-between gap-2">
                <div>
                  <p className="font-display font-bold text-nuit">Mode test local — Code OTP</p>
                  <p className="font-mono font-bold text-sm text-nuit mt-0.5">{devOtpPreview}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCode(devOtpPreview)}
                  className="px-3 py-1.5 rounded-card bg-nuit text-safran font-display font-bold text-[11px]"
                >
                  Pré-remplir
                </button>
              </div>
            )}

            <div>
              <label className="block font-semibold text-encre/80 mb-1.5" htmlFor="fp-code">
                Code OTP à 6 chiffres
              </label>
              <input
                id="fp-code"
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 font-mono text-sm tracking-widest focus:border-seve outline-none text-nuit"
              />
            </div>

            <div>
              <label className="block font-semibold text-encre/80 mb-1.5" htmlFor="fp-new-pwd">
                Nouveau mot de passe (min. 10 caractères)
              </label>
              <input
                id="fp-new-pwd"
                type="password"
                required
                minLength={10}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 focus:border-seve outline-none text-nuit"
              />
            </div>

            <div>
              <label className="block font-semibold text-encre/80 mb-1.5" htmlFor="fp-confirm-pwd">
                Confirmer le nouveau mot de passe
              </label>
              <input
                id="fp-confirm-pwd"
                type="password"
                required
                minLength={10}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 focus:border-seve outline-none text-nuit"
              />
            </div>

            {error && <p className="text-xs text-wax font-medium">{error}</p>}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('request')}
                className="px-4 py-3 rounded-card border border-encre/15 text-encre/70 font-semibold hover:text-nuit"
              >
                Renvoyer
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-card bg-seve text-brume font-display font-bold py-3 hover:bg-seve/90 transition shadow-xs disabled:opacity-60"
              >
                {busy ? 'Mise à jour…' : 'Valider le mot de passe'}
              </button>
            </div>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-card bg-seve/10 border border-seve/30 text-seve flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-bold text-sm text-nuit">Mot de passe mis à jour</p>
                <p className="text-encre/70 mt-1">
                  Votre compte est prêt. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full rounded-card bg-nuit text-safran font-display font-bold py-3 hover:bg-nuit/90 transition inline-flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Aller à la connexion</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
