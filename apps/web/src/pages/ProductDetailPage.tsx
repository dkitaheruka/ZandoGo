import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Package,
  Handshake,
  MessageSquare,
  Check,
  FileText,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { Product } from '../lib/types';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'adding' | 'added' | 'error'>('idle');
  const [contactError, setContactError] = useState<string | null>(null);

  // Negotiation & Transport Discussion State
  const [negotiationOpen, setNegotiationOpen] = useState(false);
  const [targetPrice, setTargetPrice] = useState<number>(0);
  const [targetQty, setTargetQty] = useState<number>(1);
  const [targetCity, setTargetCity] = useState('Kinshasa');
  const [targetTransportMode, setTargetTransportMode] = useState('Coursier Express Ville (Rapide)');
  const [targetDeliveryFee, setTargetDeliveryFee] = useState<number>(3.5);
  const [negotiationNote, setNegotiationNote] = useState('');
  const [negotiationSubmitting, setNegotiationSubmitting] = useState(false);
  const [negotiationSuccess, setNegotiationSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<Product>(`/products/${id}`).then(({ data }) => {
      setProduct(data);
      setVariantId(data.variants[0]?.id ?? '');
      const base = Number(data.basePriceUsd);
      setTargetPrice(base); // Default to current unit price
      setTargetQty(1);
    });
  }, [id]);

  if (!product) {
    return <div className="mx-auto max-w-7xl px-6 py-20 text-slate-400 font-mono text-xs">Chargement de l’offre…</div>;
  }

  const selectedVariant = product.variants.find((v) => v.id === variantId) || product.variants[0];

  // Dynamic Volume Tiered Pricing Calculation (like Alibaba)
  let activeUnitPrice = Number(selectedVariant?.priceOverride ?? product.basePriceUsd);
  if (product.priceTiers && product.priceTiers.length > 0) {
    const matchedTier = product.priceTiers
      .slice()
      .reverse()
      .find((t) => quantity >= t.minQty && (t.maxQty === null || t.maxQty === undefined || quantity <= t.maxQty));
    if (matchedTier) {
      activeUnitPrice = matchedTier.unitPriceUsd;
    }
  }

  const priceCdf = Math.round(activeUnitPrice * 2850);
  const isPhysical = product.productType === 'PHYSICAL';
  const isDigital = product.productType === 'DIGITAL';
  const isService = product.productType === 'SERVICE';
  const stockAvailable = selectedVariant?.stockQty ?? product.stockQty ?? 0;
  const outOfStock = isPhysical && stockAvailable <= 0;
  const isLowStock = isPhysical && stockAvailable > 0 && stockAvailable <= (product.lowStockThreshold || 5);

  async function handleAddToCart() {
    if (!user) {
      navigate('/login');
      return;
    }
    setStatus('adding');
    try {
      await api.post('/cart/items', { productVariantId: variantId, quantity });
      setStatus('added');
    } catch {
      setStatus('error');
    }
  }

  async function handleSendNegotiation(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    setNegotiationSubmitting(true);
    setNegotiationSuccess(null);
    try {
      await api.post('/negotiations', {
        productId: product?.id,
        productTitle: product?.title,
        productImage: product?.images[0]?.url,
        storeId: product?.store?.id || 'store-1',
        storeName: product?.store?.storeName,
        requestedQty: targetQty,
        requestedPriceUsd: targetPrice,
        transportMode: targetTransportMode,
        requestedDeliveryFeeUsd: targetDeliveryFee,
        currency: 'USD',
        notes: negotiationNote,
        destinationCity: targetCity,
      });
      setNegotiationSuccess(
        `Proposition envoyée ! $${targetPrice}/unité (${targetQty} pcs) avec transport "${targetTransportMode}" à $${targetDeliveryFee} pour ${targetCity}. Redirection vers la messagerie…`,
      );
      setTimeout(() => {
        setNegotiationOpen(false);
        setNegotiationSuccess(null);
        navigate('/chat');
      }, 2000);
    } catch {
      setNegotiationSuccess('Erreur lors de l’envoi de la négociation.');
    } finally {
      setNegotiationSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mb-6 font-medium">
        <Link to="/" className="hover:text-slate-900">Accueil</Link>
        <span>/</span>
        <Link to="/products" className="hover:text-slate-900">Catalogue ZandoGo</Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold truncate max-w-sm">{product.title}</span>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-start">
        {/* Left: Product Media Gallery */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-xs relative">
            <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center overflow-hidden">
              {product.images[0] ? (
                <img
                  src={product.images[0].url}
                  alt={product.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="w-16 h-16 text-slate-300" />
              )}
            </div>

            {/* Product Type Badge */}
            <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
              {isPhysical && (
                <>
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Bien matériel avec stock</span>
                </>
              )}
              {isDigital && (
                <>
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Téléchargement PDF instantané</span>
                </>
              )}
              {isService && (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Prestation de service & réseau</span>
                </>
              )}
            </div>
          </div>

          {/* Guarantee & Escrow Card (Noir + Vert + Cyan) */}
          <div className="rounded-2xl border border-slate-200 bg-[#0B0F19] text-white p-4 text-xs space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Protection Séquestre ZandoGo 100%</span>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                Garantie RDC
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Fonds bloqués sous séquestre sécurisé. Le vendeur n’est crédité qu’après confirmation de livraison et d'inspection conforme de votre part.
            </p>
          </div>
        </div>

        {/* Right: Pricing, Tiers, Vendor & Purchase Module */}
        <div className="space-y-6">
          {/* Supplier Lockup */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{product.store.storeName}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold text-[10px]">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Fournisseur Agréé</span>
              </span>
              <span className="text-slate-400">· {product.store.city || 'Kinshasa (RDC)'}</span>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!user) {
                  navigate('/login');
                  return;
                }
                try {
                  const { data } = await api.post<{ id: string }>('/chat/conversations', {
                    type: 'CUSTOMER_VENDOR',
                    otherUserId: product.store!.ownerId || 'usr-1',
                  });
                  navigate('/chat', { state: { conversationId: data.id } });
                } catch {
                  setContactError('Impossible d’ouvrir le chat.');
                }
              }}
              className="inline-flex items-center gap-1 text-slate-700 hover:text-emerald-700 font-semibold text-xs transition"
            >
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Contacter le vendeur</span>
            </button>
          </div>
          {contactError && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg">
              {contactError}
            </p>
          )}

          {/* Title */}
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">
            {product.title}
          </h1>

          {/* Tiered Bulk Pricing Table with Cyan active highlights */}
          {product.priceTiers && product.priceTiers.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
                  Tarifs selon quantité (Vente au détail & prix groupés)
                </span>
                <span className="text-[11px] font-mono text-cyan-700 font-semibold bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                  Prix dynamique appliqué
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {product.priceTiers.map((tier, idx) => {
                  const isActive =
                    quantity >= tier.minQty &&
                    (tier.maxQty === null || tier.maxQty === undefined || quantity <= tier.maxQty);
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition ${
                        isActive
                          ? 'border-cyan-500 bg-cyan-50/70 shadow-xs ring-1 ring-cyan-400/50'
                          : 'border-slate-100 bg-slate-50/50'
                      }`}
                    >
                      <p className="text-[11px] font-mono text-slate-500">
                        {tier.maxQty ? `${tier.minQty} - ${tier.maxQty} pcs` : `${tier.minQty}+ pcs`}
                      </p>
                      <p className="text-base font-bold font-mono text-slate-900 mt-1 tabular-nums">
                        ${tier.unitPriceUsd.toFixed(2)}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                        {tier.unitPriceCdf.toLocaleString('fr-FR')} CDF
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-baseline gap-3">
              <span className="font-mono text-3xl font-extrabold text-slate-900 tabular-nums">
                ${activeUnitPrice.toFixed(2)}
              </span>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                ({priceCdf.toLocaleString('fr-FR')} CDF)
              </span>
            </div>
          )}

          {/* Offering Meta Modules */}
          {isDigital && (
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs">
              <p className="font-semibold text-indigo-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Téléchargement Numérique Garanti</span>
              </p>
              <p className="text-indigo-800 mt-1 leading-relaxed">
                Fichier PDF ({product.digitalFileSize || '18 Mo'}). Dès validation du paiement, le lien de téléchargement s’active instantanément dans votre espace commandes.
              </p>
            </div>
          )}

          {isService && (
            <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 text-xs">
              <p className="font-semibold text-sky-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-sky-600" />
                <span>Prestation & Mise en Service</span>
              </p>
              <p className="text-sky-800 mt-1 leading-relaxed">
                {product.serviceDuration || 'Intervention sous 24h'}. {product.fulfillmentDetails || 'Prise de contact téléphonique du technicien dans les 2 heures.'}
              </p>
            </div>
          )}

          {isPhysical && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600 font-medium">Stock entrepôt :</span>
              {outOfStock ? (
                <span className="font-semibold text-rose-600">Rupture de stock temporaire</span>
              ) : isLowStock ? (
                <span className="font-semibold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md font-mono tabular-nums">
                  Dernières {stockAvailable} unités en stock
                </span>
              ) : (
                <span className="font-semibold text-emerald-700 font-mono tabular-nums">
                  {stockAvailable} unités disponibles immédiatement
                </span>
              )}
            </div>
          )}

          {product.description && (
            <p className="text-xs text-slate-600 leading-relaxed pt-2">
              {product.description}
            </p>
          )}

          {/* Variants Selector */}
          {product.variants.length > 1 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Modèle / Option
              </label>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
                      variantId === v.id
                        ? 'border-slate-900 bg-slate-900 text-white font-semibold shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {v.name || v.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector + Total */}
          {isPhysical && (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <label htmlFor="qty-input" className="text-xs font-semibold text-slate-700">
                  Quantité commandée :
                </label>
                <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs"
                  >
                    -
                  </button>
                  <input
                    id="qty-input"
                    type="number"
                    min={1}
                    max={stockAvailable || 999}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-12 text-center text-xs font-mono font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 font-bold text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-mono">Sous-total estimé</span>
                <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                  ${(activeUnitPrice * quantity).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Primary Action Buttons: Add to Cart + Price & Transport Negotiation */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row gap-3">
              {outOfStock ? (
                <button
                  disabled
                  className="w-full rounded-xl bg-slate-200 text-slate-500 font-medium py-3.5 text-xs cursor-not-allowed"
                >
                  Article temporairement épuisé
                </button>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={status === 'adding'}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 text-xs transition shadow-xs flex items-center justify-center gap-2"
                >
                  {status === 'adding' ? (
                    <span>Ajout au panier…</span>
                  ) : status === 'added' ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Ajouté au panier !</span>
                    </>
                  ) : (
                    <>
                      <Package className="w-4 h-4 text-white" />
                      <span>{isDigital ? 'Acheter & Télécharger' : isService ? 'Commander la prestation' : 'Ajouter au panier'}</span>
                    </>
                  )}
                </button>
              )}

              {/* Discussion & Negotiation Button (Noir + Cyan) */}
              <button
                type="button"
                onClick={() => setNegotiationOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#0B0F19] hover:bg-slate-900 text-cyan-300 hover:text-cyan-200 border-2 border-cyan-500/40 hover:border-cyan-400 font-bold text-xs transition shadow-xs"
              >
                <Handshake className="w-4 h-4 text-cyan-400" />
                <span>Discuter & Négocier (Prix & Transport)</span>
              </button>
            </div>

            {status === 'added' && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <span className="text-emerald-800 font-medium">Article ajouté avec succès.</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => navigate('/cart')} className="font-semibold text-emerald-900 underline">
                    Voir panier &rarr;
                  </button>
                  <button onClick={() => navigate('/checkout')} className="font-semibold text-cyan-800 underline">
                    Paiement &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Discussion & Negotiation Modal (Noir + Cyan + Vert) */}
      {negotiationOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setNegotiationOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 uppercase tracking-wider mb-2">
              <span className="px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 flex items-center gap-1.5 font-bold text-[10px]">
                <Handshake className="w-3.5 h-3.5 text-cyan-600" />
                <span>Négociation Directe Produit & Transport</span>
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 font-display">
              Discuter avec {product.store.storeName}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Concluez un accord sur-mesure sur le prix de l’article et le mode d’expédition selon vos besoins.
            </p>

            {negotiationSuccess && (
              <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{negotiationSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSendNegotiation} className="mt-5 space-y-4 text-xs">
              {/* Product Price Negotiation Section */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Offre sur le Produit</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    Prix catalogue : ${activeUnitPrice.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Quantité (pièces)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={targetQty}
                      onChange={(e) => setTargetQty(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Prix unitaire proposé ($ USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-mono text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.5"
                        min={1}
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(Number(e.target.value))}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Transport & Delivery Negotiation Section */}
              <div className="p-3.5 rounded-2xl bg-cyan-50/50 border border-cyan-200/80 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Négociation du Transport / Expédition</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded">
                    Toute la RDC
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Ville de destination
                    </label>
                    <select
                      value={targetCity}
                      onChange={(e) => setTargetCity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-xs outline-none bg-white focus:border-cyan-500"
                    >
                      <option value="Kinshasa">Kinshasa</option>
                      <option value="Lubumbashi (Haut-Katanga)">Lubumbashi</option>
                      <option value="Goma (Nord-Kivu)">Goma</option>
                      <option value="Kisangani (Tshopo)">Kisangani</option>
                      <option value="Matadi (Kongo-Central)">Matadi</option>
                      <option value="Bukavu (Sud-Kivu)">Bukavu</option>
                      <option value="Kolwezi (Lualaba)">Kolwezi</option>
                      <option value="Kananga (Kasaï-Central)">Kananga</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Frais transport proposés ($ USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-mono text-slate-400 font-bold">$</span>
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        value={targetDeliveryFee}
                        onChange={(e) => setTargetDeliveryFee(Math.max(0, Number(e.target.value)))}
                        className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-xs outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mode d'acheminement souhaité
                  </label>
                  <select
                    value={targetTransportMode}
                    onChange={(e) => setTargetTransportMode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium text-xs outline-none bg-white focus:border-cyan-500"
                  >
                    <option value="Coursier Express Ville (Rapide)">Coursier Express Ville (Moto/Voiture)</option>
                    <option value="Retrait direct en boutique (Gratuit)">Retrait direct en boutique ($0.00)</option>
                    <option value="Bus / Agence Interurbaine (Fret provincial)">Bus / Agence Interurbaine (Fret inter-provinces)</option>
                    <option value="Transporteur Fret Fluvial / Cargo">Fret Aérien / Fluvial Fleuve Congo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Message ou conditions au vendeur
                </label>
                <textarea
                  rows={2}
                  value={negotiationNote}
                  onChange={(e) => setNegotiationNote(e.target.value)}
                  placeholder="Ex : Besoin urgent pour ce vendredi à Gombe, paiement cash à la livraison ou Mobile Money..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNegotiationOpen(false)}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 font-medium text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={negotiationSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs disabled:opacity-50 flex items-center gap-2"
                >
                  <Handshake className="w-4 h-4 text-cyan-200" />
                  <span>{negotiationSubmitting ? 'Transmission…' : 'Transmettre l’offre & Ouvrir le chat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
