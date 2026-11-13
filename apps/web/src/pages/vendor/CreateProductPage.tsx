import { FormEvent, useEffect, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Package,
  FileText,
  Sparkles,
  ArrowLeft,
  ImagePlus,
  Trash2,
  Plus,
  Palette,
  Layers,
  Route,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';
import { acceptAttribute, validateFile } from '../../lib/upload';
import type { AudienceSegment, PricingUnit, ProductType } from '../../lib/types';

interface Category {
  id: string;
  name: string;
}

interface VariantDraft {
  id: string;
  size: string;
  color: string;
  colorHex: string;
  sku: string;
  stockQty: string;
  priceOverride: string;
}

interface PriceTierDraft {
  id: string;
  minQty: string;
  maxQty: string;
  unitPriceUsd: string;
}

const COLOR_PRESETS = [
  { name: 'Noir Ébène', hex: '#172320' },
  { name: 'Vert Sève', hex: '#26735B' },
  { name: 'Or Safran', hex: '#F2B84B' },
  { name: 'Rouge Wax', hex: '#B84C43' },
  { name: 'Bleu Roi', hex: '#1D4ED8' },
  { name: 'Beige Lin', hex: '#D6C7B2' },
  { name: 'Blanc Pur', hex: '#F8FAFC' },
];

const SIZE_QUICK_PICKS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Standard'];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Impossible de lire « ${file.name} »`));
    reader.readAsDataURL(file);
  });
}

