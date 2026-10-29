import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPrintfulProducts } from '../api/printful/catalog.js';
import RemoteImage from './RemoteImage.jsx';

function ProductPickerModal({ image, onClose }) {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchPrintfulProducts()
      .then((items) => {
        setProducts(items);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
    return () => controller.abort();
  }, []);

  // Lock background scroll and close on Escape while the modal is open.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q),
    );
  }, [products, query]);

  function selectProduct(product) {
    navigate(`/products/${product.id}?design=${encodeURIComponent(image.src)}`);
    onClose();
  }

  return (
    <div className="pickerModal-overlay" onClick={onClose} role="presentation">
      <div
        className="pickerModal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose a product for your design"
      >
        <button className="pickerModal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="pickerModal-head">
          <div className="pickerModal-design">
            <img src={image.src} alt={image.caption} />
          </div>
          <div className="pickerModal-headText">
            <h3>Choose a product</h3>
            <p>
              Your design: <strong>{image.caption || 'Selected image'}</strong>
            </p>
          </div>
        </div>

        <div className="pickerModal-search">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m20.7 19.3-4.2-4.2a7.8 7.8 0 1 0-1.4 1.4l4.2 4.2 1.4-1.4ZM4.8 10.5a5.7 5.7 0 1 1 11.4 0 5.7 5.7 0 0 1-11.4 0Z" />
          </svg>
          <input
            type="search"
            placeholder="Search products (frames, posters, canvas…)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </div>

        <div className="pickerModal-body">
          {status === 'loading' && (
            <p className="pickerModal-status">Loading products…</p>
          )}
          {status === 'error' && (
            <p className="pickerModal-status">Products could not be loaded.</p>
          )}
          {status === 'ready' && filtered.length === 0 && (
            <p className="pickerModal-status">No products match “{query}”.</p>
          )}
          {status === 'ready' && filtered.length > 0 && (
            <div className="pickerModal-grid">
              {filtered.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="pickerModal-product"
                  onClick={() => selectProduct(product)}
                >
                  <div className="pickerModal-productImg">
                    <RemoteImage src={product.image} alt={product.name} loading="lazy" />
                  </div>
                  <span className="pickerModal-productName">{product.name}</span>
                  {product.category && (
                    <span className="pickerModal-productCat">{product.category}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductPickerModal;
