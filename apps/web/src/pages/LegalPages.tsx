import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Lock, Scale, HelpCircle, MessageSquare, FileText, ArrowLeft } from 'lucide-react';

type LegalSection = 'cgu' | 'privacy' | 'escrow' | 'support';

const SECTION_TABS: { id: LegalSection; to: string; label: string }[] = [
  { id: 'cgu', to: '/cgu', label: 'Conditions Générales' },
  { id: 'privacy', to: '/privacy', label: 'Confidentialité & KYC' },
  { id: 'escrow', to: '/escrow-policy', label: 'Garantie Séquestre 48h' },
  { id: 'support', to: '/support', label: 'Aide & Support RDC' },
];

export function LegalPages({ section }: { section: LegalSection }) {
  const location = useLocation();
  const activeTab =
    location.pathname === '/privacy'
      ? 'privacy'
      : location.pathname === '/escrow-policy'
      ? 'escrow'
      : location.pathname === '/support'
      ? 'support'
      : section;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/products" className="inline-flex items-center gap-1.5 text-xs font-semibold text-encre/60 hover:text-seve">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Retour au catalogue</span>
        </Link>

        <nav className="flex flex-wrap gap-2">
          {SECTION_TABS.map((t) => (
            <Link
              key={t.id}
              to={t.to}
              className={`px-3 py-1.5 rounded-card text-xs font-display font-semibold transition border ${
                activeTab === t.id
                  ? 'bg-nuit text-safran border-nuit'
                  : 'bg-white text-encre/75 border-encre/15 hover:border-seve'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {activeTab === 'cgu' && (
        <article className="rounded-card bg-white border border-encre/10 p-6 md:p-8 shadow-xs space-y-5 text-sm text-encre/85 leading-relaxed">
          <div className="flex items-center gap-3 border-b border-encre/10 pb-4">
            <FileText className="w-6 h-6 text-seve shrink-0" />
            <div>
              <h1 className="font-display text-2xl font-bold text-nuit">Conditions Générales d’Utilisation — ZandoGo RDC</h1>
              <p className="text-xs text-encre/55">Place de marché de référence — Siège Goma, Nord-Kivu, RD Congo</p>
            </div>
          </div>
          <section className="space-y-2">
            <h2 className="font-display font-bold text-nuit text-base">1. Objet & Champ d’application</h2>
            <p>
              ZandoGo met en relation des acheteurs particuliers et professionnels avec des vendeurs vérifiés, prestataires de services et livreurs indépendants en République Démocratique du Congo et dans la région des Grands Lacs.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-display font-bold text-nuit text-base">2. Commandes, Prix & Facturation USD / CDF</h2>
            <p>
              Les prix sont affichés en dollars américains (USD) avec équivalent indicatif en francs congolais (CDF) selon le taux de change officiel mis à jour par l’administration ZandoGo. Chaque commande payée génère une facture PDF certifiée dotée d’un code de preuve SHA-256.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-display font-bold text-nuit text-base">3. Engagements des vendeurs & livreurs</h2>
            <p>
              Tout marchand s’engage à proposer des articles conformes, authentiques et réellement en stock. Les livreurs agréés confirment chaque remise par preuve obligatoire (code OTP client, photo géolocalisée ou signature manuscrite).
            </p>
          </section>
        </article>
      )}

      {activeTab === 'privacy' && (
        <article className="rounded-card bg-white border border-encre/10 p-6 md:p-8 shadow-xs space-y-5 text-sm text-encre/85 leading-relaxed">
          <div className="flex items-center gap-3 border-b border-encre/10 pb-4">
            <Lock className="w-6 h-6 text-seve shrink-0" />
            <div>
              <h1 className="font-display text-2xl font-bold text-nuit">Confidentialité & Protection des Données KYC</h1>
              <p className="text-xs text-encre/55">Sécurité des comptes, pièces d’identité et coordonnées bancaires / Mobile Money</p>
            </div>
          </div>
          <section className="space-y-2">
            <h2 className="font-display font-bold text-nuit text-base">1. Données collectées</h2>
            <p>
              Nous collectons uniquement les données nécessaires à l’exécution de vos commandes : nom complet, e-mail, téléphone Mobile Money, adresses de livraison (commune, quartier, repère GPS) et justificatifs KYC pour les boutiques et livreurs.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-display font-bold text-nuit text-base">2. Stockage sécurisé & accès restreint</h2>
            <p>
              Les documents d’identité (carte d’électeur, passeport, patente RCCM, permis de conduire) sont chiffrés et accessibles exclusivement via URL signées temporaires par les administrateurs habilités à la validation KYC.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-display font-bold text-nuit text-base">3. Paiements Mobile Money & Cartes</h2>
            <p>
              ZandoGo ne stocke aucun code PIN Mobile Money ni numéro complet de carte bancaire. Les transactions passent par des passerelles chiffrées avec contre-vérification serveur HMAC-SHA256.
            </p>
          </section>
        </article>
      )}

      {activeTab === 'escrow' && (
        <article className="rounded-card bg-white border border-encre/10 p-6 md:p-8 shadow-xs space-y-5 text-sm text-encre/85 leading-relaxed">
          <div className="flex items-center gap-3 border-b border-encre/10 pb-4">
            <Scale className="w-6 h-6 text-safran shrink-0" />
            <div>
              <h1 className="font-display text-2xl font-bold text-nuit">Politique de Séquestre 48h & Arbitrage des Litiges</h1>
              <p className="text-xs text-encre/55">Protection acheteur et garantie de paiement marchand</p>
            </div>
          </div>
          <section className="space-y-2">
            <h2 className="font-display font-bold text-nuit text-base">1. Principe du compte séquestre</h2>
            <p>
              Lorsqu’une commande est réglée via Mobile Money (M-Pesa, Airtel Money, Orange Money, MTN MoMo) ou Carte, les fonds sont conservés sous séquestre pendant 48 heures afin de garantir la réception conforme du colis.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-display font-bold text-nuit text-base">2. Ouverture d’un litige</h2>
            <p>
              Si le produit reçu est endommagé, non conforme ou non livré, l’acheteur peut ouvrir un litige avec preuves photo depuis « Mes Commandes ». Les fonds restent immédiatement gelés le temps de l’arbitrage par l’équipe ZandoGo.
            </p>
          </section>
          <section className="space-y-2">
            <h2 className="font-display font-bold text-nuit text-base">3. Déblocage anticipé par l’acheteur</h2>
            <p>
              Dès que vous confirmez la bonne réception de votre commande depuis « Mes Commandes », les fonds sont immédiatement transférés sur le portefeuille disponible du vendeur.
            </p>
          </section>
        </article>
      )}

      {activeTab === 'support' && (
        <article className="rounded-card bg-white border border-encre/10 p-6 md:p-8 shadow-xs space-y-6 text-sm text-encre/85">
          <div className="flex items-center gap-3 border-b border-encre/10 pb-4">
            <HelpCircle className="w-6 h-6 text-seve shrink-0" />
            <div>
              <h1 className="font-display text-2xl font-bold text-nuit">Centre d’Aide & Support ZandoGo RDC</h1>
              <p className="text-xs text-encre/55">Assistance clients, boutiques partenaires et coursiers — 7j/7</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-card bg-brume/60 border border-encre/10 space-y-1.5">
              <p className="font-display font-bold text-nuit text-sm">Siège & Opérations Goma</p>
              <p className="text-encre/70">Boulevard Kanyamuhanga, Les Volcans, Goma (Nord-Kivu)</p>
              <p className="font-mono text-nuit font-semibold">support@zandogo.cd · +243 820 001 122</p>
            </div>
            <div className="p-4 rounded-card bg-seve/10 border border-seve/25 space-y-2">
              <p className="font-display font-bold text-nuit text-sm inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-seve" />
                <span>Messagerie directe & Suivi</span>
              </p>
              <p className="text-encre/70">Discutez avec un vendeur, un coursier ou ouvrez une demande d’assistance.</p>
              <Link
                to="/chat"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-card bg-seve text-brume font-display font-bold hover:bg-seve/90 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Ouvrir la messagerie</span>
              </Link>
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
