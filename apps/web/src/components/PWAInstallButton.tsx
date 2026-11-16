import { useState } from 'react';
import { Download, Monitor, Smartphone, Share, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../lib/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'dark' | 'footer';
  compact?: boolean;
}

export function PWAInstallButton({ variant = 'header', compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) {
    return null;
  }

  async function handleClick() {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  }

  const buttonClasses =
    variant === 'dark'
      ? 'inline-flex items-center gap-1.5 rounded-card bg-safran/15 hover:bg-safran/25 border border-safran/35 px-3 py-1.5 text-xs font-display font-semibold text-safran transition'
      : variant === 'footer'
      ? 'inline-flex items-center gap-2 rounded-card bg-safran hover:bg-safran/90 px-4 py-2 text-xs font-display font-bold text-nuit shadow-xs transition'
      : 'inline-flex items-center gap-1.5 rounded-card bg-nuit hover:bg-nuit/90 border border-safran/40 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-display font-semibold text-safran shadow-xs transition';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={buttonClasses}
        title="Télécharger et installer l'application ZandoGo sur téléphone ou ordinateur"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={compact ? 'hidden md:inline' : ''}>
          {isInstallable ? 'Télécharger l’app' : 'Installer l’app'}
        </span>
      </button>

      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-nuit/75 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-lg rounded-card bg-white border border-encre/15 shadow-2xl overflow-hidden text-encre">
            <div className="bg-nuit px-6 py-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-card bg-safran text-nuit font-display font-extrabold text-sm flex items-center justify-center">
                  ZG
                </div>
                <div>
                  <h3 id="pwa-install-title" className="font-display font-bold text-base text-white">
                    Télécharger ZandoGo sur vos appareils
                  </h3>
                  <p className="text-[11px] text-brume/70">
                    Application directe pour Téléphone (Android / iPhone) et Ordinateur (PC / Mac)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="p-1.5 rounded-lg text-brume/70 hover:text-white hover:bg-white/10 transition"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {isInstallable && (
                <div className="p-4 rounded-card bg-seve/10 border border-seve/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-seve shrink-0" />
                    <div>
                      <p className="font-display font-bold text-nuit">Installation directe prête</p>
                      <p className="text-encre/70">Cliquez pour installer immédiatement en un seul geste.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await install();
                      if (ok) setGuideOpen(false);
                    }}
                    className="px-4 py-2 rounded-card bg-seve text-white font-display font-bold shrink-0 hover:bg-seve/90 transition"
                  >
                    Installer maintenant
                  </button>
                </div>
              )}

              <div className="grid gap-3">
                {/* Android */}
                <div className={`p-4 rounded-card border ${isAndroid ? 'border-seve bg-seve/5' : 'border-encre/10 bg-brume/40'}`}>
                  <div className="flex items-center gap-2 font-display font-bold text-nuit mb-1.5">
                    <Smartphone className="w-4 h-4 text-seve" />
                    <span>Sur Téléphone Android (Chrome / Edge / Samsung)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-encre/80">
                    <li>Ouvrez le menu du navigateur (<strong>⋮</strong> en haut à droite).</li>
                    <li>Appuyez sur <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.</li>
                    <li>Confirmez : l’icône <strong>ZandoGo</strong> s’installe comme une vraie app mobile.</li>
                  </ol>
                </div>

                {/* iOS */}
                <div className={`p-4 rounded-card border ${isIOS ? 'border-seve bg-seve/5' : 'border-encre/10 bg-brume/40'}`}>
                  <div className="flex items-center gap-2 font-display font-bold text-nuit mb-1.5">
                    <Share className="w-4 h-4 text-safran" />
                    <span>Sur iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-encre/80">
                    <li>Appuyez sur le bouton <strong>Partager</strong> (carré avec flèche vers le haut) dans la barre Safari.</li>
                    <li>Faites défiler et touchez <strong>« Sur l’écran d’accueil »</strong>.</li>
                    <li>Appuyez sur <strong>Ajouter</strong> pour lancer ZandoGo en plein écran.</li>
                  </ol>
                </div>

                {/* Desktop */}
                <div className="p-4 rounded-card border border-encre/10 bg-brume/40">
                  <div className="flex items-center gap-2 font-display font-bold text-nuit mb-1.5">
                    <Monitor className="w-4 h-4 text-nuit" />
                    <span>Sur Ordinateur (Windows, macOS, Linux — Chrome / Edge)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-encre/80">
                    <li>Cliquez sur l’icône <strong>Installer ZandoGo</strong> à droite de la barre d’adresse du navigateur.</li>
                    <li>Ou ouvrez le menu <strong>⋮ → Enregistrer et partager → Installer la page en tant qu’application</strong>.</li>
                    <li>L’application aura sa propre fenêtre et son raccourci sur le Bureau / Menu Démarrer.</li>
                  </ol>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  className="px-5 py-2 rounded-card bg-nuit text-brume font-display font-semibold hover:bg-nuit/90 transition"
                >
                  Compris
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
