import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  FileText,
  Sparkles,
  Truck,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Store,
  Handshake,
  Globe,
  CheckCircle2,
  BadgeCheck,
  Megaphone,
  MapPin,
  CreditCard,
  MessageSquare,
} from 'lucide-react';
import { api } from '../lib/api';
import { useStore } from '../lib/store-context';
import { PaymentOperatorStrip } from '../components/PaymentOperatorLogos';
import type { Product } from '../lib/types';

export function LandingPage() {
  const { exchangeRate, formatPrimaryPrice, formatSecondaryPrice } = useStore();
  const [sponsoredProducts, setSponsoredProducts] = useState<Product[]>([]);
  const [catalogTop, setCatalogTop] = useState<Product[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(true);
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingOffers(true);

    Promise.allSettled([
      api.get<Product[]>('/products/sponsored'),
      api.get<Product[]>('/products'),
    ])
      .then(([sponsoredRes, catalogRes]) => {
        if (cancelled) return;
        const liveCatalog =
          catalogRes.status === 'fulfilled' && Array.isArray(catalogRes.value.data)
            ? catalogRes.value.data
            : [];
        const liveSponsored =
          sponsoredRes.status === 'fulfilled' && Array.isArray(sponsoredRes.value.data)
            ? sponsoredRes.value.data
            : [];

        setCatalogTop(liveCatalog.slice(0, 4));
        setSponsoredProducts(liveSponsored.length > 0 ? liveSponsored : liveCatalog.slice(0, 6));
      })
      .finally(() => {
        if (!cancelled) setLoadingOffers(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (carouselPaused || sponsoredProducts.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % sponsoredProducts.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [carouselPaused, sponsoredProducts.length]);

  const currentSlide =
    sponsoredProducts.length > 0
      ? sponsoredProducts[activeSlide % sponsoredProducts.length] || sponsoredProducts[0]
      : null;
  const currentIsKm = currentSlide?.pricingUnit === 'KM';
  const currentBestTier =
    currentSlide?.priceTiers && currentSlide.priceTiers.length > 1
      ? currentSlide.priceTiers[currentSlide.priceTiers.length - 1].unitPriceUsd
      : null;

  return (
    <div className="bg-brume text-encre">
      {/* Hero Section — Vert clair & léger */}
      <section className="bg-gradient-to-br from-[#ECF5F0] via-[#F3F8F5] to-[#E1EFE7] text-nuit relative overflow-hidden border-b border-seve/15">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:py-20">
          <div className="grid lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/85 text-nuit text-xs font-mono mb-6 border border-seve/20 shadow-xs">
                <Globe className="w-3.5 h-3.5 text-seve" />
                <span>Siège Goma (Nord-Kivu) · Détail, Gros B2B dans toute la RDC & environs</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.06] tracking-tight text-nuit">
                Achetez et vendez partout en <span className="text-seve">RDC</span> et ses environs sur{' '}
                <span className="text-[#B47808] underline decoration-safran decoration-4 underline-offset-4">
                  ZandoGo
                </span>
                .
              </h1>

              <p className="mt-6 text-encre/80 text-base sm:text-lg leading-relaxed max-w-xl">
                Basée à Goma et active dans les 26 provinces de la RDC et les pays voisins. Vente au{' '}
                <strong>détail dès 1 pièce</strong>, <strong>vendeurs certifiés</strong>,{' '}
                <strong>négociation du prix & du transport</strong> avec point Google Maps, et règlement direct{' '}
                <strong>Airtel Money, M-Pesa Vodacom, Orange Money, MTN MoMo & Cartes</strong> sous séquestre.
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
                  className="rounded-card bg-white hover:bg-white/90 text-nuit font-semibold px-6 py-3.5 text-xs transition border border-seve/25 shadow-xs inline-flex items-center gap-2"
                >
                  <Store className="w-4 h-4 text-seve" />
                  <span>Espace Vendeur Pro</span>
                </Link>

                <Link
                  to="/admin"
                  className="text-xs text-nuit/80 hover:text-seve hover:underline underline-offset-4 ml-1 font-display font-semibold"
                >
                  Console Admin &rarr;
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-10 pt-8 border-t border-seve/15 grid grid-cols-3 gap-6 text-xs text-encre/75">
                <div>
                  <span className="text-nuit font-display font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-seve shrink-0" />
                    <span>Séquestre 100%</span>
                  </span>
                  Fonds retenus sous séquestre jusqu'à livraison confirmée
                </div>

                <div>
                  <span className="text-nuit font-display font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <Handshake className="w-4 h-4 text-[#B47808] shrink-0" />
                    <span>Prix & Transport</span>
                  </span>
                  Discutez le tarif produit & la livraison partout en RDC avec Google Maps
                </div>

                <div>
                  <span className="text-nuit font-display font-semibold text-sm mb-1 flex items-center gap-1.5">
                    <BadgeCheck className="w-4 h-4 text-seve shrink-0" />
                    <span>Vendeurs Certifiés</span>
                  </span>
                  Boutiques contrôlées identifiables sur chaque fiche
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-seve/15 flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-encre/65">
                  Paiements acceptés :
                </span>
                <PaymentOperatorStrip compact />
              </div>
            </div>

            {/* Hero Right Panel: Auto-Scrolling Carousel powered exclusively by backend catalog/ad logic */}
            <div
              onMouseEnter={() => setCarouselPaused(true)}
              onMouseLeave={() => setCarouselPaused(false)}
              className="bg-white/95 border border-seve/20 rounded-card p-5 lg:p-6 shadow-xl space-y-4 backdrop-blur-sm"
            >
              {/* Carousel Header */}
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-encre/10 text-xs">
                <div className="flex items-center gap-2 text-nuit font-display font-bold">
                  <Megaphone className="w-4 h-4 text-[#B47808] shrink-0" />
                  <span className="uppercase tracking-wider">Vitrine Publicité Mensuelle</span>
                </div>
                {sponsoredProducts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-encre/60 tabular-nums">
                      {(activeSlide % sponsoredProducts.length) + 1} / {sponsoredProducts.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveSlide((prev) => (prev - 1 + sponsoredProducts.length) % sponsoredProducts.length)
                      }
                      className="h-7 w-7 rounded-full bg-brume hover:bg-seve/15 text-nuit flex items-center justify-center border border-encre/10 transition"
                      aria-label="Produit sponsorisé précédent"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSlide((prev) => (prev + 1) % sponsoredProducts.length)}
                      className="h-7 w-7 rounded-full bg-brume hover:bg-seve/15 text-nuit flex items-center justify-center border border-encre/10 transition"
                      aria-label="Produit sponsorisé suivant"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Active Sponsored Product Slide */}
              {loadingOffers ? (
                <div className="rounded-xl bg-brume/60 border border-encre/10 overflow-hidden animate-pulse">
                  <div className="aspect-[16/10] bg-seve/10" />
                  <div className="p-4 space-y-3">
                    <div className="h-3 w-1/2 bg-encre/10 rounded" />
                    <div className="h-4 w-3/4 bg-encre/10 rounded" />
                    <div className="h-8 w-full bg-encre/10 rounded" />
                  </div>
                </div>
              ) : currentSlide ? (
                <>
                  <div className="rounded-xl bg-brume/40 border border-encre/10 overflow-hidden">
                    <Link
                      to={`/products/${currentSlide.id}`}
                      className="block relative aspect-[16/10] bg-brume overflow-hidden group"
                    >
                      {currentSlide.images?.[0]?.url ? (
                        <img
                          src={currentSlide.images[0].url}
                          alt={currentSlide.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-encre/40 gap-2">
                          <Package className="w-10 h-10" />
                          <span className="text-xs font-mono">Aperçu produit</span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-nuit/55 via-nuit/15 to-transparent" />

                      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full bg-safran text-nuit text-[10px] font-display font-extrabold uppercase tracking-wide shadow-xs flex items-center gap-1">
                          <Megaphone className="w-3 h-3" />
                          <span>{currentSlide.isSponsored ? 'Sponsorisé' : 'À la une'}</span>
                        </span>
                        {currentSlide.store?.isCertified && (
                          <span className="px-2.5 py-1 rounded-full bg-seve text-brume text-[10px] font-display font-bold shadow-xs flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3 text-safran" />
                            <span>Vendeur Certifié</span>
                          </span>
                        )}
                      </div>

                      <span className="absolute bottom-2.5 right-3 text-[10px] font-mono text-brume bg-nuit/80 px-2 py-0.5 rounded border border-white/15">
                        1 USD = {exchangeRate.toLocaleString('fr-FR')} CDF
                      </span>
                    </Link>

                    <div className="p-4 space-y-3 bg-white">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-encre/70">
                        <span className="font-semibold text-nuit flex items-center gap-1.5 truncate">
                          <span>{currentSlide.store?.storeName}</span>
                          {currentSlide.store?.isCertified && (
                            <BadgeCheck className="w-3.5 h-3.5 text-seve shrink-0" />
                          )}
                        </span>
                        <span className="text-seve shrink-0 font-mono font-medium">
                          {currentSlide.store?.city || 'Goma (Nord-Kivu)'}
                        </span>
                      </div>

                      <div>
                        <Link
                          to={`/products/${currentSlide.id}`}
                          className="font-display text-base font-bold text-nuit hover:text-seve transition-colors line-clamp-1"
                        >
                          {currentSlide.title}
                        </Link>
                        <p className="text-[11px] text-encre/70 mt-1 line-clamp-2 leading-relaxed">
                          {currentSlide.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-encre/10 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-display text-xl font-extrabold text-nuit tabular-nums">
                              {formatPrimaryPrice(Number(currentSlide.basePriceUsd))}
                            </span>
                            {currentIsKm && <span className="text-xs text-encre/75 font-semibold">/ km</span>}
                            <span className="text-[10px] font-mono text-encre/55">
                              ({formatSecondaryPrice(Number(currentSlide.basePriceUsd))})
                            </span>
                          </div>
                          {currentBestTier && (
                            <span className="text-[10px] text-seve font-semibold block">
                              Tarif dégressif dès {formatPrimaryPrice(currentBestTier)}
                              {currentIsKm ? ' / km' : ''}
                            </span>
                          )}
                        </div>

                        <Link
                          to={`/products/${currentSlide.id}`}
                          className="rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold px-4 py-2 text-xs transition inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Voir l’offre</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Slide Progress Dots & Thumbnails */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {sponsoredProducts.map((sp, idx) => (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => setActiveSlide(idx)}
                          className={`h-9 w-12 rounded-lg overflow-hidden border transition shrink-0 bg-brume flex items-center justify-center ${
                            idx === activeSlide % sponsoredProducts.length
                              ? 'border-seve ring-2 ring-seve/35 opacity-100'
                              : 'border-encre/15 opacity-60 hover:opacity-95'
                          }`}
                          title={sp.title}
                        >
                          {sp.images?.[0]?.url ? (
                            <img src={sp.images[0].url} alt={sp.title} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-encre/40" />
                          )}
                        </button>
                      ))}
                    </div>

                    <Link
                      to="/vendor"
                      className="text-[11px] font-semibold text-seve hover:underline whitespace-nowrap shrink-0"
                    >
                      Booster ma boutique &rarr;
                    </Link>
                  </div>
                </>
              ) : (
                <div className="rounded-xl bg-brume/60 border border-dashed border-seve/30 p-8 text-center space-y-3">
                  <Megaphone className="w-8 h-8 text-seve mx-auto" />
                  <p className="font-display font-bold text-sm text-nuit">
                    Aucun produit publié en vitrine pour l’instant
                  </p>
                  <p className="text-xs text-encre/65">
                    Les produits publiés par vos boutiques actives (et campagnes publicitaires) défileront automatiquement ici.
                  </p>
                  <Link
                    to="/vendor"
                    className="inline-flex items-center gap-1.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold px-4 py-2 text-xs transition"
                  >
                    <span>Publier ou sponsoriser un produit</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4 Interactive Pillars of ZandoGo */}
      <section className="mx-auto max-w-7xl px-6 py-14 border-b border-encre/10">
        <div className="text-xs font-mono uppercase tracking-wider text-seve mb-2 font-semibold">
          Place de Marché Sans Limites
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-nuit mb-8">
          Conçu pour tous les commerces, entreprises et acheteurs de la RDC
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link
            to="/products?audience=WOMEN"
            className="p-6 rounded-card bg-white border border-encre/10 shadow-xs hover:border-seve/40 hover:-translate-y-0.5 transition block"
          >
            <div className="h-10 w-10 rounded-card bg-seve/10 text-seve flex items-center justify-center mb-4">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-nuit text-sm mb-1.5">Mode Femme/Homme & Électronique</h3>
            <p className="text-xs text-encre/70 leading-relaxed">
              Filtrez par segment (Femme, Homme, Électronique), choisissez taille et couleur, et bénéficiez des tarifs dégressifs par quantité.
            </p>
          </Link>

          <Link
            to="/products?type=DIGITAL"
            className="p-6 rounded-card bg-white border border-encre/10 shadow-xs hover:border-safran/50 hover:-translate-y-0.5 transition block"
          >
            <div className="h-10 w-10 rounded-card bg-safran/20 text-nuit flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-nuit text-sm mb-1.5">Livres PDF Sans Livraison</h3>
            <p className="text-xs text-encre/70 leading-relaxed">
              Aucune adresse ni livreur requis : dès validation de votre paiement Mobile Money ou Carte, recevez directement le lien de téléchargement de votre livre.
            </p>
          </Link>

          <Link
            to="/products?category=cat-6"
            className="p-6 rounded-card bg-white border border-encre/10 shadow-xs hover:border-safran/50 hover:-translate-y-0.5 transition block"
          >
            <div className="h-10 w-10 rounded-card bg-safran/20 text-nuit flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-nuit text-sm mb-1.5">Services & Transport au km</h3>
            <p className="text-xs text-encre/70 leading-relaxed">
              Prestations de transport et course évaluées au kilomètre ($/km) avec estimation d’itinéraire et remise par distance.
            </p>
          </Link>

          <Link
            to="/chat"
            className="p-6 rounded-card bg-white border border-encre/10 shadow-xs hover:border-seve/40 hover:-translate-y-0.5 transition block"
          >
            <div className="h-10 w-10 rounded-card bg-wax/10 text-wax flex items-center justify-center mb-4">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="font-display font-bold text-nuit text-sm mb-1.5">Livraison Négociable & Maps</h3>
            <p className="text-xs text-encre/70 leading-relaxed">
              Partagez votre lien Google Maps au livreur, discutez un prix abordable avant de payer, et suivez les alertes SMS Africa’s Talking.
            </p>
          </Link>
        </div>
      </section>

      {/* Featured Products (Sponsored Priority First) */}
      <section className="mx-auto max-w-7xl px-6 py-14 border-b border-encre/10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-seve mb-1 font-semibold flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5 text-safran" />
              <span>Priorité Publicité Mensuelle & Boutiques Certifiées</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-nuit">
              Offres mises en avant sur ZandoGo
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

        {loadingOffers ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="bg-white rounded-card border border-encre/10 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-encre/5" />
                <div className="p-4 space-y-2.5">
                  <div className="h-3 w-1/2 bg-encre/10 rounded" />
                  <div className="h-4 w-5/6 bg-encre/10 rounded" />
                  <div className="h-3 w-full bg-encre/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : catalogTop.length === 0 ? (
          <div className="p-8 rounded-card bg-white border border-dashed border-encre/20 text-center text-xs text-encre/65">
            Aucun produit actif dans le catalogue pour le moment. Publiez votre premier produit depuis l’Espace Vendeur Pro.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {catalogTop.map((item) => {
              const priceUsd = Number(item.basePriceUsd);
              const bulkPrice =
                item.priceTiers && item.priceTiers.length > 1
                  ? item.priceTiers[item.priceTiers.length - 1].unitPriceUsd
                  : null;
              const isKm = item.pricingUnit === 'KM';

              return (
                <Link
                  key={item.id}
                  to={`/products/${item.id}`}
                  className={`group flex flex-col bg-white rounded-card border overflow-hidden hover:border-seve/40 hover:shadow-md transition ${
                    item.isSponsored ? 'border-safran/50 ring-1 ring-safran/15' : 'border-encre/10'
                  }`}
                >
                  <div className="aspect-[4/3] bg-brume relative overflow-hidden">
                    {item.images?.[0]?.url ? (
                      <img
                        src={item.images[0].url}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-encre/30">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                      {item.isSponsored && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-display font-extrabold uppercase bg-safran text-nuit shadow-xs flex items-center gap-1">
                          <Megaphone className="w-3 h-3" />
                          <span>Sponsorisé</span>
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-sans font-semibold uppercase bg-nuit/90 text-brume shadow-xs">
                        {item.productType === 'DIGITAL' ? 'PDF 0$ livr.' : isKm ? 'Transport / km' : 'Catalogue'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-1">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-encre/60 mb-1">
                        <span className="font-medium text-encre/80 truncate">{item.store?.storeName}</span>
                        <span>· {item.store?.city || 'Goma (Nord-Kivu)'}</span>
                      </div>

                      {item.store?.isCertified && (
                        <div className="mb-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-seve/10 text-seve border border-seve/30 text-[10px] font-display font-bold">
                            <BadgeCheck className="w-3 h-3 text-seve" />
                            <span>Vendeur Certifié</span>
                          </span>
                        </div>
                      )}

                      <h3 className="font-bold text-encre text-xs line-clamp-2 leading-snug group-hover:text-seve transition-colors">
                        {item.title}
                      </h3>

                      <p className="text-[11px] text-encre/60 mt-1.5 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-encre/10">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <span className="font-display text-base font-extrabold tabular-nums text-nuit">
                            {formatPrimaryPrice(priceUsd)}
                            {isKm && <span className="text-[11px] font-medium text-encre/60"> / km</span>}
                          </span>
                          {bulkPrice && (
                            <span className="block text-[10px] font-display text-nuit font-bold tabular-nums bg-safran/20 px-1.5 py-0.5 rounded-md mt-0.5 border border-safran/40">
                              Dès {formatPrimaryPrice(bulkPrice)}
                              {isKm ? ' / km longue distance' : ' avec remise'}
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-encre/50 tabular-nums shrink-0">
                          {formatSecondaryPrice(priceUsd)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* End-to-End Sales to Delivery Process */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="max-w-2xl mb-8">
          <div className="text-xs font-mono uppercase tracking-wider text-seve mb-1 font-semibold">
            Parcours Transparent de A à Z
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-nuit">
            Comment se déroule une vente jusqu’à la livraison ?
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              step: '01',
              icon: Store,
              title: 'Mise en ligne & Certification',
              desc: 'Le vendeur publie son produit avec photo, variantes et paliers de prix. Les vendeurs certifiés (payant) portent le badge officiel et les annonceurs mensuels s’affichent en premier.',
            },
            {
              step: '02',
              icon: MessageSquare,
              title: 'Choix & Négociation',
              desc: 'Le client filtre (Femme, Homme, Électronique, Livres, Transport/km), sélectionne taille/couleur ou km, et peut négocier le prix avec le vendeur.',
            },
            {
              step: '03',
              icon: MapPin,
              title: 'Maps & Tarif Livreur',
              desc: 'Pour un colis physique, le client envoie sa position Google Maps au livreur et discute un prix de course juste avant de payer (0$ pour un livre PDF).',
            },
            {
              step: '04',
              icon: CreditCard,
              title: 'Mobile Money / Carte & Séquestre',
              desc: 'Le client paie via Airtel Money, M-Pesa Vodacom, Orange Money, MTN MoMo ou Carte bancaire. L’argent reste bloqué sur le séquestre ZandoGo et un SMS confirme l’opération.',
            },
            {
              step: '05',
              icon: CheckCircle2,
              title: 'Livraison OTP ou PDF direct',
              desc: 'Le livreur suit le GPS et remet le colis contre code secret OTP (ou le livre PDF est téléchargé instantanément). Le séquestre paie alors le vendeur.',
            },
          ].map((item) => {
            const StepIcon = item.icon;
            return (
              <div key={item.step} className="p-5 rounded-card bg-white border border-encre/10 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-safran bg-nuit px-2 py-0.5 rounded">
                      Étape {item.step}
                    </span>
                    <StepIcon className="w-4 h-4 text-seve" />
                  </div>
                  <h3 className="font-display font-bold text-nuit text-xs mb-1.5">{item.title}</h3>
                  <p className="text-[11px] text-encre/70 leading-relaxed">{item.desc}</p>
                </div>
              </div>
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
              Activez votre certification vendeur et passez en tête de vitrine
            </h2>
            <p className="text-brume/75 text-xs sm:text-sm mt-4 leading-relaxed">
              Souscrivez à la <strong>Certification Vendeur ZandoGo</strong> pour afficher le badge de confiance sur tous vos articles, et activez la <strong>Publicité Mensuelle</strong> pour apparaître dans le carrousel d’accueil et en tête du catalogue.
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
              <span>RÉSEAU MARCHAND ZANDOGO · GOMA (NORD-KIVU)</span>
              <span className="text-seve font-bold">EN SERVICE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brume/60">Publicité Mensuelle :</span>
              <span className="text-safran font-semibold">Carrousel Accueil + Top Catalogue</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brume/60">Certification Vendeur (Payante) :</span>
              <span className="text-seve font-bold">Badge sur 100% des produits</span>
            </div>
            <div className="space-y-2 pt-1">
              <span className="text-brume/60 block">Opérateurs de Paiement & Séquestre :</span>
              <PaymentOperatorStrip compact dark />
            </div>
            <div className="flex justify-between">
              <span className="text-brume/60">Notifications Temps Réel :</span>
              <span className="text-seve tabular-nums">SMS Africa’s Talking</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
