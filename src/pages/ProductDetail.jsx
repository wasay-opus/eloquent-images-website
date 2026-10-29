import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  fetchPrintfulProductDetail,
  fetchPrintfulProductSizes,
} from '../api/printful/catalog.js';
import { fetchGalleryCategories, fetchAllCategoryImages } from '../api/gallery.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import RemoteImage from '../components/RemoteImage.jsx';
import Loader from '../components/Loader.jsx';
import AuthModal from '../components/AuthModal.jsx';
import { sortGalleryCategories } from '../data/galleryCategoryOrder.js';

function ProductDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const designParam = searchParams.get('design');
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState('loading');

  const [colorIndex, setColorIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [variantId, setVariantId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [addedNotice, setAddedNotice] = useState(false);
  const { addItem } = useCart();

  // Design picker (gallery images placed onto the product), filtered by category.
  const [galleryCategories, setGalleryCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [designs, setDesigns] = useState([]);
  const [designsLoading, setDesignsLoading] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');

    fetchPrintfulProductDetail(id, controller.signal)
      .then((data) => {
        setProduct(data);
        setStatus('ready');
        // Size guide is apparel-only and optional — fetch it for logging/future
        // UI, but never let a missing guide break the detail page.
        fetchPrintfulProductSizes(id, controller.signal).catch(() => null);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Unable to load product:', error);
          setStatus('error');
        }
      });

    return () => controller.abort();
  }, [id]);

  // If the user arrived from the gallery ("Use on a product"), pre-select that
  // design immediately so it's ready even before the picker list loads.
  useEffect(() => {
    if (designParam) {
      setSelectedDesign((current) => current || { src: designParam, caption: 'Selected design' });
    }
  }, [designParam]);

  // Load the gallery categories for the design-picker filter, and pick a default.
  useEffect(() => {
    let cancelled = false;
    fetchGalleryCategories()
      .then((categories) => {
        if (cancelled || !categories.length) return;
        const orderedCategories = sortGalleryCategories(categories);
        setGalleryCategories(orderedCategories);
        setActiveCategoryId(orderedCategories[0].id);
      })
      .catch((error) => console.error('Unable to load gallery categories:', error));
    return () => {
      cancelled = true;
    };
  }, []);

  // Load every design in the active category (full set, not just page 1).
  useEffect(() => {
    if (!activeCategoryId) return undefined;
    const controller = new AbortController();
    setDesignsLoading(true);

    fetchAllCategoryImages(activeCategoryId, controller.signal)
      .then((items) => {
        setDesigns(items);
        setDesignsLoading(false);
        // Upgrade the pre-selected design to the full gallery item (caption etc.).
        if (designParam) {
          const match = items.find((design) => design.src === designParam);
          if (match) setSelectedDesign(match);
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error('Unable to load designs:', error);
          setDesignsLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeCategoryId, designParam]);

  // Always show the chosen design first, even if it lives in another category
  // (e.g. it came from the gallery "Use on a product" button).
  const pickerDesigns = useMemo(() => {
    if (selectedDesign && !designs.some((design) => design.src === selectedDesign.src)) {
      return [selectedDesign, ...designs];
    }
    return designs;
  }, [designs, selectedDesign]);

  const activeColor = product?.colors[colorIndex];

  function firstSelectableVariant(color) {
    const size = color?.sizes.find((item) => item.available) || color?.sizes[0];
    return size?.variantId || '';
  }

  // Set the default color/size once the product has loaded.
  useEffect(() => {
    if (!product) return;
    setColorIndex(0);
    setPhotoIndex(0);
    setVariantId(firstSelectableVariant(product.colors[0]));
  }, [product]);

  // Preload the active color's nearby photos without flooding the network.
  useEffect(() => {
    if (!activeColor) return;
    activeColor.photos.slice(0, 3).forEach((url) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    });
  }, [activeColor]);

  // Switch color + its default size together so the price never flickers.
  function handleColorChange(index) {
    setColorIndex(index);
    setPhotoIndex(0);
    setVariantId(firstSelectableVariant(product.colors[index]));
  }

  const selectedSize = useMemo(
    () =>
      activeColor?.sizes.find((size) => size.variantId === variantId) ||
      activeColor?.sizes.find((size) => size.available) ||
      activeColor?.sizes[0],
    [activeColor, variantId],
  );

  const photos = useMemo(
    () => (activeColor?.photos?.length ? activeColor.photos : [product?.colors[0]?.photos[0]]),
    [activeColor, product],
  );

  function buildCartItem() {
    if (!selectedSize || !selectedDesign) return null;
    return {
      product: {
        id: product.id,
        name: product.name,
        image: photos[0],
        printFileType: product.printFileType,
        options: product.options,
      },
      variant: {
        variantId: selectedSize.variantId,
        size: selectedSize.size,
        color: activeColor?.name || '',
        price: selectedSize.price,
        priceLabel: selectedSize.priceLabel || product.priceRange,
      },
      design: { src: selectedDesign.src, caption: selectedDesign.caption },
    };
  }

  function proceedToCheckout() {
    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    navigate('/checkout');
  }

  function handleAddToCart() {
    setFeedback('');
    if (!selectedDesign) {
      setFeedback('no-design');
      return;
    }
    if (!selectedSize) return;

    const item = buildCartItem();
    if (!item) return;
    addItem(item);
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2500);
  }

  // "Buy Now" — gate on auth + a chosen design, then go to the checkout page
  function handleBuyNow() {
    setFeedback('');
    if (!selectedDesign) {
      setFeedback('no-design');
      return;
    }
    if (!selectedSize) return;

    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }

    proceedToCheckout();
  }

  if (status === 'loading') {
    return (
      <section className="productDetail">
        <div className="container">
          <Loader label="Loading product…" />
        </div>
      </section>
    );
  }

  if (status === 'error' || !product) {
    return (
      <section className="productDetail">
        <div className="container">
          <div className="blog-status">
            Product could not be loaded.{' '}
            <Link className="cart-emptyLink" to="/products">
              Back to products
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="productDetail">
      <div className="container">
        <div className="row g-5">
          <div className="col-lg-6">
            <div className="productDetail-gallery">
              <div className="productDetail-mainImg">
                <RemoteImage
                  src={photos[photoIndex]}
                  alt={product.name}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
              </div>
              {photos.length > 1 && (
                <div className="productDetail-thumbs">
                  {photos.map((photo, index) => (
                    <button
                      key={photo}
                      type="button"
                      className={`productDetail-thumb ${index === photoIndex ? 'is-active' : ''}`}
                      onClick={() => setPhotoIndex(index)}
                    >
                      <img
                        src={photo}
                        alt={`${product.name} ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="col-lg-6">
            <div className="productDetail-info">
              {product.brand && <span className="product-brand">{product.brand}</span>}
              <h1>{product.name}</h1>
              {product.category && (
                <span className="product-category">{product.category}</span>
              )}
              <p className="productDetail-price">
                {selectedSize?.priceLabel || product.priceRange}
              </p>

              {(product.colors.length > 1 || activeColor?.name) && (
                <div className="productDetail-option">
                  <span className="productDetail-optionLabel">
                    Color: <strong>{activeColor?.name}</strong>
                  </span>
                  <div className="productDetail-colors">
                    {product.colors.map((color, index) => (
                      <button
                        key={color.name}
                        type="button"
                        aria-label={color.name}
                        title={color.name}
                        className={`productDetail-swatch ${index === colorIndex ? 'is-active' : ''}`}
                        style={{ background: color.hex }}
                        onClick={() => handleColorChange(index)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activeColor?.sizes?.length > 0 && (
                <div className="productDetail-option">
                  <span className="productDetail-optionLabel">Size</span>
                  <div className="product-sizes">
                    {activeColor.sizes.map((size) => (
                      <button
                        key={size.variantId}
                        type="button"
                        disabled={!size.available}
                        className={`product-size ${size.variantId === variantId ? 'is-active' : ''}`}
                        onClick={() => setVariantId(size.variantId)}
                      >
                        {size.size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Design picker — the gallery image printed on the product. */}
              <div className="productDetail-option">
                <div className="productDetail-designHead">
                  <span className="productDetail-optionLabel productDetail-designLabel">
                    Choose your design
                    {selectedDesign && <strong> — {selectedDesign.caption}</strong>}
                  </span>
                  {galleryCategories.length > 0 && (
                    <select
                      className="productDetail-select productDetail-designSelect"
                      value={activeCategoryId || ''}
                      onChange={(e) => setActiveCategoryId(Number(e.target.value))}
                    >
                      {galleryCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {designsLoading && pickerDesigns.length === 0 ? (
                  <p className="productDetail-designHint">Loading designs…</p>
                ) : pickerDesigns.length === 0 ? (
                  <p className="productDetail-designHint">No designs in this category.</p>
                ) : (
                  <div className="productDetail-designs">
                    {pickerDesigns.map((design) => (
                      <button
                        key={design.src}
                        type="button"
                        title={design.caption}
                        className={`productDetail-design ${
                          selectedDesign?.src === design.src ? 'is-active' : ''
                        }`}
                        onClick={() => setSelectedDesign(design)}
                      >
                        <img src={design.src} alt={design.caption} loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="productDetail-btnRow">
                <button
                  type="button"
                  className="product-addBtn productDetail-cartBtn"
                  onClick={handleAddToCart}
                  disabled={!selectedSize || !selectedSize.available}
                >
                  {addedNotice ? '✓ Added to Cart!' : 'Add to Cart'}
                </button>
                <button
                  type="button"
                  className="product-addBtn productDetail-addBtn"
                  onClick={handleBuyNow}
                  disabled={!selectedSize || !selectedSize.available}
                >
                  Buy Now
                </button>
              </div>

              {feedback === 'no-design' && (
                <p className="auth-error">Please choose a design to place on this product.</p>
              )}

              {product.description && (
                <div
                  className="productDetail-desc"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          proceedToCheckout();
        }}
      />
    </section>
  );
}

export default ProductDetail;
