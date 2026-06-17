import { ClipboardEvent, DragEvent, FormEvent, useMemo, useState } from 'react';
import { Product } from '../../types';
import { createProduct, getProduct, setProductVariants, updateProduct } from '../../services/productService';
import { useToast } from '../../contexts/ToastContext';
import { apiErrorMessage } from '../../utils/apiError';
import { formatMoney, stockAt } from '../../utils/format';
import { uploadImage } from '../../utils/imageUpload';
import { WatchImage } from '../WatchImage';

const EMPTY = { name: '', brand: '', category: '', description: '', price: '', imageUrl: '' };

/**
 * Catalogue management (owner / shopkeeper): add new products and edit existing
 * ones — including the image, which is stored on the product in the database and
 * is the real source of the photo shown across the storefront.
 */
export function CatalogPanel({ products, onChange }: { products: Product[]; onChange: () => void }) {
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Colour variants for the product being edited (loaded on edit; saved separately).
  const [colors, setColors] = useState<{ color: string; imageUrl: string }[]>([]);
  const [colorBusy, setColorBusy] = useState(false);
  const [uploadingColorIdx, setUploadingColorIdx] = useState<number | null>(null);

  const isEditing = editingId !== null;
  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  // Compress the image, upload it to Cloudinary via our API, and store the returned URL.
  async function handleImageFile(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploading(true);
    try {
      set({ imageUrl: await uploadImage(file) });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleImageFile(e.dataTransfer.files?.[0]);
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      handleImageFile(item.getAsFile());
    }
  }

  // Live preview mirrors exactly what the storefront will render for this product.
  const preview = useMemo(
    () => ({ name: form.name || 'Model', brand: form.brand || 'Brand', imageUrl: form.imageUrl }),
    [form.name, form.brand, form.imageUrl],
  );

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
    setColors([]);
  }

  async function startEdit(p: Product) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      brand: p.brand,
      category: p.category,
      description: p.description ?? '',
      price: (p.priceCents / 100).toString(),
      imageUrl: p.imageUrl ?? '',
    });
    // The catalogue list doesn't include variants, so fetch the full product to load its colours.
    setColors([]);
    try {
      const full = await getProduct(p.id);
      setColors((full.variants ?? []).map((v) => ({ color: v.color, imageUrl: v.imageUrl })));
    } catch {
      // leave colours empty if the fetch fails
    }
  }

  function addColor() {
    setColors((c) => [...c, { color: '', imageUrl: '' }]);
  }

  function removeColor(idx: number) {
    setColors((c) => c.filter((_, i) => i !== idx));
  }

  function setColorField(idx: number, patch: Partial<{ color: string; imageUrl: string }>) {
    setColors((c) => c.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  async function handleColorImage(idx: number, file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setUploadingColorIdx(idx);
    try {
      setColorField(idx, { imageUrl: await uploadImage(file) });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploadingColorIdx(null);
    }
  }

  async function saveColors() {
    if (!editingId) return;
    // Drop fully-empty rows; every remaining colour needs both a name and an image.
    const clean = colors.filter((c) => c.color.trim() || c.imageUrl);
    if (clean.some((c) => !c.color.trim() || !c.imageUrl)) {
      toast.error('Each colour needs a name and an image');
      return;
    }
    setColorBusy(true);
    try {
      const saved = await setProductVariants(
        editingId,
        clean.map((c) => ({ color: c.color.trim(), imageUrl: c.imageUrl })),
      );
      setColors(saved.map((v) => ({ color: v.color, imageUrl: v.imageUrl })));
      toast.success('Colours updated');
      onChange();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setColorBusy(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(Number(form.price) * 100);
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        category: form.category.trim(),
        description: form.description.trim() || undefined,
        priceCents,
        imageUrl: form.imageUrl.trim(),
      };
      if (isEditing) {
        await updateProduct(editingId!, payload);
        toast.success('Product updated');
      } else {
        await createProduct({ ...payload, imageUrl: payload.imageUrl || undefined });
        toast.success('Product added to the catalogue');
      }
      resetForm();
      onChange();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      {/* Add / edit form + colour manager */}
      <div className="space-y-6">
      <form onSubmit={handleSubmit} className="h-fit space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{isEditing ? 'Edit product' : 'Add product'}</h3>
          {isEditing && (
            <button type="button" onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-800">
              Cancel edit
            </button>
          )}
        </div>

        {/* Image: upload from device/gallery, drag & drop, or paste */}
        <div>
          <span className="mb-1 block text-sm font-medium">Image</span>
          <div className="flex gap-3">
            <WatchImage
              name={preview.name}
              brand={preview.brand}
              imageUrl={preview.imageUrl}
              width={300}
              className="aspect-square w-24 shrink-0 rounded"
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onPaste={handlePaste}
              className={`flex flex-1 flex-col items-center justify-center rounded border-2 border-dashed px-3 py-4 text-center transition-colors ${
                dragOver ? 'border-gold bg-gold/5' : 'border-gray-300'
              }`}
            >
              <label className="cursor-pointer rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700">
                {uploading ? 'Processing…' : 'Choose image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                />
              </label>
              <p className="mt-2 text-xs text-gray-500">or drag &amp; drop / paste an image</p>
              {form.imageUrl && (
                <button
                  type="button"
                  onClick={() => set({ imageUrl: '' })}
                  className="mt-2 text-xs text-red-600 hover:underline"
                >
                  Remove image
                </button>
              )}
            </div>
          </div>
          <input
            type="url"
            value={form.imageUrl.startsWith('data:') ? '' : form.imageUrl}
            onChange={(e) => set({ imageUrl: e.target.value })}
            placeholder="…or paste an image link (https://…)"
            title="Image link"
            className="mt-2 w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Brand</label>
            <input
              required
              value={form.brand}
              onChange={(e) => set({ brand: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Model name</label>
            <input
              required
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <input
              required
              value={form.category}
              onChange={(e) => set({ category: e.target.value })}
              placeholder="Diver, Dress…"
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Price (PKR)</label>
            <input
              type="number"
              min={1}
              step="1"
              required
              value={form.price}
              onChange={(e) => set({ price: e.target.value })}
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : isEditing ? 'Save changes' : 'Add product'}
        </button>
        {!isEditing && (
          <p className="text-xs text-gray-500">
            New products start with zero stock. Use Receive Stock / Transfers to stock them.
          </p>
        )}
      </form>

      {/* Colour manager — only when editing (colours attach to an existing product) */}
      {isEditing ? (
        <div className="space-y-3 rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Colours</h3>
            <button type="button" onClick={addColor} className="text-xs font-medium text-gray-900 hover:underline">
              + Add colour
            </button>
          </div>
          {colors.length === 0 && (
            <p className="text-xs text-gray-500">
              No colours yet. Add one or more colourways, each with its own photo — these drive the
              colour picker on the product page.
            </p>
          )}
          <div className="space-y-3">
            {colors.map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded border p-2">
                <WatchImage
                  name={c.color || 'Colour'}
                  brand={form.brand || 'Brand'}
                  imageUrl={c.imageUrl}
                  width={120}
                  className="aspect-square w-14 shrink-0 rounded"
                />
                <div className="flex-1 space-y-1.5">
                  <input
                    value={c.color}
                    onChange={(e) => setColorField(i, { color: e.target.value })}
                    placeholder="Colour name (e.g. Rose Gold)"
                    className="w-full rounded border px-2 py-1 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700">
                      {uploadingColorIdx === i ? 'Uploading…' : c.imageUrl ? 'Replace image' : 'Upload image'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        title="Colour image"
                        onChange={(e) => handleColorImage(i, e.target.files?.[0])}
                      />
                    </label>
                    <button type="button" onClick={() => removeColor(i)} className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={saveColors}
            disabled={colorBusy}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {colorBusy ? 'Saving…' : 'Save colours'}
          </button>
        </div>
      ) : (
        <p className="rounded-lg border bg-white p-5 text-xs text-gray-500 shadow-sm">
          Save a product first, then edit it to add colour options.
        </p>
      )}
      </div>

      {/* Catalogue list */}
      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Shop / W'house</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-gray-500">
                  No products yet.
                </td>
              </tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className={editingId === p.id ? 'bg-amber-50' : ''}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <WatchImage
                      name={p.name}
                      brand={p.brand}
                      imageUrl={p.imageUrl}
                      width={120}
                      className="aspect-square w-10 shrink-0 rounded"
                    />
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.brand}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{p.category}</td>
                <td className="px-4 py-3 text-right">{formatMoney(p.priceCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {stockAt(p, 'SHOP')} / {stockAt(p, 'WAREHOUSE')}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="rounded border px-3 py-1 text-xs hover:bg-gray-50"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
