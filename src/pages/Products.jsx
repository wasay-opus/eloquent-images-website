import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPrintfulProducts, fetchPrintfulCategories } from '../api/printful/catalog.js';
import RemoteImage from '../components/RemoteImage.jsx';
import Loader from '../components/Loader.jsx';

const PAGE_SIZE = 12;

function ProductCard({ product, priority = false }) {
  return (
    <Link className="product-card" to={`/products/${product.id}`}>
      <div className="product-cardMedia">
        <RemoteImage
          src={product.image}
          alt={product.name}
          className="product-cardImg"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
        />
      </div>

      {product.brand && <span className="product-brand">{product.brand}</span>}
      <h3>{product.name}</h3>
      {product.category && <span className="product-category">{product.category}</span>}
      {product.price && <p className="product-price">{product.price}</p>}
    </Link>
  );
}

// Build a compact page list with ellipses, e.g. 1 … 4 5 [6] 7 8 … 22
function getPageItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const items = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push('start-ellipsis');
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total - 1) items.push('end-ellipsis');

  items.push(total);
  return items;
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Products pages">
      <button
        type="button"
        className="pagination-arrow"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        ‹ Prev
      </button>

      <div className="pagination-pages">
        {getPageItems(page, totalPages).map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              className={`pagination-page ${item === page ? 'is-active' : ''}`}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="pagination-gap">
              …
            </span>
          ),
        )}
      </div>

      <button
        type="button"
        className="pagination-arrow"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next ›
      </button>
    </nav>
  );
}

function Products() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState('loading');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setProducts([]);
    setPage(1);

    async function load() {
      try {
        // Printful's catalog returns every product in one call, and the
        // categories list lets us turn each product's main_category_id into a
        // readable category name. Fetch both together.
        const [items, categories] = await Promise.all([
          fetchPrintfulProducts(),
          fetchPrintfulCategories().catch(() => null),
        ]);
        if (cancelled) return;

        const named = categories
          ? items.map((product) => ({
              ...product,
              category: categories.byId.get(String(product.mainCategoryId)) || product.category,
            }))
          : items;

        setProducts(named);
        setStatus('ready');
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to load products:', error);
          setStatus('error');
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const pageItems = useMemo(
    () => products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [products, page],
  );

  const goToPage = (next) => {
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="products">
      <div className="container">
        <div className="row">
          <div className="col-12" data-aos="fade-up">
            <h2>Products</h2>
          </div>
        </div>

        <div className="row g-4">
          {status === 'loading' && (
            <div className="col-12">
              <Loader label="Loading products…" />
            </div>
          )}
          {status === 'error' && (
            <div className="col-12">
              <div className="blog-status">
                Products could not be loaded. Please try again later.
              </div>
            </div>
          )}
          {status === 'ready' && products.length === 0 && (
            <div className="col-12">
              <div className="blog-status">No products available.</div>
            </div>
          )}
          {status === 'ready' &&
            pageItems.map((product, index) => (
              <div className="col-md-4 col-sm-6" key={product.id}>
                <ProductCard product={product} priority={page === 1 && index < 6} />
              </div>
            ))}
        </div>

        {status === 'ready' && products.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
        )}
      </div>
    </section>
  );
}

export default Products;
