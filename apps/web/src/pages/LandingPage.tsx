import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Package,
  Handshake,
  FileText,
  Sparkles,
  Truck,
  ArrowRight,
  Globe,
  Store,
  ChevronRight,
} from 'lucide-react';

export function LandingPage() {
  const featuredOfferings = [
    {
      id: 'prod-2',
      type: 'BIEN MATÉRIEL & MODE',
      typeIcon: Package,
      typeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      title: 'Veste Tailleur Haute Couture Motif Kuba',
      desc: 'Confection artisanale en lin et coton imprimé royal Kuba. Tarifs dégressifs pour revendeurs et boutiques.',
      priceUsd: 85,
      bulkPriceUsd: 68,
      priceCdf: '242 000',
      stockNote: 'Stock en rayon : 3 unités',
      image: '/src/assets/images/fashion_jacket_kuba_1794397997636.jpg',
      store: 'Boutique Victoire Wax',
      city: 'Kinshasa',
    },
    {
      id: 'prod-1',
      type: 'TEXTILE & GROS',
      typeIcon: Package,
      typeColor: 'text-amber-700 bg-amber-50 border-amber-200',
      title: 'Pagne Super Wax Vlisco Original (6 yards)',
      desc: 'Véritable wax hollandais de qualité supérieure. Grille tarifaire de gros dès 10 pièces avec devis négociable.',
      priceUsd: 65,
      bulkPriceUsd: 48,
      priceCdf: '185 000',
      stockNote: '18 pièces en stock',
      image: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80',
      store: 'Boutique Victoire Wax',
      city: 'Kinshasa',
    },
    {
      id: 'prod-3',
      type: 'DOCUMENT PDF & JURIDIQUE',
      typeIcon: FileText,
      typeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      title: 'Guide d’Investissement & Stratégie PME RDC',
      desc: 'Dossier de 142 pages avec templates Excel de trésorerie et modèles de contrats OHADA. Téléchargement immédiat.',
      priceUsd: 29,
      bulkPriceUsd: null,
      priceCdf: '82 500',
      stockNote: 'Accès numérique instantané',
      image: '/src/assets/images/digital_business_guide_1794397996870.jpg',
      store: 'Kinshasa Business Insights',
      city: 'Gombe',
    },
    {
      id: 'prod-4',
      type: 'SERVICE & TÉLÉCOMS',
      typeIcon: Sparkles,
      typeColor: 'text-sky-700 bg-sky-50 border-sky-200',
      title: 'Abonnement Internet Fibre Pro 100 Mbps',
      desc: 'Très haut débit illimité pour PME et ateliers avec routeur Wi-Fi 6 offert en prêt. Installation sous 24h.',
      priceUsd: 75,
      bulkPriceUsd: null,
      priceCdf: '213 500',
      stockNote: 'Technicien certifié inclus',
      image: '/src/assets/images/internet_fiber_service_1794397997131.jpg',
      store: 'KinConnect Télécoms',
      city: 'Gombe / Limete',
    },
  ];

  return (
    <div className="bg-[#F8FAFC] text-slate-800">
      {/* Hero Section (Alibaba-inspired B2B & B2C marketplace banner) */}
      <section className="bg-slate-950 text-white relative overflow-hidden border-b border-slate-800">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
          <div className="grid lg:grid-cols-[1.25fr_0.95fr] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-mono mb-6 border border-amber-500/25">
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>Plateforme Commerciale Nationale · Sans Frontières en RDC</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.06] tracking-tight">
                Achetez et vendez en toute confiance sur <span className="text-amber-500">ZandoGo</span>.
              </h1>

              <p className="mt-6 text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl">
                La place de marché universelle de la République Démocratique du Congo.
                Accédez à des <strong>tarifs de gros dégressifs</strong>, <strong>négociez vos prix en direct</strong> avec les fournisseurs, et sécurisez 100% de vos paiements sous <strong>séquestre garanti</strong>.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/products"
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3.5 text-xs transition shadow-xs inline-flex items-center gap-2"
                >
                  <span>Explorer les offres & catalogues</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/vendor"
                  className="rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold px-6 py-3.5 text-xs transition border border-white/20 inline-flex items-center gap-2"
                >
                  <Store className="w-4 h-4 text-amber-400" />
                  <span>Espace Vendeur Pro (Clair & Moderne)</span>
                </Link>

                <Link
                  to="/admin"
                  className="text-xs text-slate-400 hover:text-amber-400 underline underline-offset-4 ml-1"
                >
                  Console Admin SaaS &rarr;
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-12 pt-8 border-t border-slate-800 grid grid-cols-3 gap-6 text-xs text-slate-400">
                <div>
                  <span className="block text-white font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Séquestre 100%</span>
                  </span>
                  Fonds retenus jusqu'à confirmation client
                </div>

                <div>
                  <span className="block text-white font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <Handshake className="w-4 h-4 text-amber-400" />
                    <span>Négociation B2B</span>
                  </span>
                  Discutez et convenez du prix en ligne
                </div>

                <div>
                  <span className="block text-white font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-amber-400" />
                    <span>Toute la RDC</span>
                  </span>
                  Kinshasa, Lubumbashi, Goma, Matadi...
                </div>
              </div>
            </div>

            {/* Alibaba-style Trade Assurance & Negotiation Card Lockup */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono">
                  <ShieldCheck className="w-4 h-4" />
                  <span>ZANDOGO TRADE ASSURANCE</span>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">1 USD = 2 850 CDF</span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center justify-between text-white font-semibold mb-1">
                    <span>1. Tarifs Dégressifs & Négociation</span>
                    <span className="text-amber-400 font-mono text-[11px]">B2B / Gros</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Consultez la grille des prix selon la quantité commandée ou proposez votre propre tarif sur mesure au fournisseur avec le bouton "Négocier le prix".
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center justify-between text-white font-semibold mb-1">
                    <span>2. Paiement Sécurisé sous Séquestre</span>
                    <span className="text-amber-400 font-mono text-[11px]">Protection</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Payez par Mobile Money (M-Pesa, Orange, Airtel) ou Carte. Votre argent reste bloqué sur le compte séquestre de ZandoGo jusqu'à la remise en mains propres.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
                  <div className="flex items-center justify-between text-white font-semibold mb-1">
                    <span>3. Validation & Déblocage Vendeur</span>
                    <span className="text-emerald-400 font-mono text-[11px]">Clôture</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Dès confirmation de conformité du colis ou du service, confirmez la réception en un clic pour libérer les fonds au commerçant.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Pillars of ZandoGo */}
      <section className="mx-auto max-w-7xl px-6 py-16 border-b border-slate-200">
        <div className="text-xs font-mono uppercase tracking-wider text-amber-700 mb-2">
          Place de Marché Sans Limites
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mb-8">
          Conçu pour toutes les entreprises et tous les acheteurs de la RDC
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1.5">Biens Physiques & Stocks</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Suivi unitaire en rayon, variantes par tailles/couleurs, alertes de rupture et tarification dégressive par volume de commande.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1.5">Produits Digitaux & PDF</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vente d'e-books, guides fiscaux OHADA, modèles de contrats et logiciels avec génération automatique de lien de téléchargement direct.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1.5">Services & Télécoms</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Abonnements internet fibre optique, maintenance informatique, logistique ou consulting avec prise de rendez-vous technicien sous 24h.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center mb-4">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1.5">Logistique & Fret National</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Liaison nationale par camion et avion entre Kinshasa, Lubumbashi, Goma, Matadi et Kisangani avec code de retrait sécurisé.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Products Across Categories */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-amber-700 mb-1">
              Catalogue National en Vedette
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Découvrez la diversité des offres ZandoGo
            </h2>
          </div>

          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:text-amber-600 underline underline-offset-4"
          >
            <span>Voir l'ensemble du catalogue</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredOfferings.map((item) => {
            const Icon = item.typeIcon;
            return (
              <Link
                key={item.id}
                to={`/products/${item.id}`}
                className="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-md transition"
              >
                <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span
                    className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase border ${item.typeColor} flex items-center gap-1`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{item.type}</span>
                  </span>
                </div>

                <div className="p-4 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono mb-1">
                      <span className="font-medium text-slate-700 truncate">{item.store}</span>
                      <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>· {item.city}</span>
                    </div>

                    <h3 className="font-semibold text-slate-900 text-xs line-clamp-2 leading-snug group-hover:text-amber-600 transition-colors">
                      {item.title}
                    </h3>

                    <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-[11px] text-amber-800 font-mono mb-1 font-medium">
                      {item.stockNote}
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="font-mono text-base font-bold tabular-nums text-slate-900">
                          ${item.priceUsd}
                        </span>
                        {item.bulkPriceUsd && (
                          <span className="block text-[10px] font-mono text-amber-700 font-semibold tabular-nums">
                            Dès ${item.bulkPriceUsd} en gros
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                        {item.priceCdf} CDF
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Seller Portal Callout (Clear & Modern Light Theme) */}
      <section className="bg-slate-900 text-white py-16 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider font-semibold">
              Portail Commerçant & Grossiste
            </span>
            <h2 className="font-display text-3xl font-bold mt-2 text-white">
              Un espace vendeur clair, lumineux et pensé pour vos affaires
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-4 leading-relaxed">
              Fini les interfaces sombres et complexes. L'espace marchand ZandoGo vous offre un environnement de travail moderne : pilotez vos stocks unitaires, configurez vos paliers de prix pour la vente en gros et répondez en direct aux demandes de négociation de devis de vos clients.
            </p>

            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                to="/vendor"
                className="rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 text-xs transition shadow-xs inline-flex items-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>Accéder à l'Espace Vendeur Pro</span>
              </Link>

              <Link
                to="/admin"
                className="rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium px-5 py-2.5 text-xs transition border border-white/20"
              >
                Console Administration SaaS
              </Link>
            </div>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 font-mono text-xs text-slate-300 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700 text-white font-semibold">
              <span>RÉSEAU MARCHAND ZANDOGO RDC</span>
              <span className="text-emerald-400">EN SERVICE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Couverture provinciale :</span>
              <span className="text-white font-semibold">26 provinces couvertes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Paiements sous séquestre :</span>
              <span className="text-amber-400 font-bold tabular-nums">100% garanti</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fournisseurs vérifiés :</span>
              <span className="text-white tabular-nums">48 boutiques & grossistes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Flottes logistiques partenaires :</span>
              <span className="text-white tabular-nums">12 transporteurs agréés</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
