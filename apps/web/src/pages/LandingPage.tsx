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
import { useStore } from '../lib/store-context';

export function LandingPage() {
  const { exchangeRate, formatPrimaryPrice, formatSecondaryPrice } = useStore();

  const featuredOfferings = [
    {
      id: 'prod-8',
      type: 'TECH & BUREAU',
      typeIcon: Package,
      title: 'Pack 10 Clés USB 64GB Kingston Metal',
      desc: 'Clés USB métal résistantes avec étui cuir. Prix unitaire ou tarif de gros négociable avec transport direct.',
      priceUsd: 42,
      bulkPriceUsd: 32,
      stockNote: '45 packs disponibles',
      image: '/src/assets/images/usb_kingston_bundle_1794567970257.jpg',
      store: 'Kin Digital Gombe',
      city: 'Kinshasa',
    },
    {
      id: 'prod-1',
      type: 'TEXTILE & MODE',
      typeIcon: Package,
      title: 'Pagne Super Wax Vlisco Original (6 yards)',
      desc: 'Véritable wax hollandais de qualité supérieure. Achat au détail dès 1 pièce ou tarif dégressif avec devis négociable.',
      priceUsd: 65,
      bulkPriceUsd: 48,
      stockNote: '18 pièces en stock',
      image: '/src/assets/images/wax_vlisco_fabric_1794567971042.jpg',
      store: 'Boutique Victoire Wax',
      city: 'Kinshasa',
    },
    {
      id: 'prod-3',
      type: 'DOCUMENT PDF & JURIDIQUE',
      typeIcon: FileText,
      title: 'Guide d’Investissement & Stratégie PME RDC',
      desc: 'Dossier de 142 pages avec templates Excel de trésorerie et modèles de contrats OHADA. Téléchargement immédiat.',
      priceUsd: 29,
      bulkPriceUsd: null,
      stockNote: 'Accès numérique instantané',
      image: '/src/assets/images/digital_business_guide_1794397996870.jpg',
      store: 'Kinshasa Business Insights',
      city: 'Gombe',
    },
    {
      id: 'prod-4',
      type: 'SERVICE & TÉLÉCOMS',
      typeIcon: Sparkles,
      title: 'Abonnement Internet Fibre Pro 100 Mbps',
      desc: 'Très haut débit illimité pour PME et ateliers avec routeur Wi-Fi 6 offert en prêt. Installation sous 24h.',
      priceUsd: 75,
      bulkPriceUsd: null,
      stockNote: 'Technicien certifié inclus',
      image: '/src/assets/images/internet_fiber_service_1794397997131.jpg',
      store: 'KinConnect Télécoms',
      city: 'Gombe / Limete',
    },
  ];

  return (
    <div className="bg-brume text-encre">
      {/* Hero Section */}
      <section className="bg-nuit text-brume relative overflow-hidden border-b border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
          <div className="grid lg:grid-cols-[1.25fr_0.95fr] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-seve/20 text-safran text-xs font-mono mb-6 border border-safran/30">
                <Globe className="w-3.5 h-3.5 text-safran" />
                <span>Place Commerciale RDC · Détail & Gros Sans Frontières</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.06] tracking-tight">
                Achetez et vendez en toute confiance sur <span className="text-seve">Zando</span><span className="text-safran">Go</span>.
              </h1>

              <p className="mt-6 text-brume/80 text-base sm:text-lg leading-relaxed max-w-xl">
                La plateforme commerciale nationale de la RDC. Vente au <strong>détail dès 1 pièce</strong>, <strong>tarifs dégressifs</strong> de gros, <strong>négociation du prix & du transport</strong> en direct avec les vendeurs, et <strong>séquestre 100% garanti</strong>.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/products"
                  className="rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold px-6 py-3.5 text-xs transition shadow-xs inline-flex items-center gap-2"
                >
                  <span>Explorer les offres & catalogues</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/vendor"
                  className="rounded-card bg-white/10 hover:bg-white/15 text-brume font-semibold px-6 py-3.5 text-xs transition border border-white/20 inline-flex items-center gap-2"
                >
                  <Store className="w-4 h-4 text-safran" />
                  <span>Espace Vendeur Pro</span>
                </Link>

                <Link
                  to="/admin"
                  className="text-xs text-safran hover:underline underline-offset-4 ml-1 font-display"
                >
                  Console Admin &rarr;
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-3 gap-6 text-xs text-brume/70">
                <div>
                  <span className="block text-brume font-display font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-seve" />
                    <span>Séquestre 100%</span>
                  </span>
                  Fonds retenus jusqu'à confirmation de livraison
                </div>

                <div>
                  <span className="block text-brume font-display font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <Handshake className="w-4 h-4 text-safran" />
                    <span>Prix & Transport</span>
                  </span>
                  Discutez le tarif produit et les frais de livraison
                </div>

                <div>
                  <span className="block text-brume font-display font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-seve" />
                    <span>Toute la RDC</span>
                  </span>
                  Kinshasa, Lubumbashi, Goma, Matadi...
                </div>
              </div>
            </div>

            {/* Trade Assurance & Negotiation Card */}
            <div className="bg-white/5 border border-white/10 rounded-card p-6 lg:p-8 shadow-xl space-y-5 backdrop-blur-sm">
              <div className="flex items-center justify-between pb-4 border-b border-white/10 text-xs">
                <div className="flex items-center gap-2 text-seve font-display font-semibold">
                  <ShieldCheck className="w-4 h-4 text-seve" />
                  <span>ZANDOGO TRADE ASSURANCE</span>
                </div>
                <span className="text-safran font-mono text-[11px] bg-safran/10 border border-safran/30 px-2.5 py-0.5 rounded-full tabular-nums">
                  1 USD = {exchangeRate.toLocaleString('fr-FR')} CDF
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="p-4 rounded-xl bg-nuit/80 border border-white/10">
                  <div className="flex items-center justify-between text-brume font-display font-semibold mb-1">
                    <span>1. Vente au Détail & Négociation sur Mesure</span>
                    <span className="text-safran font-mono text-[11px]">Dès 1 pièce</span>
                  </div>
                  <p className="text-brume/70 leading-relaxed text-[11px]">
                    Commandez directement au détail dès 1 pièce ou proposez une offre de prix au vendeur avec le bouton « Négocier le prix » pour obtenir un rabais.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-nuit/80 border border-white/10">
                  <div className="flex items-center justify-between text-brume font-display font-semibold mb-1">
                    <span>2. Négociation du Mode & Frais de Livraison</span>
                    <span className="text-seve font-mono text-[11px]">Transport</span>
                  </div>
                  <p className="text-brume/70 leading-relaxed text-[11px]">
                    Convenez avec le vendeur du coursier express en ville, de l'agence de bus ou du fret fluvial / aérien ainsi que du tarif de livraison adapté à votre ville.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-nuit/80 border border-white/10">
                  <div className="flex items-center justify-between text-brume font-display font-semibold mb-1">
                    <span>3. Paiement Séquestre Garanti</span>
                    <span className="text-seve font-mono text-[11px]">Protection 100%</span>
                  </div>
                  <p className="text-brume/70 leading-relaxed text-[11px]">
                    Payez par Mobile Money (M-Pesa, Orange, Airtel) ou Carte. Vos fonds restent consignés sur le compte séquestre de ZandoGo jusqu'à confirmation de conformité.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] text-brume/70">
                <span className="flex items-center gap-1.5 text-brume/90">
                  <CheckCircle2 className="w-3.5 h-3.5 text-seve" />
                  Messagerie liée au produit
                </span>
                <Link to="/chat" className="text-safran hover:underline font-medium flex items-center gap-1 font-display">
                  <MessagesSquare className="w-3.5 h-3.5" />
                  <span>Ouvrir les échanges</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Interactive Pillars of ZandoGo */}
      <section className="mx-auto max-w-7xl px-6 py-16 border-b border-encre/10">
        <div className="text-xs font-mono uppercase tracking-wider text-seve mb-2 font-semibold">
          Place de Marché Sans Limites
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-nuit mb-8">
          Conçu pour tous les commerces, entreprises et acheteurs de la RDC
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link
            to="/products?type=PHYSICAL"
            className="p-6 rounded-card bg-white border border-encre/10 shadow-xs hover:border-seve/40 hover:-translate-y-0.5 transition block"
          >
            <div className="h-10 w-10 rounded-card bg-seve/10 text-seve flex items-center justify-center mb-4">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-nuit text-sm mb-1.5">Biens Physiques & Stocks</h3>
            <p className="text-xs text-encre/70 leading-relaxed">
              Vente au détail ou en volume, gestion unitaire en magasin, alertes de rupture et livraison flexible dans toutes les communes.
            </p>
          </Link>

          <Link
            to="/products?type=DIGITAL"
            className="p-6 rounded-card bg-white border border-encre/10 shadow-xs hover:border-seve/40 hover:-translate-y-0.5 transition block"
          >
            <div className="h-10 w-10 rounded-card bg-safran/20 text-encre flex items-center justify-center mb-4">
              <FileText className="w-5 h-5 text-seve" />
            </div>
            <h3 className="font-display font-bold text-nuit text-sm mb-1.5">Produits Digitaux & PDF</h3>
            <p className="text-xs text-encre/70 leading-relaxed">
              Vente d'e-books, guides juridiques et fiscaux OHADA, formations et logiciels avec téléchargement direct et instantané.
            </p>
          </Link>

          <Link
            to="/products?type=SERVICE"
            className="p-6 rounded-card bg-white border border-encre/10 shadow-xs hover:border-seve/40 hover:-translate-y-0.5 transition block"
          >
            <div className="h-10 w-10 rounded-card bg-safran/20 text-safran flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5 text-seve" />
            </div>
            <h3 className="font-display font-bold text-nuit text-sm mb-1.5">Services & Télécoms</h3>
            <p className="text-xs text-encre/70 leading-relaxed">
              Abonnements internet fibre optique, maintenance technique, consulting et prestations physiques ou virtuelles avec suivi.
            </p>
          </Link>

          <Link
            to="/orders"
            className="p-6 rounded-card bg-white border border-encre/10 shadow-xs hover:border-seve/40 hover:-translate-y-0.5 transition block"
          >
            <div className="h-10 w-10 rounded-card bg-wax/10 text-wax flex items-center justify-center mb-4">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-nuit text-sm mb-1.5">Transport & Fret Négociables</h3>
            <p className="text-xs text-encre/70 leading-relaxed">
              Coursier express local, agences interurbaines (Kinshasa, Lubumbashi, Goma) et fret avec suivi GPS en direct.
            </p>
          </Link>
        </div>
      </section>

      {/* Featured Products Across Categories */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-seve mb-1 font-semibold">
              Catalogue National en Vedette
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-nuit">
              Découvrez la diversité des offres ZandoGo
            </h2>
          </div>

          <Link
            to="/products"
            className="inline-flex items-center gap-1.5 text-xs font-display font-bold text-seve hover:text-seve/80 underline underline-offset-4"
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
                className="group flex flex-col bg-white rounded-card border border-encre/10 overflow-hidden hover:border-seve/40 hover:shadow-md transition"
              >
                <div className="aspect-[4/3] bg-brume relative overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase bg-nuit/90 text-brume shadow-xs flex items-center gap-1">
                    <Icon className="w-3 h-3 text-safran" />
                    <span>{item.type}</span>
                  </span>
                </div>

                <div className="p-4 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center gap-1.5 text-[11px] text-encre/60 mb-1">
                      <span className="font-medium text-encre/80 truncate">{item.store}</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-seve shrink-0" />
                      <span>· {item.city}</span>
                    </div>

                    <h3 className="font-bold text-encre text-xs line-clamp-2 leading-snug group-hover:text-seve transition-colors">
                      {item.title}
                    </h3>

                    <p className="text-[11px] text-encre/60 mt-1.5 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-encre/10">
                    <div className="text-[11px] text-seve font-sans mb-1 font-medium">
                      {item.stockNote}
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <span className="font-display text-base font-extrabold tabular-nums text-nuit">
                          {formatPrimaryPrice(item.priceUsd)}
                        </span>
                        {item.bulkPriceUsd && (
                          <span className="block text-[10px] font-display text-encre font-bold tabular-nums bg-safran/25 px-1.5 py-0.5 rounded-md mt-0.5 border border-safran/40">
                            Dès {formatPrimaryPrice(item.bulkPriceUsd)} avec remise
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-encre/50 tabular-nums shrink-0">
                        {formatSecondaryPrice(item.priceUsd)}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Seller Portal Callout */}
      <section className="bg-nuit text-brume py-16 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-xs font-mono text-safran uppercase tracking-wider font-semibold">
              Portail Commerçant, Prestataire & Grossiste
            </span>
            <h2 className="font-display text-3xl font-bold mt-2 text-brume">
              Un espace vendeur clair, lumineux et pensé pour vos affaires
            </h2>
            <p className="text-brume/75 text-xs sm:text-sm mt-4 leading-relaxed">
              L'espace marchand ZandoGo vous offre un environnement de travail clair et moderne : gérez vos stocks réels, traitez vos expéditions, suivez votre portefeuille et négociez le tarif avec le transport adapté.
            </p>

            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                to="/vendor"
                className="rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold px-5 py-2.5 text-xs transition shadow-xs inline-flex items-center gap-2"
              >
                <Store className="w-4 h-4" />
                <span>Accéder à l'Espace Vendeur Pro</span>
              </Link>

              <Link
                to="/admin"
                className="rounded-card bg-white/10 hover:bg-white/15 text-brume font-semibold px-5 py-2.5 text-xs transition border border-white/20"
              >
                Console Administration
              </Link>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-card p-6 font-mono text-xs text-brume/80 space-y-3 backdrop-blur-xs">
            <div className="flex justify-between items-center pb-2 border-b border-white/10 text-brume font-semibold">
              <span>RÉSEAU MARCHAND ZANDOGO RDC</span>
              <span className="text-seve font-bold">EN SERVICE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brume/60">Couverture provinciale :</span>
              <span className="text-brume font-semibold">26 provinces couvertes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brume/60">Paiements sous séquestre :</span>
              <span className="text-seve font-bold tabular-nums">100% garanti</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brume/60">Fournisseurs vérifiés :</span>
              <span className="text-safran tabular-nums">48 boutiques & grossistes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brume/60">Flottes logistiques partenaires :</span>
              <span className="text-seve tabular-nums">12 transporteurs agréés</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
