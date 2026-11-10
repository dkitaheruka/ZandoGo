import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { acceptAttribute, UploadError, uploadFile, validateFile } from '../../lib/upload';

interface Category {
  id: string;
  name: string;
}

const MAX_IMAGES = 6; // même plafond que l'API

export function CreateProductPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [basePriceUsd, setBasePriceUsd] = useState('');
  const [stockQty, setStockQty] = useState('1');
  const [images, setImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  // Clés des images déjà envoyées : si la création du produit échoue ensuite (ex: slug pris),
  // un nouvel essai ne renvoie pas tout au stockage.
  const uploadedKeys = useRef(new Map<File, string>());
  const previews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images]);

  useEffect(() => {
    // Libère la mémoire des aperçus quand la liste change ou que la page se ferme
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  function handleSelect(picked: File[]) {
    setImageError(null);
    const next = [...images];
    for (const file of picked) {
      const problem = validateFile(file, 'PRODUCT_IMAGE');
      if (problem) {
        setImageError(problem);
        continue;
      }
      if (next.length >= MAX_IMAGES) {
        setImageError(`${MAX_IMAGES} images maximum par produit.`);
        break;
      }
      next.push(file);
    }
    setImages(next);
  }

  function removeImage(index: number) {
    uploadedKeys.current.delete(images[index]);
    setImages(images.filter((_, i) => i !== index));
  }

  function makeMain(index: number) {
    setImages([images[index], ...images.filter((_, i) => i !== index)]);
  }
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Category[]>('/categories').then(({ data }) => {
      setCategories(data);
      if (data[0]) setCategoryId(data[0].id);
    });
  }, []);

  function handleTitleChange(value: string) {
    setTitle(value);
    setSlug(
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
        '-' +
        Math.random().toString(36).slice(2, 6), // évite les collisions de slug
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Envoi séquentiel : plus simple à suivre, et reste sous le plafond de demandes d'envoi
      const imageKeys: string[] = [];
      for (let i = 0; i < images.length; i++) {
        let key = uploadedKeys.current.get(images[i]);
        if (!key) {
          setProgress(`Envoi des images ${i + 1}/${images.length}…`);
          key = await uploadFile(images[i], 'PRODUCT_IMAGE');
          uploadedKeys.current.set(images[i], key);
        }
        imageKeys.push(key);
      }
      setProgress(null);

      await api.post(`/vendors/stores/${storeId}/products`, {
        title,
        slug,
        description,
        categoryId,
        basePriceUsd: Number(basePriceUsd),
        variants: [{ sku: slug, stockQty: Number(stockQty) }],
        imageKeys,
      });
      navigate(`/vendor/${storeId}/products`);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(
        err instanceof UploadError
          ? err.message
          : Array.isArray(msg)
            ? msg.join(' ')
            : (msg ?? 'Impossible de créer le produit.'),
      );
    } finally {
      setProgress(null);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Ajouter un produit</h1>
      <p className="mt-2 text-encre/60">
        Le produit sera créé en brouillon — pensez à l'activer une fois prêt.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5">Titre</label>
          <input
            required
            minLength={2}
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full rounded-lg border border-encre/20 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-encre/20 px-4 py-2.5 focus:border-seve focus:ring-1 focus:ring-seve outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Catégorie</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-encre/20 px-4 py-2.5"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Prix (USD)</label>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={basePriceUsd}
              onChange={(e) => setBasePriceUsd(e.target.value)}
              className="w-full rounded-lg border border-encre/20 px-4 py-2.5"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Stock</label>
            <input
              required
              type="number"
              min={0}
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              className="w-full rounded-lg border border-encre/20 px-4 py-2.5"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="product-images">
            Images (JPEG, PNG ou WebP, 5 Mo max, {MAX_IMAGES} au plus)
          </label>
          <input
            id="product-images"
            type="file"
            multiple
            accept={acceptAttribute('PRODUCT_IMAGE')}
            disabled={loading || images.length >= MAX_IMAGES}
            onChange={(e) => {
              // Copie avant de vider le champ : sinon la liste de fichiers se vide avec lui
              const picked = Array.from(e.target.files ?? []);
              e.target.value = '';
              handleSelect(picked);
            }}
            className="w-full rounded-lg border border-encre/20 px-4 py-2.5 text-sm"
          />
          {imageError && <p className="mt-2 text-sm text-wax">{imageError}</p>}

          {images.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-3">
              {images.map((file, index) => (
                <li key={`${file.name}-${index}`} className="relative">
                  <img
                    src={previews[index]}
                    alt={`Aperçu de ${file.name}`}
                    className="aspect-square w-full object-cover rounded-lg border border-encre/10"
                  />
                  {index === 0 ? (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-safran px-2 py-0.5 text-xs font-medium text-nuit">
                      Principale
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => makeMain(index)}
                      className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-xs hover:bg-white"
                    >
                      Mettre en premier
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => removeImage(index)}
                    aria-label={`Retirer ${file.name}`}
                    className="absolute right-1.5 top-1.5 rounded-full bg-white/90 px-2 py-0.5 text-xs text-wax hover:bg-white"
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm text-wax">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-nuit text-brume font-medium py-3 hover:bg-nuit/90 transition-colors disabled:opacity-60"
        >
          {loading ? (progress ?? 'Création…') : 'Créer le produit'}
        </button>
      </form>
    </div>
  );
}
