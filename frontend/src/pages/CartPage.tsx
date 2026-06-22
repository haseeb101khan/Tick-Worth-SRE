import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { placeOrder } from '../services/orderService';
import { apiErrorMessage } from '../utils/apiError';
import { formatMoney, stockAt } from '../utils/format';
import { ReceiptModal } from '../components/ReceiptModal';
import { WatchImage } from '../components/WatchImage';
import { uploadPaymentProof } from '../utils/imageUpload';
import { CONTACT } from '../utils/contact';
import { DELIVERY_OPTIONS, DeliveryMethod, Order } from '../types';
import {
  PAKISTAN_CITIES,
  PAKISTAN_PROVINCES,
  isWithinPakistanBounds,
  validatePakistanAddressDraft,
} from '../utils/pakistanAddress';

export function CartPage() {
  const { items, setQuantity, removeItem, clear, totalCents } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [liveLocation, setLiveLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'locating' | 'verified' | 'error'>('idle');
  const [locationMessage, setLocationMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'ONLINE'>('COD');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('STANDARD');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ order: Order; names: Record<string, string> } | null>(null);

  // EasyPaisa proof (only used when paying online).
  const [proofUrl, setProofUrl] = useState('');
  const [proofUploading, setProofUploading] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [reference, setReference] = useState('');

  async function handleProofFile(file: File | undefined) {
    if (!file) return;
    setProofUploading(true);
    try {
      setProofUrl(await uploadPaymentProof(file));
      toast.success('Screenshot uploaded');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setProofUploading(false);
    }
  }

  function handleUseLiveLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationMessage('Live location is not available in this browser.');
      toast.error('Live location is not available in this browser');
      return;
    }

    setLocationStatus('locating');
    setLocationMessage('Requesting location permission...');

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isWithinPakistanBounds(coords.latitude, coords.longitude)) {
          setLiveLocation(null);
          setLocationStatus('error');
          setLocationMessage('That live location is outside Pakistan.');
          toast.error('Orders can only be delivered inside Pakistan');
          return;
        }

        setLiveLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        });
        setLocationStatus('verified');
        setLocationMessage(
          `Live location verified inside Pakistan${
            Number.isFinite(coords.accuracy) ? `, accuracy about ${Math.round(coords.accuracy)}m` : ''
          }.`,
        );
        toast.success('Live location verified inside Pakistan');
      },
      (err) => {
        setLiveLocation(null);
        setLocationStatus('error');
        setLocationMessage(err.code === err.PERMISSION_DENIED ? 'Location permission was denied.' : 'Could not read live location.');
        toast.error(err.code === err.PERMISSION_DENIED ? 'Location permission was denied' : 'Could not read live location');
      },
      { enableHighAccuracy: true, maximumAge: 5 * 60 * 1000, timeout: 12_000 },
    );
  }

  const isPickup = deliveryMethod === 'PICKUP';
  const deliveryFee = DELIVERY_OPTIONS.find((o) => o.value === deliveryMethod)?.feeCents ?? 0;
  const grandTotal = totalCents + deliveryFee;

  async function handleCheckout(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: '/cart' } });
      return;
    }
    if (!isPickup) {
      const addressError = validatePakistanAddressDraft({
        address,
        city,
        province,
        postalCode,
        latitude: liveLocation?.latitude,
        longitude: liveLocation?.longitude,
      });
      if (addressError) {
        toast.error(addressError);
        return;
      }
    }
    if (paymentMethod === 'ONLINE' && (!proofUrl || !senderName.trim())) {
      toast.error('Upload your EasyPaisa screenshot and enter the sender name');
      return;
    }
    setBusy(true);
    try {
      const names = Object.fromEntries(
        items.map((i) => [i.product.id, `${i.product.brand} ${i.product.name}`]),
      );
      const order = await placeOrder({
        channel: 'ONLINE',
        paymentMethod,
        deliveryMethod,
        shippingAddress: isPickup ? undefined : address.trim(),
        shippingCity: isPickup ? undefined : city,
        shippingProvince: isPickup ? undefined : province,
        shippingPostalCode: isPickup || !postalCode.trim() ? undefined : postalCode.trim(),
        shippingLatitude: isPickup ? undefined : liveLocation?.latitude,
        shippingLongitude: isPickup ? undefined : liveLocation?.longitude,
        paymentProofUrl: paymentMethod === 'ONLINE' ? proofUrl : undefined,
        paymentSenderName: paymentMethod === 'ONLINE' ? senderName.trim() : undefined,
        paymentReference: paymentMethod === 'ONLINE' ? reference.trim() || undefined : undefined,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity, color: i.color })),
      });
      clear();
      setReceipt({ order, names });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0 && !receipt) {
    return (
      <div className="section flex min-h-[70vh] flex-col items-center justify-center pt-24 text-center">
        <span className="eyebrow-muted">Your bag</span>
        <h1 className="mt-4 font-serif text-4xl font-light text-ink">Your bag is empty</h1>
        <Link to="/shop" className="btn-outline mt-8 border-ink/30 text-ink hover:bg-ink hover:text-ivory">
          Explore the collection
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-ivory pt-28">
      <div className="section pb-24">
        <h1 className="mb-12 text-center font-serif text-5xl font-light text-ink">Your Bag</h1>

        <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
          {/* Items */}
          <div className="divide-y divide-ink/10 border-y border-ink/10">
            {items.map(({ product, quantity, color }) => {
              const max = stockAt(product, 'SHOP');
              // Show the photo of the chosen colourway, not always the cover image.
              const colorImage =
                (color && product.variants?.find((v) => v.color === color)?.imageUrl) || product.imageUrl;
              return (
                <div key={product.id} className="flex gap-5 py-6">
                  <Link to={`/shop/${product.id}`} className="w-24 shrink-0">
                    <WatchImage name={product.name} brand={product.brand} imageUrl={colorImage} width={300} className="aspect-square" />
                  </Link>
                  <div className="flex flex-1 flex-col">
                    <p className="eyebrow-muted">{product.brand}</p>
                    <Link to={`/shop/${product.id}`} className="font-serif text-xl text-ink hover:text-gold">
                      {product.name}
                    </Link>
                    {color && <p className="mt-0.5 text-xs text-stone">Colour: {color}</p>}
                    <p className="mt-1 text-sm text-stone">{formatMoney(product.priceCents)}</p>
                    <div className="mt-auto flex items-center gap-4 pt-3">
                      <div className="flex items-center border border-ink/20">
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, quantity - 1)}
                          className="h-9 w-9 text-lg hover:bg-ink/5"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, quantity + 1)}
                          disabled={quantity >= max}
                          className="h-9 w-9 text-lg hover:bg-ink/5 disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(product.id)}
                        className="text-[0.7rem] uppercase tracking-wide2 text-stone hover:text-gold-dark"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="font-serif text-lg text-ink">{formatMoney(product.priceCents * quantity)}</p>
                </div>
              );
            })}
          </div>

          {/* Checkout */}
          <form onSubmit={handleCheckout} className="h-fit border border-ink/10 bg-white p-7">
            <h2 className="font-serif text-2xl text-ink">Checkout</h2>

            <div className="mt-6">
              <p className="label-luxe">Delivery</p>
              <div className="space-y-2">
                {DELIVERY_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-start gap-3 border p-3 text-sm transition-colors ${
                      deliveryMethod === opt.value ? 'border-gold bg-gold/5' : 'border-ink/15'
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-1 accent-gold-dark"
                      checked={deliveryMethod === opt.value}
                      onChange={() => setDeliveryMethod(opt.value)}
                    />
                    <span className="flex-1">
                      <span className="flex justify-between font-medium text-ink">
                        <span>{opt.label}</span>
                        <span>{opt.feeCents === 0 ? 'Free' : formatMoney(opt.feeCents)}</span>
                      </span>
                      <span className="text-xs text-stone">{opt.blurb}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {!isPickup && (
              <div className="mt-5 space-y-3">
                <div>
                  <label className="label-luxe">House, street, area</label>
                  <textarea
                    required
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input-luxe"
                    placeholder="House 12, Street 4, F-8/2, near Markaz"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label-luxe">City / district</label>
                    <select required value={city} onChange={(e) => setCity(e.target.value)} className="input-luxe">
                      <option value="">Select city</option>
                      {PAKISTAN_CITIES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-luxe">Province / region</label>
                    <select required value={province} onChange={(e) => setProvince(e.target.value)} className="input-luxe">
                      <option value="">Select region</option>
                      {PAKISTAN_PROVINCES.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label-luxe">Postal code</label>
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    inputMode="numeric"
                    maxLength={5}
                    className="input-luxe"
                    placeholder="Optional 5 digit code"
                  />
                </div>

                <div className="border border-ink/10 bg-ivory/60 p-3">
                  <button
                    type="button"
                    onClick={handleUseLiveLocation}
                    disabled={locationStatus === 'locating'}
                    className="btn-outline w-full border-ink/25 text-ink hover:bg-ink hover:text-ivory"
                  >
                    {locationStatus === 'locating'
                      ? 'Checking location...'
                      : liveLocation
                        ? 'Refresh live location'
                        : 'Use current location'}
                  </button>
                  {locationMessage && (
                    <p
                      className={`mt-2 text-xs ${
                        locationStatus === 'verified' ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {locationMessage}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5">
              <p className="label-luxe">Payment</p>
              <div className="space-y-1.5 text-sm text-ink">
                <label className="flex items-center gap-2">
                  <input type="radio" className="accent-gold-dark" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} />
                  Cash on delivery
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" className="accent-gold-dark" checked={paymentMethod === 'ONLINE'} onChange={() => setPaymentMethod('ONLINE')} />
                  Pay online (EasyPaisa)
                </label>
              </div>

              {paymentMethod === 'ONLINE' && (
                <div className="mt-3 border border-gold/40 bg-gold/5 p-4 text-sm">
                  <p className="font-medium text-ink">How to pay with EasyPaisa</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-stone">
                    <li>
                      Send <span className="font-medium text-ink">{formatMoney(grandTotal)}</span> via EasyPaisa to{' '}
                      <span className="font-medium text-ink">{CONTACT.easypaisaNumber}</span>.
                    </li>
                    <li>Take a screenshot of the successful transfer.</li>
                    <li>Upload it below with the name on the account you paid from.</li>
                    <li>Our team verifies it as soon as possible, then your parcel ships.</li>
                  </ol>

                  <div className="mt-4">
                    <label className="label-luxe">Payment screenshot</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleProofFile(e.target.files?.[0])}
                      className="block w-full text-xs text-stone file:mr-3 file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-ivory"
                    />
                    {proofUploading && <p className="mt-1 text-xs text-stone">Uploading…</p>}
                    {proofUrl && !proofUploading && (
                      <img src={proofUrl} alt="Payment proof" className="mt-2 h-28 w-auto rounded border border-ink/10 object-contain" />
                    )}
                  </div>

                  <div className="mt-3">
                    <label className="label-luxe">Sender name (on EasyPaisa)</label>
                    <input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="input-luxe"
                      placeholder="Name the payment was sent from"
                    />
                  </div>

                  <div className="mt-3">
                    <label className="label-luxe">Transaction ID / sender number (optional)</label>
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="input-luxe"
                      placeholder="EasyPaisa TID or the number you paid from"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 space-y-1.5 border-t border-ink/10 pt-5 text-sm">
              <div className="flex justify-between text-stone">
                <span>Subtotal</span>
                <span>{formatMoney(totalCents)}</span>
              </div>
              <div className="flex justify-between text-stone">
                <span>Delivery</span>
                <span>{deliveryFee === 0 ? 'Free' : formatMoney(deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-serif text-lg text-ink">
                <span>Total</span>
                <span>{formatMoney(grandTotal)}</span>
              </div>
            </div>

            <button type="submit" disabled={busy || proofUploading || items.length === 0} className="btn-gold mt-6 w-full">
              {busy ? 'Placing order…' : user ? 'Place order' : 'Sign in to checkout'}
            </button>
          </form>
        </div>
      </div>

      {receipt && (
        <ReceiptModal
          order={receipt.order}
          productNames={receipt.names}
          customer={user ? { name: user.name, email: user.email } : null}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
