import { useEffect, useState, type ChangeEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Package,
  Plus,
  Minus,
  AlertTriangle,
  FileText,
  Sparkles,
  Check,
  Pencil,
  ImagePlus,
  Camera,
  Video,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';
import {
  acceptAttribute,
  readCompressedImageDataUrl,
  readFileAsDataUrl,
  readVideoDurationSeconds,
  validateFile,
} from '../../lib/upload';
import type { Product, VendorStore } from '../../lib/types';

interface EditableImage {
  url: string;
  altText: string;
}

export function StoreProductsPage() {
  const { storeId = 'store-1' } = useParams();
  const [store, setStore] = useState<VendorStore | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stockNotice, setStockNotice] = useState<string | null>(null);

  // Edit existing product (photos, <=10s video, title, description, price)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriceUsd, setEditPriceUsd] = useState('');
  const [editImages, setEditImages] = useState<EditableImage[]>([]);
  const [editImageError, setEditImageError] = useState<string | null>(null);
  const [editVideoUrl, setEditVideoUrl] = useState<string | undefined>(undefined);
  const [editVideoDurationSec, setEditVideoDurationSec] = useState<number | undefined>(undefined);
  const [removeEditVideo, setRemoveEditVideo] = useState(false);
  const [editVideoError, setEditVideoError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<VendorStore>(`/vendors/stores/${storeId}`).catch(() => ({ data: null })),
      api.get<Product[]>(`/vendors/stores/${storeId}/products`).catch(() => ({ data: [] })),
    ])
      .then(([storeResponse, productsResponse]) => {
        setStore(storeResponse.data || { id: storeId, storeName: 'Boutique Virunga Wax', slug: 'virunga-wax', status: 'ACTIVE' });
        setProducts(productsResponse.data || []);
      })
      .catch(() => setError('Impossible de charger le catalogue de cette boutique.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [storeId]);

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setEditTitle(product.title || '');
    setEditDescription(product.description || '');
    setEditPriceUsd(String(product.basePriceUsd ?? ''));
    setEditImages(
      (product.images || []).slice(0, 3).map((img, i) => ({
        url: img.url,
        altText: img.altText || `${product.title} — vue ${i + 1}`,
      })),
    );
    setEditImageError(null);
    setEditVideoUrl(product.videoUrl ?? undefined);
    setEditVideoDurationSec(product.videoDurationSec ?? undefined);
    setRemoveEditVideo(false);
    setEditVideoError(null);
    setEditSubmitError(null);
  }

  function closeEditModal() {
    setEditingProduct(null);
    setEditImageError(null);
    setEditVideoError(null);
    setEditSubmitError(null);
  }

  async function handleEditImageSelect(e: ChangeEvent<HTMLInputElement>) {
    setEditImageError(null);
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const added: EditableImage[] = [];
    for (const file of files) {
      const msg = validateFile(file, 'PRODUCT_IMAGE');
      if (msg) {
        setEditImageError(msg);
        continue;
      }
      try {
        const { dataUrl } = await readCompressedImageDataUrl(file);
        added.push({ url: dataUrl, altText: '' });
      } catch (err: any) {
        setEditImageError(err?.message || 'Erreur lors du chargement de la photo.');
      }
    }

    if (added.length > 0) {
      setEditImages((prev) => {
        const merged = [...prev, ...added];
        if (merged.length > 3) {
          setEditImageError('3 photos maximum par produit : seules les 3 premières photos ont été conservées.');
        }
        return merged.slice(0, 3);
      });
    }
  }

  function moveEditImage(index: number, delta: -1 | 1) {
    setEditImages((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function removeEditImage(index: number) {
    setEditImageError(null);
    setEditImages((prev) => {
      if (prev.length <= 1) {
        setEditImageError('Au moins 1 photo est obligatoire pour publier un produit.');
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleEditVideoSelect(e: ChangeEvent<HTMLInputElement>) {
    setEditVideoError(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const msg = validateFile(file, 'PRODUCT_VIDEO');
    if (msg) {
      setEditVideoError(msg);
      return;
    }

    try {
      const duration = await readVideoDurationSeconds(file);
      if (duration > 10.5) {
        setEditVideoError(
          `« ${file.name} » dure ${Math.round(duration)} secondes. Maximum autorisé : 10 secondes.`,
        );
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      setEditVideoUrl(dataUrl);
      setEditVideoDurationSec(Math.min(10, Math.max(1, Math.round(duration))));
      setRemoveEditVideo(false);
    } catch (err: any) {
      setEditVideoError(err?.message || 'Impossible de lire cette vidéo.');
    }
  }

  async function handleSaveProductEdit() {
    if (!editingProduct) return;
    setEditSubmitError(null);

    if (editImages.length < 1 || editImages.length > 3) {
      setEditSubmitError('Un produit doit contenir entre 1 photo minimum et 3 photos maximum.');
      return;
    }
    if (!editTitle.trim() || editTitle.trim().length < 2) {
      setEditSubmitError('Le titre du produit doit contenir au moins 2 caractères.');
      return;
    }

    setSavingEdit(true);
    try {
      const payload: Record<string, any> = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        basePriceUsd: Number(editPriceUsd) > 0 ? Number(editPriceUsd) : undefined,
        images: editImages.map((img, i) => ({
          url: img.url,
          altText: img.altText.trim() || `${editTitle.trim()} — vue ${i + 1}`,
        })),
      };

      if (removeEditVideo) {
        payload.removeVideo = true;
      } else if (editVideoUrl) {
        payload.videoUrl = editVideoUrl;
        payload.videoDurationSec = editVideoDurationSec ?? 10;
      }

      const { data } = await api.patch<Product>(
        `/vendors/stores/${storeId}/products/${editingProduct.id}`,
        payload,
      );

      setProducts((current) =>
        current.map((item) =>
          item.id === editingProduct.id
            ? {
                ...item,
                ...(data || {}),
                title: data?.title ?? payload.title,
                description: data?.description ?? payload.description,
                basePriceUsd: data?.basePriceUsd ?? payload.basePriceUsd ?? item.basePriceUsd,
                images:
                  data?.images ||
                  payload.images.map((im: EditableImage, idx: number) => ({
                    id: `img-${Date.now()}-${idx}`,
                    url: im.url,
                    altText: im.altText,
                  })),
                videoUrl: removeEditVideo ? undefined : data?.videoUrl ?? editVideoUrl,
                videoDurationSec: removeEditVideo ? undefined : data?.videoDurationSec ?? editVideoDurationSec,
              }
            : item,
        ),
      );
      setStockNotice(`Médias et fiche mis à jour pour « ${editTitle.trim()} ».`);
      setTimeout(() => setStockNotice(null), 4000);
      closeEditModal();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setEditSubmitError(Array.isArray(msg) ? msg.join(' ') : msg || 'Impossible d’enregistrer les modifications.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function adjustStock(product: Product, delta: number) {
    const currentQty = product.stockQty ?? 10;
    const nextQty = Math.max(0, currentQty + delta);
    setBusyId(product.id);
    try {
      await api.patch(`/vendors/stores/${storeId}/products/${product.id}/stock`, {
        stockQty: nextQty,
      });
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, stockQty: nextQty } : item)),
      );
      setStockNotice(`Stock mis à jour pour "${product.title}" : ${nextQty} unités.`);
      setTimeout(() => setStockNotice(null), 3500);
    } catch {
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, stockQty: nextQty } : item)),
      );
      setStockNotice(`Stock ajusté à ${nextQty}.`);
      setTimeout(() => setStockNotice(null), 3500);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(product: Product) {
    const nextStatus = product.status === 'PUBLISHED' || product.status === 'ACTIVE' ? 'DRAFT' : 'PUBLISHED';
    setBusyId(product.id);
    setError(null);
    try {
      await api.patch(`/vendors/stores/${storeId}/products/${product.id}`, { status: nextStatus });
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, status: nextStatus } : item)),
      );
    } catch {
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, status: nextStatus } : item)),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <VendorLayout storeId={storeId} storeName={store?.storeName || 'Boutique'}>
      <div className="max-w-6xl space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-encre/10 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider font-display">
              <Package className="w-4 h-4 text-seve" />
              <span>Gestion d’Inventaire & Tarification RDC</span>
            </div>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-nuit tracking-tight">
              Catalogue & Stocks en Temps Réel
            </h1>
            <p className="mt-1 text-xs text-encre/70">
              Contrôlez les quantités en rayon, mettez à jour les photos/vidéos (1 à 3 photos, vidéo ≤ 10s) et activez vos offres.
            </p>
          </div>

          <Link
            to={`/vendor/${storeId}/products/new`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter une nouvelle offre</span>
          </Link>
        </div>

        {stockNotice && (
          <div className="p-3.5 rounded-card bg-seve/10 border border-seve/25 text-xs font-medium text-seve flex items-center gap-2 font-display">
            <Check className="w-4 h-4 shrink-0 text-seve" />
            <span>{stockNotice}</span>
          </div>
        )}

        {error && (
          <div className="rounded-card bg-wax/10 border border-wax/20 p-4 text-xs text-wax flex items-center justify-between">
            <span>{error}</span>
            <button onClick={load} className="underline font-semibold">
              Réessayer
            </button>
          </div>
        )}

        {/* Table of Products */}
        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-encre/50">
            Chargement de l’inventaire…
          </div>
        ) : products.length > 0 ? (
          <div className="overflow-x-auto rounded-card border border-encre/10 bg-white shadow-xs">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-brume/70 text-encre/80 border-b border-encre/10 font-display font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Article / Offre</th>
                  <th className="px-5 py-3.5">Type & Médias</th>
                  <th className="px-5 py-3.5">Tarification Volume (B2B)</th>
                  <th className="px-5 py-3.5">Stock en Rayon</th>
                  <th className="px-5 py-3.5">Statut Marché</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-encre/5">
                {products.map((product) => {
                  const isPhysical = product.productType === 'PHYSICAL';
                  const isDigital = product.productType === 'DIGITAL';
                  const isService = product.productType === 'SERVICE';
                  const stock = product.stockQty ?? 0;
                  const isLow = isPhysical && stock <= (product.lowStockThreshold || 5);

                  return (
                    <tr key={product.id} className="hover:bg-brume/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {product.images[0] && (
                            <img
                              src={product.images[0].url}
                              alt=""
                              className="h-11 w-11 rounded-card object-cover bg-brume border border-encre/10 shrink-0"
                            />
                          )}
                          <div>
                            <p className="font-bold text-nuit text-sm">{product.title}</p>
                            <p className="text-[11px] text-encre/50 font-mono">
                              SKU : {product.variants[0]?.sku || 'SKU-STANDARD'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-card text-[11px] font-medium border bg-brume/50 border-encre/10 text-encre">
                            {isPhysical && (
                              <>
                                <Package className="w-3.5 h-3.5 text-seve" />
                                <span>Bien physique</span>
                              </>
                            )}
                            {isDigital && (
                              <>
                                <FileText className="w-3.5 h-3.5 text-seve" />
                                <span>Document PDF</span>
                              </>
                            )}
                            {isService && (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-safran" />
                                <span>Service / Télécom</span>
                              </>
                            )}
                          </span>
                          <p className="text-[10px] font-mono text-encre/55">
                            {product.images?.length || 0} photo{(product.images?.length || 0) > 1 ? 's' : ''}
                            {product.videoUrl ? ` · Vidéo ${product.videoDurationSec || 10}s` : ''}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <span className="font-display font-bold text-nuit text-sm tabular-nums block">
                            ${Number(product.basePriceUsd).toFixed(2)}
                          </span>
                          {product.priceTiers && product.priceTiers.length > 1 ? (
                            <span className="text-[10px] text-seve font-display font-medium block">
                              Dès ${product.priceTiers[product.priceTiers.length - 1].unitPriceUsd} (volume)
                            </span>
                          ) : (
                            <span className="text-[10px] text-encre/50 font-mono block">Tarif unitaire</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {isPhysical ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => adjustStock(product, -1)}
                              disabled={busyId === product.id || stock <= 0}
                              className="h-7 w-7 rounded-lg border border-encre/20 bg-white hover:bg-brume text-encre font-bold flex items-center justify-center transition disabled:opacity-40"
                              title="Diminuer stock"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <span
                              className={`font-display font-bold tabular-nums px-2 py-0.5 rounded-card text-xs ${
                                isLow ? 'bg-wax/10 text-wax border border-wax/20' : 'bg-brume text-nuit'
                              }`}
                            >
                              {stock} pcs
                            </span>

                            <button
                              type="button"
                              onClick={() => adjustStock(product, 1)}
                              disabled={busyId === product.id}
                              className="h-7 w-7 rounded-lg border border-encre/20 bg-white hover:bg-brume text-encre font-bold flex items-center justify-center transition disabled:opacity-40"
                              title="Ajouter stock"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            {isLow && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-wax font-display font-bold bg-wax/10 border border-wax/25 px-1.5 py-0.5 rounded-card">
                                <AlertTriangle className="w-3 h-3 text-wax" />
                                <span>Alerte</span>
                              </span>
                            )}
                          </div>
                        ) : isDigital ? (
                          <span className="font-display text-seve font-medium">Illimité (Téléchargement)</span>
                        ) : (
                          <span className="font-display text-encre/60 font-medium">Sur commande</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            product.status === 'PUBLISHED' || product.status === 'ACTIVE'
                              ? 'text-seve'
                              : 'text-encre/40'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              product.status === 'PUBLISHED' || product.status === 'ACTIVE'
                                ? 'bg-seve'
                                : 'bg-encre/20'
                            }`}
                          />
                          <span>
                            {product.status === 'PUBLISHED' || product.status === 'ACTIVE'
                              ? 'En vente'
                              : 'Brouillon'}
                          </span>
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-card border border-encre/15 hover:border-seve text-nuit font-display font-semibold text-[11px] transition"
                          >
                            <Pencil className="w-3 h-3 text-seve" />
                            <span>Éditer photos / vidéo</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === product.id}
                            onClick={() => toggleStatus(product)}
                            className="font-medium text-xs text-encre/70 hover:text-seve underline underline-offset-4 disabled:opacity-50"
                          >
                            {busyId === product.id
                              ? 'Mise à jour…'
                              : product.status === 'PUBLISHED' || product.status === 'ACTIVE'
                              ? 'Désactiver'
                              : 'Mettre en vente'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-encre/20 py-16 text-center bg-white p-8">
            <Package className="w-12 h-12 text-encre/30 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-nuit font-display">Aucun produit dans ce catalogue</h3>
            <p className="text-xs text-encre/60 mt-1 max-w-sm mx-auto">
              Publiez votre première offre avec gestion de stock pour la rendre disponible aux acheteurs de toute la RDC.
            </p>
            <Link
              to={`/vendor/${storeId}/products/new`}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-card bg-seve text-brume font-display font-bold text-xs hover:bg-seve/90 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Créer une offre</span>
            </Link>
          </div>
        )}
      </div>

      {/* Modal: Edit existing product photos (1-3), video (<=10s), and info */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-nuit/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-card max-w-2xl w-full p-6 shadow-2xl border border-encre/10 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-encre/10 pb-3">
              <div>
                <h2 className="font-display font-bold text-lg text-nuit">
                  Modifier les photos, vidéo & fiche produit
                </h2>
                <p className="text-xs text-encre/60 mt-0.5">
                  1 photo minimum · 3 photos maximum (compression auto 3G/4G) · Vidéo de présentation ≤ 10s.
                </p>
              </div>
              <button type="button" onClick={closeEditModal} className="text-encre/40 hover:text-nuit">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-[1.5fr_0.7fr] gap-3">
              <div>
                <label className="block text-xs font-semibold text-encre/80 mb-1">Titre de l’article *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-card border border-encre/20 bg-white px-3 py-2 text-xs text-nuit outline-none focus:border-seve"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-encre/80 mb-1">Prix de base (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  value={editPriceUsd}
                  onChange={(e) => setEditPriceUsd(e.target.value)}
                  className="w-full rounded-card border border-encre/20 bg-white px-3 py-2 text-xs font-mono text-nuit outline-none focus:border-seve"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-encre/80 mb-1">Description</label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-card border border-encre/20 bg-white px-3 py-2 text-xs text-nuit outline-none focus:border-seve"
              />
            </div>

            {/* Photos 1..3 */}
            <div className="space-y-3 pt-2 border-t border-encre/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold text-xs text-nuit">
                    Photos produit ({editImages.length}/3 · min 1 requise)
                  </h3>
                  <p className="text-[11px] text-encre/60">
                    Indiquez la couleur dans la légende (ex. « Émeraude », « Noir Ébène ») pour synchroniser la galerie avec le sélecteur de couleur.
                  </p>
                </div>
                {editImages.length < 3 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-seve text-brume text-[11px] font-display font-bold hover:bg-seve/90 transition">
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>Depuis la galerie</span>
                      <input
                        type="file"
                        multiple
                        accept={acceptAttribute('PRODUCT_IMAGE')}
                        onChange={handleEditImageSelect}
                        className="sr-only"
                      />
                    </label>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-nuit text-safran text-[11px] font-display font-bold hover:bg-nuit/90 transition">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Caméra</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleEditImageSelect}
                        className="sr-only"
                      />
                    </label>
                  </div>
                )}
              </div>

              {editImageError && (
                <div className="p-2.5 rounded-card bg-wax/10 border border-wax/25 text-[11px] text-wax">
                  {editImageError}
                </div>
              )}

              <div className="grid sm:grid-cols-3 gap-3">
                {editImages.map((img, idx) => (
                  <div key={`${idx}-${img.url.slice(0, 24)}`} className="rounded-card border border-encre/15 bg-brume/40 p-2 space-y-2">
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-white">
                      <img src={img.url} alt={img.altText || `Photo ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-nuit/80 text-white text-[10px] font-mono">
                        #{idx + 1}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={img.altText}
                      onChange={(e) =>
                        setEditImages((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, altText: e.target.value } : item)),
                        )
                      }
                      placeholder="Couleur ou angle (ex: Vert Sève)"
                      className="w-full rounded-lg border border-encre/15 bg-white px-2 py-1 text-[11px] text-nuit outline-none focus:border-seve"
                    />
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveEditImage(idx, -1)}
                          className="p-1 rounded border border-encre/15 bg-white text-encre/70 disabled:opacity-30"
                          title="Déplacer à gauche"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === editImages.length - 1}
                          onClick={() => moveEditImage(idx, 1)}
                          className="p-1 rounded border border-encre/15 bg-white text-encre/70 disabled:opacity-30"
                          title="Déplacer à droite"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEditImage(idx)}
                        className="inline-flex items-center gap-1 text-[11px] text-wax hover:underline"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Retirer</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Video <= 10s */}
            <div className="space-y-2.5 pt-2 border-t border-encre/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold text-xs text-nuit flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-safran" />
                    <span>Vidéo courte de présentation (optionnelle · max 10 secondes)</span>
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border border-encre/20 bg-white hover:border-seve text-[11px] font-display font-semibold text-nuit transition">
                    <Video className="w-3.5 h-3.5 text-seve" />
                    <span>Galerie vidéo (≤ 10s)</span>
                    <input
                      type="file"
                      accept={acceptAttribute('PRODUCT_VIDEO')}
                      onChange={handleEditVideoSelect}
                      className="sr-only"
                    />
                  </label>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-nuit text-safran text-[11px] font-display font-bold hover:bg-nuit/90 transition">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Filmer</span>
                    <input
                      type="file"
                      accept="video/*"
                      capture="environment"
                      onChange={handleEditVideoSelect}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              {editVideoError && (
                <div className="p-2.5 rounded-card bg-wax/10 border border-wax/25 text-[11px] text-wax">
                  {editVideoError}
                </div>
              )}

              {editVideoUrl && !removeEditVideo && (
                <div className="p-3 rounded-card bg-brume/60 border border-encre/15 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <video
                    src={editVideoUrl}
                    controls
                    playsInline
                    muted
                    className="w-full sm:w-44 rounded-lg bg-nuit max-h-28 object-contain"
                  />
                  <div className="flex-1 space-y-1 text-xs">
                    <p className="font-display font-semibold text-nuit">
                      Vidéo active ({editVideoDurationSec || 10}s max)
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setEditVideoUrl(undefined);
                        setEditVideoDurationSec(undefined);
                        setRemoveEditVideo(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-wax hover:underline"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Supprimer la vidéo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {editSubmitError && (
              <div className="p-3 rounded-card bg-wax/10 border border-wax/25 text-xs text-wax">
                {editSubmitError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-encre/10">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 text-xs text-encre/70 hover:text-nuit font-medium"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={savingEdit || editImages.length < 1}
                onClick={handleSaveProductEdit}
                className="px-5 py-2 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition disabled:opacity-50"
              >
                {savingEdit ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
