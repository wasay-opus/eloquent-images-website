import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { createPrintfulCheckout } from '../api/printful/checkout.js';
import { buildCheckoutOptions } from '../api/printful/catalog.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import RemoteImage from '../components/RemoteImage.jsx';
import AuthModal from '../components/AuthModal.jsx';

const EMPTY_ADDRESS = {
  name: '',
  email: '',
  address1: '',
  address2: '',
  city: '',
  state_code: '',
  zip: '',
  country_code: 'US',
  phone: '',
};

// We currently ship to the United States only.
const COUNTRIES = [{ code: 'US', name: 'United States' }];

// Printful requires a state/province code for these countries.
const STATE_REQUIRED = ['US', 'CA', 'AU'];

function Field({ name, address, errors, onChange, type = 'text', placeholder, inputMode }) {
  return (
    <div className="productDetail-field">
      <input
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={address[name]}
        className={errors[name] ? 'is-invalid' : ''}
        onChange={(e) => onChange(name, e.target.value)}
      />
      {errors[name] && <span className="productDetail-fieldError">{errors[name]}</span>}
    </div>
  );
}

function Checkout() {
  const location = useLocation();
  const { state } = location;
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { items, removeItem, clearCart, subtotal, addItem } = useCart();

  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [fieldErrors, setFieldErrors] = useState({});
  const [placing, setPlacing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // If arrived via direct navigation with an item, ensure it's in the cart.
  useEffect(() => {
    if (state?.product && state?.variant && state?.design) {
      addItem({
        product: state.product,
        variant: state.variant,
        design: state.design,
      });
      window.history.replaceState({}, document.title);
    }
  }, [state, addItem]);

  // Pre-fill name + email from the logged-in user (without clobbering edits).
  useEffect(() => {
    if (!user) return;
    setAddress((prev) => ({
      ...prev,
      name: prev.name || user.name || '',
      email: prev.email || user.email || '',
    }));
  }, [user]);

  function updateField(key, value) {
    let next = value;
    if (key === 'zip') next = value.replace(/[^0-9]/g, '');
    if (key === 'phone') next = value.replace(/[^0-9+\-\s()]/g, '');
    setAddress((current) => ({ ...current, [key]: next }));
    setFieldErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }

  function validateAddress(addr) {
    const errors = {};
    if (!addr.name.trim()) errors.name = 'Full name is required';
    if (!addr.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.email)) errors.email = 'Enter a valid email';
    if (!addr.address1.trim()) errors.address1 = 'Address is required';
    if (!addr.city.trim()) errors.city = 'City is required';
    if (!addr.zip.trim()) errors.zip = 'ZIP / postal code is required';
    if (STATE_REQUIRED.includes(addr.country_code) && !addr.state_code.trim()) {
      errors.state_code = 'State code is required for this country';
    }
    return errors;
  }

  async function handleCheckout(event) {
    event.preventDefault();

    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }

    const errors = validateAddress(address);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPlacing(true);
    setErrorMessage('');
    try {
      const result = await createPrintfulCheckout({
        recipient: {
          ...address,
          country_code: address.country_code.toUpperCase(),
          state_code: address.state_code.toUpperCase(),
        },
        items: items.map((item) => ({
          variant_id: String(item.variant?.variantId || item.variant?.id || ''),
          quantity: item.quantity || 1,
          retail_price: Number((Number(item.variant?.price) || 0).toFixed(2)),
          files: [{ type: item.product?.printFileType || 'default', url: item.design?.src || '' }],
          options: buildCheckoutOptions(item.product?.options || []),
        })),
      });

      const url = result.checkoutUrl || result.url;
      if (url) {
        clearCart();
        window.location.href = url; // off to Stripe
        return;
      }
      setErrorMessage(result.message || 'No checkout URL was returned.');
    } catch (error) {
      console.error('Checkout failed:', error);
      setErrorMessage(error.message || 'Could not start checkout.');
    } finally {
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <section className="checkout">
        <div className="container">
          <div className="blog-status">
            Your cart is empty.{' '}
            <Link className="cart-emptyLink" to="/products">
              Browse products
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="checkout">
      <div className="container">
        <h2 className="checkout-title">Checkout</h2>

        <div className="checkout-layout">
          {/* Order summary */}
          <aside className="checkout-summary">
            <div className="checkout-summaryHead">
              <h3>Your order</h3>
              <span className="checkout-summaryBadge">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="checkout-itemsList">
              {items.map((item) => (
                <div className="checkout-summaryItem" key={item.key}>
                  <div className="checkout-summaryImg">
                    <RemoteImage
                      src={item.product?.image}
                      alt={item.product?.name}
                      loading="lazy"
                    />
                    {item.design?.src && (
                      <span className="checkout-summaryDesign">
                        <img src={item.design.src} alt={item.design.caption || 'Design'} />
                      </span>
                    )}
                  </div>
                  <div className="checkout-summaryInfo">
                    <div className="checkout-summaryTitleRow">
                      <strong>{item.product?.name}</strong>
                      <button
                        type="button"
                        className="checkout-itemRemove"
                        title="Remove item"
                        aria-label={`Remove ${item.product?.name}`}
                        onClick={() => removeItem(item.key)}
                      >
                        ✕
                      </button>
                    </div>
                    <span>
                      {[item.variant?.color, item.variant?.size].filter(Boolean).join(' · ')}
                    </span>
                    {item.design?.caption && (
                      <span className="checkout-summaryDesignName">
                        Design: {item.design.caption}
                      </span>
                    )}
                    <div className="checkout-summaryPriceRow">
                      {item.quantity > 1 && (
                        <span className="checkout-summaryQty">Qty: {item.quantity}</span>
                      )}
                      <span className="checkout-summaryPrice">
                        ${((Number(item.variant?.price) || 0) * (item.quantity || 1)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-totals">
              <div className="checkout-totalRow">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="checkout-totalRow checkout-totalGrand">
                <strong>Total</strong>
                <strong>${subtotal.toFixed(2)}</strong>
              </div>
            </div>

            <div className="checkout-summaryNote">
              Shipping &amp; tax are calculated at the next step (Stripe).
            </div>
          </aside>

          {/* Shipping form */}
          <form className="checkout-form" onSubmit={handleCheckout}>
            <h3>Shipping details</h3>

            {!isAuthenticated && (
              <div className="checkout-guestPrompt">
                <p>Already have an account, or want to create one?</p>
                <div className="checkout-guestBtns">
                  <button
                    type="button"
                    className="checkout-authBtn"
                    onClick={() => setIsAuthModalOpen(true)}
                  >
                    Sign In / Register
                  </button>
                </div>
              </div>
            )}

            <div className="productDetail-formGrid">
              <Field
                name="name"
                placeholder="Full name"
                address={address}
                errors={fieldErrors}
                onChange={updateField}
              />
              <Field
                name="email"
                type="email"
                placeholder="Email"
                address={address}
                errors={fieldErrors}
                onChange={updateField}
              />
              <Field
                name="address1"
                placeholder="Address line 1"
                address={address}
                errors={fieldErrors}
                onChange={updateField}
              />
              <Field
                name="address2"
                placeholder="Address line 2 (optional)"
                address={address}
                errors={fieldErrors}
                onChange={updateField}
              />
              <Field
                name="city"
                placeholder="City"
                address={address}
                errors={fieldErrors}
                onChange={updateField}
              />
              <div className="productDetail-field">
                <select
                  className="productDetail-select"
                  value={address.country_code}
                  onChange={(e) => updateField('country_code', e.target.value)}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                name="state_code"
                placeholder={
                  STATE_REQUIRED.includes(address.country_code)
                    ? 'State code (e.g. CA)'
                    : 'State / province code (optional)'
                }
                address={address}
                errors={fieldErrors}
                onChange={updateField}
              />
              <Field
                name="zip"
                placeholder="ZIP / postal code"
                inputMode="numeric"
                address={address}
                errors={fieldErrors}
                onChange={updateField}
              />
              <Field
                name="phone"
                type="tel"
                placeholder="Phone (optional)"
                inputMode="tel"
                address={address}
                errors={fieldErrors}
                onChange={updateField}
              />
            </div>

            <div className="checkout-actions">
              <button type="submit" className="product-addBtn" disabled={placing}>
                {placing ? 'Starting checkout…' : 'Proceed to Payment'}
              </button>
              <button
                type="button"
                className="productDetail-cancelBtn"
                onClick={() => navigate(-1)}
                disabled={placing}
              >
                Back
              </button>
            </div>

            {errorMessage && (
              <div className="auth-error productDetail-checkoutError">
                {errorMessage
                  .split(';')
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
              </div>
            )}
          </form>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setIsAuthModalOpen(false)}
      />
    </section>
  );
}

export default Checkout;
