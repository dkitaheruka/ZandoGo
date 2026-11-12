import { Link } from 'react-router-dom';
import {
  Package,
  FileText,
  Sparkles,
  Truck,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Store,
  Handshake,
  Globe,
  MessagesSquare,
  CheckCircle2,
} from 'lucide-react';

export function LandingPage() {
  const featuredOfferings = [
    {
      id: 'prod-2',
      type: 'TECH & BUREAU',
      typeIcon: Package,
      typeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
      title: 'Pack 10 Clés USB 64GB Kingston Metal',
      desc: 'Clés USB métal résistantes avec chiffrement. Prix unitaire ou tarif de gros négociable avec transport direct.',
      priceUsd: 42,
      bulkPriceUsd: 32,
      priceCdf: '119 700',
      stockNote: '45 packs disponibles',
      image: '/src/assets/images/tech_gadget_usb_bundle_1794397996593.jpg',
      store: 'Gombe High-Tech Solutions',
      city: 'Kinshasa',
    },
    {
      id: 'prod-1',
      type: 'TEXTILE & MODE',
      typeIcon: Package,
      typeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      title: 'Pagne Super Wax Vlisco Original (6 yards)',
      desc: 'Véritable wax hollandais de qualité supérieure. Achat au détail dès 1 pièce ou tarif dégressif avec devis négociable.',
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
      typeColor: 'text-cyan-800 bg-cyan-50 border-cyan-200',
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
      typeColor: 'text-emerald-800 bg-emerald-50 border-emerald-200',
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
      {/* Hero Section (Noir, Vert, Cyan) */}
      <section className="bg-[#0B0F19] text-white relative overflow-hidden border-b border-slate-800">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
          <div className="grid lg:grid-cols-[1.25fr_0.95fr] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono mb-6 border border-cyan-500/25">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>Place Commerciale RDC · Détail & Gros Sans Frontières</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.06] tracking-tight">
                Achetez et vendez en toute confiance sur <span className="text-emerald-400">Zando</span><span className="text-cyan-400">Go</span>.
              </h1>

              <p className="mt-6 text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl">
                La plateforme commerciale nationale de la RDC. Vente au <strong>détail dès 1 pièce</strong>, <strong>tarifs dégressifs</strong> de gros, <strong>négociation du prix & du transport</strong> en direct avec les vendeurs, et <strong>séquestre 100% garanti</strong>.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/products"
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3.5 text-xs transition shadow-xs inline-flex items-center gap-2"
                >
                  <span>Explorer les offres & catalogues</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/vendor"
                  className="rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 font-semibold px-6 py-3.5 text-xs transition border border-cyan-500/30 inline-flex items-center gap-2"
                >
                  <Store className="w-4 h-4 text-cyan-400" />
                  <span>Espace Vendeur Pro (Clair & Moderne)</span>
                </Link>

                <Link
                  to="/admin"
                  className="text-xs text-slate-400 hover:text-cyan-300 underline underline-offset-4 ml-1"
                >
                  Console Admin SaaS &rarr;
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-12 pt-8 border-t border-slate-800 grid grid-cols-3 gap-6 text-xs text-slate-400">
                <div>
                  <span className="block text-white font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Séquestre 100%</span>
                  </span>
                  Fonds retenus jusqu'à confirmation de livraison
                </div>

                <div>
                  <span className="block text-white font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <Handshake className="w-4 h-4 text-cyan-400" />
                    <span>Prix & Transport</span>
                  </span>
                  Discutez le tarif produit et les frais de livraison
                </div>

                <div>
                  <span className="block text-white font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-400" />
                    <span>Toute la RDC</span>
                  </span>
                  Kinshasa, Lubumbashi, Goma, Matadi...
                </div>
              </div>
            </div>

            {/* Trade Assurance & Negotiation Card Lockup */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold font-mono">
                  <ShieldCheck className="w-4 h-4" />
                  <span>ZANDOGO TRADE ASSURANCE</span>
                </div>
                <span className="text-cyan-400 font-mono text-[11px] bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-md">
                  1 USD = 2 850 CDF
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center justify-between text-white font-semibold mb-1">
                    <span>1. Vente au Détail & Négociation sur Mesure</span>
                    <span className="text-cyan-400 font-mono text-[11px]">Dès 1 pièce</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Commandez directement au détail dès 1 pièce ou proposez une offre de prix au vendeur avec le bouton « Négocier le prix » pour obtenir un rabais.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center justify-between text-white font-semibold mb-1">
                    <span>2. Négociation du Mode & Frais de Livraison</span>
                    <span className="text-emerald-400 font-mono text-[11px]">Transport</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Convenez avec le vendeur du coursier express en ville, de l'agence de bus ou du fret fluvial / aérien ainsi que du tarif de livraison adapté à votre ville.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center justify-between text-white font-semibold mb-1">
                    <span>3. Paiement Séquestre Garanti</span>
                    <span className="text-emerald-400 font-mono text-[11px]">Protection 100%</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed text-[11px]">
                    Payez par Mobile Money (M-Pesa, Orange, Airtel) ou Carte. Vos fonds restent consignés sur le compte séquestre de ZandoGo jusqu'à confirmation de conformité.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Messagerie liée au produit
                </span>
                <Link to="/chat" className="text-cyan-400 hover:text-cyan-300 font-medium underline flex items-center gap-1">
                  <MessagesSquare className="w-3.5 h-3.5" />
                  <span>Ouvrir les échanges</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Pillars of ZandoGo */}
      <section className="mx-auto max-w-7xl px-6 py-16 border-b border-slate-200">
        <div className="text-xs font-mono uppercase tracking-wider text-emerald-700 mb-2">
          Place de Marché Sans Limites
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mb-8">
          Conçu pour tous les commerces, entreprises et acheteurs de la RDC
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-300 transition">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1.5">Biens Physiques & Stocks</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vente au détail ou en volume, gestion unitaire en magasin, alertes de rupture et livraison flexible dans toutes les communes.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-cyan-300 transition">
            <div className="h-10 w-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1.5">Produits Digitaux & PDF</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vente d'e-books, guides juridiques et fiscaux OHADA, formations et logiciels avec téléchargement direct et instantané.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-300 transition">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1.5">Services & Télécoms</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Abonnements internet fibre optique, maintenance technique, consulting et prestations physiques ou virtuelles avec suivi.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-cyan-300 transition">
            <div className="h-10 w-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center mb-4">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1.5">Transport & Fret Négociables</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Coursier express local, agences interurbaines (Kinshasa, Lubumbashi, Goma) et fret avec accord sur les frais avant expédition.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Products Across Categories */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-emerald-700 mb-1">
              Catalogue National en Vedette
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Découvrez la diversité des offres ZandoGo
            </h2>
          </div>

          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-4"
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
                className="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-emerald-300 hover:shadow-md transition"
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

                    <h3 className="font-semibold text-slate-900 text-xs line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors">
                      {item.title}
                    </h3>

                    <p className="text-[11px] text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-[11px] text-emerald-800 font-mono mb-1 font-medium">
                      {item.stockNote}
                    </div>

                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="font-mono text-base font-bold tabular-nums text-slate-900">
                          ${item.priceUsd}
                        </span>
                        {item.bulkPriceUsd && (
                          <span className="block text-[10px] font-mono text-emerald-700 font-semibold tabular-nums">
                            Dès ${item.bulkPriceUsd} avec remise
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
      <section className="bg-[#0B0F19] text-white py-16 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Portail Commerçant, Prestataire & Grossiste
            </span>
            <h2 className="font-display text-3xl font-bold mt-2 text-white">
              Un espace vendeur clair, lumineux et pensé pour vos affaires
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-4 leading-relaxed">
              Fini les interfaces sombres et complexes. L'espace marchand ZandoGo vous offre un environnement de travail clair et moderne : gérez vos stocks réels, répondez aux clients en direct sur leurs produits et négociez le tarif avec le transport adapté.
            </p>

            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                to="/vendor"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 text-xs transition shadow-xs inline-flex items-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>Accéder à l'Espace Vendeur Pro</span>
              </Link>

              <Link
                to="/admin"
                className="rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 font-medium px-5 py-2.5 text-xs transition border border-cyan-500/30"
              >
                Console Administration SaaS
              </Link>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 font-mono text-xs text-slate-300 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-white font-semibold">
              <span>RÉSEAU MARCHAND ZANDOGO RDC</span>
              <span className="text-emerald-400">EN SERVICE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Couverture provinciale :</span>
              <span className="text-white font-semibold">26 provinces couvertes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Paiements sous séquestre :</span>
              <span className="text-emerald-400 font-bold tabular-nums">100% garanti</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fournisseurs vérifiés :</span>
              <span className="text-cyan-300 tabular-nums">48 boutiques & grossistes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Flottes logistiques partenaires :</span>
              <span className="text-emerald-300 tabular-nums">12 transporteurs agréés</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