export function CreateProductPage() {
  const { storeId = 'store-1' } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [productType, setProductType] = useState<ProductType>('PHYSICAL');
  const [pricingUnit, setPricingUnit] = useState<PricingUnit>('UNIT');
  const [audience, setAudience] = useState<AudienceSegment>('UNISEX');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [basePriceUsd, setBasePriceUsd] = useState('');
  const [stockQty, setStockQty] = useState('10');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [digitalFileName, setDigitalFileName] = useState('');
  const [digitalFileSize, setDigitalFileSize] = useState('15 Mo');
  const [serviceDuration, setServiceDuration] = useState('');
  const [fulfillmentDetails, setFulfillmentDetails] = useState('');

  const [uploadedImages, setUploadedImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const [variants, setVariants] = useState<VariantDraft[]>([
    { id: 'v-1', size: 'M', color: 'Vert Sève', colorHex: '#26735B', sku: '', stockQty: '10', priceOverride: '' },
  ]);

  const [priceTiers, setPriceTiers] = useState<PriceTierDraft[]>([
    { id: 't-1', minQty: '1', maxQty: '4', unitPriceUsd: '' },
    { id: 't-2', minQty: '5', maxQty: '19', unitPriceUsd: '' },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Category[]>('/categories').then(({ data }) => {
      setCategories(data || []);
      if (data && data[0]) setCategoryId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (productType === 'PHYSICAL' || productType === 'DIGITAL') {
      setPricingUnit('UNIT');
    } else if (productType === 'SERVICE' && pricingUnit === 'UNIT') {
      setPricingUnit('KM');
    }
  }, [productType, pricingUnit]);

  async function handleImageSelect(e: ChangeEvent<HTMLInputElement>) {
    setImageUploadError(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validUrls: { name: string; dataUrl: string }[] = [];
    for (const file of files) {
      const validationMsg = validateFile(file, 'PRODUCT_IMAGE');
      if (validationMsg) {
        setImageUploadError(validationMsg);
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        validUrls.push({ name: file.name, dataUrl });
      } catch (err: any) {
        setImageUploadError(err?.message || 'Erreur lors du chargement de la photo.');
      }
    }

    if (validUrls.length > 0) {
      setUploadedImages((prev) => [...prev, ...validUrls].slice(0, 6));
    }
    e.target.value = '';
  }

  function removeUploadedImage(index: number) {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }

  function addVariant() {
    setVariants((prev) => [
      ...prev,
      {
        id: `v-${Date.now()}-${prev.length}`,
        size: 'L',
        color: 'Noir Ébène',
        colorHex: '#172320',
        sku: '',
        stockQty: '10',
        priceOverride: basePriceUsd,
      },
    ]);
  }

  function updateVariant(id: string, patch: Partial<VariantDraft>) {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  function removeVariant(id: string) {
    setVariants((prev) => (prev.length > 1 ? prev.filter((v) => v.id !== id) : prev));
  }

  function addPriceTier() {
    const lastMax = Number(priceTiers[priceTiers.length - 1]?.maxQty || 10);
    setPriceTiers((prev) => [
      ...prev,
      {
        id: `t-${Date.now()}-${prev.length}`,
        minQty: String(lastMax + 1),
        maxQty: '',
        unitPriceUsd: '',
      },
    ]);
  }

  function updatePriceTier(id: string, patch: Partial<PriceTierDraft>) {
    setPriceTiers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removePriceTier(id: string) {
    setPriceTiers((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (uploadedImages.length === 0) {
      setError('Veuillez ajouter au moins une photo réelle du produit/service pour le catalogue ZandoGo.');
      return;
    }

    setLoading(true);
    try {
      const slug =
        title
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') +
        '-' +
        Math.random().toString(36).slice(2, 6);

      const parsedPrice = Number(basePriceUsd);
      const formattedVariants =
        productType === 'PHYSICAL'
          ? variants.map((v) => ({
              size: v.size.trim() || undefined,
              color: v.color.trim() || undefined,
              colorHex: v.colorHex || undefined,
              sku: v.sku.trim() || undefined,
              stockQty: Number(v.stockQty || stockQty || 0),
              priceOverride: Number(v.priceOverride || parsedPrice),
            }))
          : [
              {
                name:
                  productType === 'DIGITAL'
                    ? 'Téléchargement PDF Immédiat'
                    : pricingUnit === 'KM'
                    ? 'Prestation facturée au kilomètre'
                    : 'Forfait Standard',
                stockQty: 9999,
                priceOverride: parsedPrice,
              },
            ];

      const validTiers = priceTiers
        .filter((t) => Number(t.minQty) >= 1 && Number(t.unitPriceUsd) > 0)
        .map((t) => ({
          minQty: Number(t.minQty),
          maxQty: t.maxQty.trim() ? Number(t.maxQty) : null,
          unitPriceUsd: Number(t.unitPriceUsd),
        }))
        .sort((a, b) => a.minQty - b.minQty);

      await api.post(`/vendors/stores/${storeId}/products`, {
        title,
        slug,
        description,
        categoryId,
        productType,
        pricingUnit,
        audience,
        basePriceUsd: parsedPrice,
        stockQty: productType === 'PHYSICAL' ? Number(stockQty) : 9999,
        lowStockThreshold: Number(lowStockThreshold),
        images: uploadedImages.map((img) => img.dataUrl),
        variants: formattedVariants,
        priceTiers: validTiers.length > 0 ? validTiers : undefined,
        digitalFileName: productType === 'DIGITAL' ? digitalFileName : undefined,
        digitalFileSize: productType === 'DIGITAL' ? digitalFileSize : undefined,
        serviceDuration: productType === 'SERVICE' ? serviceDuration : undefined,
        fulfillmentDetails: productType === 'SERVICE' ? fulfillmentDetails : undefined,
      });

      navigate(`/vendor/${storeId}/products`);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Impossible de créer l’offre.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <VendorLayout storeId={storeId}>
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-2">
          <Link
            to={`/vendor/${storeId}/products`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-encre/60 hover:text-nuit"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Revenir au catalogue de la boutique</span>
          </Link>
        </div>

        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-nuit tracking-tight">
            Publier une Offre au Catalogue ZandoGo
          </h1>
          <p className="mt-1 text-xs text-encre/70">
            Téléversez les photos réelles du catalogue, définissez le public ciblé (Femme, Homme, Électronique, Pro), la facturation au kilomètre pour le transport, les variantes (tailles & couleurs) et les paliers de prix par quantité.
          </p>
        </div>

        {/* Offering Type Selector */}
        <div className="p-1.5 bg-encre/10 rounded-card flex flex-wrap gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setProductType('PHYSICAL')}
            className={`flex-1 py-2.5 px-4 rounded-card transition flex items-center justify-center gap-2 ${
              productType === 'PHYSICAL'
                ? 'bg-white text-nuit shadow-xs font-display font-bold'
                : 'text-encre/70 hover:text-nuit'
            }`}
          >
            <Package className="w-4 h-4 text-seve" />
            <span>Bien Physique (Tailles / Couleurs / Stock)</span>
          </button>
          <button
            type="button"
            onClick={() => setProductType('DIGITAL')}
            className={`flex-1 py-2.5 px-4 rounded-card transition flex items-center justify-center gap-2 ${
              productType === 'DIGITAL'
                ? 'bg-white text-nuit shadow-xs font-display font-bold'
                : 'text-encre/70 hover:text-nuit'
            }`}
          >
            <FileText className="w-4 h-4 text-seve" />
            <span>Livre / Document PDF (0$ livraison)</span>
          </button>
          <button
            type="button"
            onClick={() => setProductType('SERVICE')}
            className={`flex-1 py-2.5 px-4 rounded-card transition flex items-center justify-center gap-2 ${
              productType === 'SERVICE'
                ? 'bg-white text-nuit shadow-xs font-display font-bold'
                : 'text-encre/70 hover:text-nuit'
            }`}
          >
            <Sparkles className="w-4 h-4 text-safran" />
            <span>Service / Transport (au km ou forfait)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-encre/10 rounded-card p-6 shadow-xs space-y-6">
          {/* Mandatory Catalog Photo Upload */}
          <div className="p-4 rounded-card bg-brume/60 border border-dashed border-seve/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-display font-bold uppercase tracking-wider text-nuit">
                  Photos réelles du catalogue * (obligatoire)
                </label>
                <p className="text-[11px] text-encre/65">
                  Formats acceptés : JPEG, PNG ou WebP (max 5 Mo par image, jusqu’à 6 photos).
                </p>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-card bg-seve hover:bg-seve/90 text-brume px-4 py-2 text-xs font-display font-bold transition shadow-xs">
                <ImagePlus className="w-4 h-4" />
                <span>Importer une photo</span>
                <input
                  type="file"
                  accept={acceptAttribute('PRODUCT_IMAGE')}
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            </div>

            {imageUploadError && <p className="text-xs text-wax font-semibold">{imageUploadError}</p>}

            {uploadedImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {uploadedImages.map((img, idx) => (
                  <div key={`${img.name}-${idx}`} className="relative group rounded-card overflow-hidden border border-encre/15 bg-white aspect-[4/3]">
                    <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-nuit/85 text-safran text-[10px] font-bold">
                        Photo principale
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeUploadedImage(idx)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-wax text-brume opacity-90 hover:opacity-100 shadow-xs"
                      title="Retirer cette photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-[11px] text-encre/55">
                Aucune photo sélectionnée pour l’instant. La première photo servira de vignette principale sur la place de marché.
              </div>
            )}
          </div>

          {/* Title + Audience */}
          <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-4">
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
                Titre commercial de l’offre *
              </label>
              <input
                required
                minLength={3}
                placeholder={
                  productType === 'SERVICE'
                    ? 'ex: Transport Utilitaire & Fret Express Kinshasa (par km)'
                    : productType === 'DIGITAL'
                    ? 'ex: Manuel Comptable & Fiscal OHADA RDC (PDF)'
                    : 'ex: Robe Portefeuille Wax Chic ou Chemise Lin Homme'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs text-encre outline-none focus:border-seve"
              />
            </div>

            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
                Public / Segment de filtre *
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as AudienceSegment)}
                className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs font-semibold text-encre outline-none focus:border-seve"
              >
                <option value="WOMEN">Femme (Habits & Accessoires Femme)</option>
                <option value="MEN">Homme (Habits & Mode Homme)</option>
                <option value="UNISEX">Mixte / Unisexe / Grand Public</option>
                <option value="PRO">Pro / Entreprises / Transport & Services</option>
              </select>
            </div>
          </div>

          {/* Category + Base Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
                Catégorie du catalogue *
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs font-medium text-encre outline-none focus:border-seve"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
                {productType === 'SERVICE' && pricingUnit === 'KM'
                  ? 'Tarif de base par kilomètre ($ USD / km) *'
                  : productType === 'SERVICE' && pricingUnit === 'HOUR'
                  ? 'Tarif horaire ($ USD / heure) *'
                  : 'Prix unitaire de base ($ USD) *'}
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0.2"
                placeholder={pricingUnit === 'KM' ? 'ex: 1.50' : 'ex: 45.00'}
                value={basePriceUsd}
                onChange={(e) => setBasePriceUsd(e.target.value)}
                className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs font-display font-bold text-nuit outline-none focus:border-seve"
              />
            </div>
          </div>

          {/* Contextual Fields: Physical Inventory + Sizes & Colors Variants */}
          {productType === 'PHYSICAL' && (
            <div className="space-y-4">
              <div className="p-4 rounded-card bg-brume/60 border border-encre/10 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs font-display font-bold text-nuit uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-seve" />
                    <span>Variantes : Tailles, Couleurs, Stock & Prix spécifiques</span>
                  </h3>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-card bg-nuit text-brume text-[11px] font-display font-bold hover:bg-nuit/90 transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-safran" />
                    <span>Ajouter une variante</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {variants.map((v, idx) => (
                    <div key={v.id} className="p-3 rounded-card bg-white border border-encre/10 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-bold text-nuit">
                        <span>Variante #{idx + 1}</span>
                        {variants.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeVariant(v.id)}
                            className="text-wax hover:underline flex items-center gap-1 font-semibold"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Supprimer</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold uppercase text-encre/60 mb-1">
                            Taille / Capacité
                          </label>
                          <input
                            type="text"
                            value={v.size}
                            onChange={(e) => updateVariant(v.id, { size: e.target.value })}
                            placeholder="ex: M, 42, 256 Go"
                            className="w-full rounded-card border border-encre/20 px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                          />
                          <div className="flex flex-wrap gap-1 mt-1">
                            {SIZE_QUICK_PICKS.map((sz) => (
                              <button
                                key={sz}
                                type="button"
                                onClick={() => updateVariant(v.id, { size: sz })}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                  v.size === sz
                                    ? 'bg-nuit text-safran border-nuit'
                                    : 'bg-brume text-encre/70 border-encre/15'
                                }`}
                              >
                                {sz}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase text-encre/60 mb-1">
                            Couleur
                          </label>
                          <input
                            type="text"
                            value={v.color}
                            onChange={(e) => updateVariant(v.id, { color: e.target.value })}
                            placeholder="ex: Vert Sève"
                            className="w-full rounded-card border border-encre/20 px-2.5 py-1.5 text-xs outline-none focus:border-seve"
                          />
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {COLOR_PRESETS.map((cp) => (
                              <button
                                key={cp.hex}
                                type="button"
                                title={cp.name}
                                onClick={() => updateVariant(v.id, { color: cp.name, colorHex: cp.hex })}
                                className={`w-4 h-4 rounded-full border ${
                                  v.colorHex === cp.hex ? 'ring-2 ring-seve ring-offset-1 border-nuit' : 'border-encre/25'
                                }`}
                                style={{ backgroundColor: cp.hex }}
                              />
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase text-encre/60 mb-1">
                            Code SKU (optionnel)
                          </label>
                          <input
                            type="text"
                            value={v.sku}
                            onChange={(e) => updateVariant(v.id, { sku: e.target.value })}
                            placeholder="ex: ROB-WAX-M"
                            className="w-full rounded-card border border-encre/20 px-2.5 py-1.5 text-xs font-mono outline-none focus:border-seve"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase text-encre/60 mb-1">
                            Stock disponible *
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={v.stockQty}
                            onChange={(e) => updateVariant(v.id, { stockQty: e.target.value })}
                            className="w-full rounded-card border border-encre/20 px-2.5 py-1.5 text-xs font-display font-bold outline-none focus:border-seve"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-semibold uppercase text-encre/60 mb-1">
                            Prix variante ($ USD)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min={0.2}
                            value={v.priceOverride}
                            onChange={(e) => updateVariant(v.id, { priceOverride: e.target.value })}
                            placeholder={basePriceUsd || 'Prix de base'}
                            className="w-full rounded-card border border-encre/20 px-2.5 py-1.5 text-xs font-display font-bold text-seve outline-none focus:border-seve"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-encre/10">
                  <div>
                    <label className="block text-xs font-semibold text-encre/80 mb-1">
                      Stock global par défaut (si variante unique)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={stockQty}
                      onChange={(e) => setStockQty(e.target.value)}
                      className="w-full rounded-card border border-encre/20 bg-white px-3.5 py-2 text-xs font-display font-bold text-nuit outline-none focus:border-seve"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-encre/80 mb-1">
                      Seuil d’alerte stock critique
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      className="w-full rounded-card border border-encre/20 bg-white px-3.5 py-2 text-xs font-display outline-none focus:border-seve"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Contextual Fields: Digital PDF */}
          {productType === 'DIGITAL' && (
            <div className="p-4 rounded-card bg-seve/5 border border-seve/20 space-y-4">
              <div>
                <h3 className="text-xs font-display font-bold text-nuit uppercase tracking-wider">
                  Livre ou Document Numérique Téléchargeable (Livraison automatique 0$)
                </h3>
                <p className="text-[11px] text-encre/70 mt-0.5">
                  Dès la confirmation du paiement via MaishaPay, l’acheteur reçoit immédiatement son lien de téléchargement sécurisé sans adresse physique ni livreur.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-encre/80 mb-1">
                    Nom du fichier PDF *
                  </label>
                  <input
                    type="text"
                    placeholder="guide-investissement-rdc-2026.pdf"
                    value={digitalFileName}
                    onChange={(e) => setDigitalFileName(e.target.value)}
                    className="w-full rounded-card border border-encre/20 bg-white px-3.5 py-2 text-xs outline-none focus:border-seve"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-encre/80 mb-1">
                    Taille indicative (Mo)
                  </label>
                  <input
                    type="text"
                    value={digitalFileSize}
                    onChange={(e) => setDigitalFileSize(e.target.value)}
                    className="w-full rounded-card border border-encre/20 bg-white px-3.5 py-2 text-xs outline-none focus:border-seve"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Contextual Fields: Service / Transport per KM */}
          {productType === 'SERVICE' && (
            <div className="p-4 rounded-card bg-safran/15 border border-safran/40 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-display font-bold text-nuit uppercase tracking-wider flex items-center gap-1.5">
                  <Route className="w-4 h-4 text-seve" />
                  <span>Facturation & Conditions de Prestation (Transport au km ou Forfait)</span>
                </h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-encre/80 mb-1.5">
                  Unité de tarification du service *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPricingUnit('KM')}
                    className={`p-2.5 rounded-card border text-left text-xs transition ${
                      pricingUnit === 'KM'
                        ? 'bg-nuit text-brume border-nuit font-bold'
                        : 'bg-white text-encre border-encre/15 hover:border-seve'
                    }`}
                  >
                    <span className="block">Au kilomètre ($/km)</span>
                    <span className="text-[10px] opacity-75">Idéal transport, taxi-fret, coursier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingUnit('FLAT')}
                    className={`p-2.5 rounded-card border text-left text-xs transition ${
                      pricingUnit === 'FLAT'
                        ? 'bg-nuit text-brume border-nuit font-bold'
                        : 'bg-white text-encre border-encre/15 hover:border-seve'
                    }`}
                  >
                    <span className="block">Forfait mensuel / fixe</span>
                    <span className="text-[10px] opacity-75">Télécoms, fibre, audit, installation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingUnit('HOUR')}
                    className={`p-2.5 rounded-card border text-left text-xs transition ${
                      pricingUnit === 'HOUR'
                        ? 'bg-nuit text-brume border-nuit font-bold'
                        : 'bg-white text-encre border-encre/15 hover:border-seve'
                    }`}
                  >
                    <span className="block">Tarif horaire ($/h)</span>
                    <span className="text-[10px] opacity-75">Maintenance, dépannage, formation</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-encre/80 mb-1">
                    Zone / Durée ou délai d’intervention
                  </label>
                  <input
                    type="text"
                    placeholder={pricingUnit === 'KM' ? 'ex: Grand Kinshasa (Gombe ↔ N’Djili)' : 'ex: Intervention sous 24h'}
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(e.target.value)}
                    className="w-full rounded-card border border-encre/20 bg-white px-3.5 py-2 text-xs outline-none focus:border-seve"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-encre/80 mb-1">
                    Modalités de prise de contact & suivi GPS
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Partage Google Maps client + confirmation SMS"
                    value={fulfillmentDetails}
                    onChange={(e) => setFulfillmentDetails(e.target.value)}
                    className="w-full rounded-card border border-encre/20 bg-white px-3.5 py-2 text-xs outline-none focus:border-seve"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Price Tiers by Quantity / Distance */}
          <div className="p-4 rounded-card bg-brume/40 border border-encre/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-display font-bold text-nuit uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-seve" />
                  <span>
                    {pricingUnit === 'KM'
                      ? 'Grille tarifaire dégressive par tranche de kilomètres'
                      : 'Tarifs dégressifs selon la quantité commandée'}
                  </span>
                </h3>
                <p className="text-[11px] text-encre/60">
                  Optionnel : proposez automatiquement un prix réduit dès un certain volume ou distance.
                </p>
              </div>
              <button
                type="button"
                onClick={addPriceTier}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-card border border-seve text-seve text-[11px] font-display font-bold hover:bg-seve/10 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter un palier</span>
              </button>
            </div>

            <div className="space-y-2">
              {priceTiers.map((tier) => (
                <div key={tier.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center bg-white p-2.5 rounded-card border border-encre/10">
                  <div>
                    <label className="block text-[10px] uppercase text-encre/60 font-semibold mb-0.5">
                      {pricingUnit === 'KM' ? 'Km min' : 'Qté min'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={tier.minQty}
                      onChange={(e) => updatePriceTier(tier.id, { minQty: e.target.value })}
                      className="w-full rounded border border-encre/20 px-2.5 py-1 text-xs font-mono outline-none focus:border-seve"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-encre/60 font-semibold mb-0.5">
                      {pricingUnit === 'KM' ? 'Km max (vide = +)' : 'Qté max (vide = +)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      placeholder="Illimité"
                      value={tier.maxQty}
                      onChange={(e) => updatePriceTier(tier.id, { maxQty: e.target.value })}
                      className="w-full rounded border border-encre/20 px-2.5 py-1 text-xs font-mono outline-none focus:border-seve"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-encre/60 font-semibold mb-0.5">
                      {pricingUnit === 'KM' ? 'Tarif $ / km' : 'Prix unitaire $'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0.1}
                      placeholder={basePriceUsd || 'ex: 40.00'}
                      value={tier.unitPriceUsd}
                      onChange={(e) => updatePriceTier(tier.id, { unitPriceUsd: e.target.value })}
                      className="w-full rounded border border-encre/20 px-2.5 py-1 text-xs font-display font-bold text-seve outline-none focus:border-seve"
                    />
                  </div>
                  <div className="flex justify-end pt-3 sm:pt-0">
                    <button
                      type="button"
                      onClick={() => removePriceTier(tier.id)}
                      className="text-xs text-wax hover:underline inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Retirer</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-display font-semibold uppercase tracking-wider text-encre/70 mb-1.5">
              Description détaillée de l'offre
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails techniques, matières, tailles disponibles, conditions de transport ou de téléchargement en RDC..."
              className="w-full rounded-card border border-encre/20 bg-brume/30 px-4 py-2.5 text-xs text-encre outline-none focus:border-seve"
            />
          </div>

          {error && <p className="text-xs text-wax font-semibold bg-wax/10 border border-wax/20 rounded-card px-3.5 py-2.5">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold py-3.5 text-xs transition shadow-xs disabled:opacity-50"
          >
            {loading ? 'Publication en cours…' : 'Publier l’offre sur la place de marché ZandoGo'}
          </button>
        </form>
      </div>
    </VendorLayout>
  );
}
