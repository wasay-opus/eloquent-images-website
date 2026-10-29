
// PRINTFUL FOLDER 1 — "printful-catalog"
// Endpoints handled here (all GET, base = {{baseurl}}):
//   1. GET /api/printful-get-products          -> every catalog product (grid)
//   2. GET /api/printful-products/:id           -> one product + its variants
//   3. GET /api/printful-products/:id/sizes     -> size guide / measurements
//   4. GET /api/printful-categories             -> category tree
//   5. GET /api/printful-categories/:id         -> one category

import { getToken } from '../authToken.js';
import { API_BASE } from '../endpoints.js';

// Simple in-memory caches so we don't re-hit the network on every navigation.
let productsCache = null;
let productsRequest = null;
let categoriesCache = null;
let categoriesRequest = null;
const productDetailCache = new Map();
const sizeGuideCache = new Map();

async function fetchJson(url, signal) {
  // Printful endpoints are protected — send the logged-in user's Bearer token
  // (same token the rest of the site uses), matching Postman's {{token}}.
  const token = getToken();
  const response = await fetch(url, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`Printful request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function formatPrice(amount, currency = 'USD') {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return null;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`.trim();
  }
}

// Printful descriptions are PLAIN TEXT with "\n" + bullet chars, not HTML.
// Escape it and turn newlines into <br> so ProductDetail can safely render it.
function descriptionToHtml(text = '') {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped.replace(/\n/g, '<br />');
}

// -----------------------------------------------------------------------------
// 1) GET /api/printful-get-products  ->  Products grid
//    Returns the full catalog. NOTE: the list payload has NO price (price lives
//    per-variant in the detail endpoint), so cards show title/brand/category.
// -----------------------------------------------------------------------------
// Embroidery products need thread-color options (not an image design), so they
// don't fit the "print a gallery image" flow — exclude them from the catalog.
function isEmbroideryProduct(product) {
  const techniques = product.techniques || [];
  if (!techniques.length) return false;
  const primary = techniques.find((technique) => technique.is_default) || techniques[0];
  return primary?.key === 'EMBROIDERY';
}

// The store only sells printable wall-art pieces. Prefer Printful's category
// tree, but still require frame/poster/canvas/print wording so clothes,
// accessories, shoes, clocks, mugs, and other catalog items never slip in.
const WALL_ART_CATEGORY_TITLES = ['wall art'];
const WALL_ART_ALLOWED_CATEGORY_TITLES = [
  'posters',
  'framed posters',
  'canvas prints',
  'metal prints',
];
const WALL_ART_PRINT_KEYWORDS = [
  'poster',
  'posters',
  'framed poster',
  'framed posters',
  'canvas',
  'canvas print',
  'canvas prints',
  'metal print',
  'metal prints',
  'acrylic print',
  'acrylic prints',
  'wood print',
  'wood prints',
  'photo paper',
  'fine art',
];

function normalizeTitle(title) {
  return String(title || '').toLowerCase();
}

function collectCategoryIdsByTitle(categories, titles) {
  if (!Array.isArray(categories) || !categories.length) return new Set();
  const normalizedTitles = new Set(titles.map(normalizeTitle));

  return new Set(
    categories
      .filter((category) => normalizedTitles.has(normalizeTitle(category.title)))
      .map((category) => String(category.id)),
  );
}

function collectCategoryDescendants(categories, rootTitles) {
  if (!Array.isArray(categories) || !categories.length) return new Set();

  const normalizedRoots = new Set(rootTitles.map(normalizeTitle));
  const childrenByParent = new Map();
  const roots = [];

  for (const category of categories) {
    const parentId = String(category.parent_id ?? category.parentId ?? 0);
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(category);

    if (normalizedRoots.has(normalizeTitle(category.title))) {
      roots.push(category);
    }
  }

  const ids = new Set();
  const stack = [...roots];
  while (stack.length) {
    const category = stack.pop();
    const categoryId = String(category?.id ?? '');
    if (!categoryId || ids.has(categoryId)) continue;
    ids.add(categoryId);
    stack.push(...(childrenByParent.get(categoryId) || []));
  }

  return ids;
}

function isWallArtProduct(product, wallArtCategoryIds = null, allowedCategoryIds = null) {
  if (allowedCategoryIds?.has(String(product.main_category_id))) {
    return true;
  }

  const haystack = `${product.title || ''} ${product.type_name || ''} ${product.model || ''}`.toLowerCase();
  const isPrintProduct = WALL_ART_PRINT_KEYWORDS.some((keyword) => haystack.includes(keyword));

  if (wallArtCategoryIds?.size) {
    return wallArtCategoryIds.has(String(product.main_category_id)) && isPrintProduct;
  }

  return isPrintProduct;
}

function mapCatalogProduct(product) {
  return {
    id: product.id,
    name: product.title,
    mainCategoryId: product.main_category_id,
    // category name is filled in later from the categories endpoint (#4).
    category: product.type_name || '',
    brand: product.brand || '',
    image: product.image || '',
    variantCount: product.variant_count || 0,
    currency: product.currency || 'USD',
  };
}

export async function fetchPrintfulProducts() {
  if (productsCache) return productsCache;
  if (productsRequest) return productsRequest;

  productsRequest = fetchJson(`${API_BASE}/api/printful-get-products`)
    .then(async (payload) => {
      console.log('[Printful][catalog] GET /printful-get-products ->', payload);

      if (!payload.success || !Array.isArray(payload.data)) {
        throw new Error('The Printful products response is invalid');
      }

      const categories = await fetchPrintfulCategories().catch(() => null);
      const wallArtCategoryIds = collectCategoryDescendants(
        categories?.list,
        WALL_ART_CATEGORY_TITLES,
      );
      const allowedCategoryIds = collectCategoryIdsByTitle(
        categories?.list,
        WALL_ART_ALLOWED_CATEGORY_TITLES,
      );

      productsCache = payload.data
        .filter(
          (product) =>
            isWallArtProduct(product, wallArtCategoryIds, allowedCategoryIds) &&
            !isEmbroideryProduct(product),
        )
        .map(mapCatalogProduct);
      return productsCache;
    })
    .finally(() => {
      productsRequest = null;
    });

  return productsRequest;
}

// -----------------------------------------------------------------------------
// 4) GET /api/printful-categories  ->  used to turn main_category_id into a name
//    Returns a flat list with parent_id (id 0 = top level). We expose both the
//    raw list and a quick id -> title lookup map.
// -----------------------------------------------------------------------------
export async function fetchPrintfulCategories() {
  if (categoriesCache) return categoriesCache;
  if (categoriesRequest) return categoriesRequest;

  categoriesRequest = fetchJson(`${API_BASE}/api/printful-categories`)
    .then((payload) => {
      console.log('[Printful][catalog] GET /printful-categories ->', payload);

      const list = payload?.data?.categories;
      if (!payload.success || !Array.isArray(list)) {
        throw new Error('The Printful categories response is invalid');
      }

      const byId = new Map(list.map((c) => [String(c.id), c.title]));
      categoriesCache = { list, byId };
      return categoriesCache;
    })
    .finally(() => {
      categoriesRequest = null;
    });

  return categoriesRequest;
}

// -----------------------------------------------------------------------------
// 5) GET /api/printful-categories/:id  ->  single category details
// -----------------------------------------------------------------------------
export async function fetchPrintfulCategory(categoryId, signal) {
  const payload = await fetchJson(`${API_BASE}/api/printful-categories/${categoryId}`, signal);
  console.log(`[Printful][catalog] GET /printful-categories/${categoryId} ->`, payload);

  const category = payload?.data?.category;
  if (!payload.success || !category) {
    throw new Error('The Printful category response is invalid');
  }
  return category;
}

// -----------------------------------------------------------------------------
// 2) GET /api/printful-products/:id  ->  Product detail
//    Printful variants are FLAT (each row = one color + one size + price + img).
//    The detail UI expects colors[] -> sizes[], so we group the flat variants by
//    colour. Colourless products (e.g. a luggage tag) become a single group.
// -----------------------------------------------------------------------------
function mapProductDetail(data) {
  const product = data.product || {};
  const variants = Array.isArray(data.variants) ? data.variants : [];
  const currency = product.currency || 'USD';

  const colorGroups = new Map();
  const prices = [];

  for (const variant of variants) {
    const key = variant.color || '__default__';
    if (!colorGroups.has(key)) {
      colorGroups.set(key, {
        name: variant.color || '',
        hex: variant.color_code || '#000000',
        available: false,
        photos: [],
        sizes: [],
      });
    }

    const group = colorGroups.get(key);
    if (variant.image && !group.photos.includes(variant.image)) {
      group.photos.push(variant.image);
    }

    const available = variant.in_stock !== false;
    if (available) group.available = true;

    const amount = parseFloat(variant.price);
    if (!Number.isNaN(amount)) prices.push(amount);

    group.sizes.push({
      variantId: variant.id,
      size: variant.size || variant.name || '',
      available,
      price: Number.isNaN(amount) ? null : amount,
      currency,
      priceLabel: formatPrice(amount, currency),
    });
  }

  const priceFrom = prices.length ? formatPrice(Math.min(...prices), currency) : null;
  const priceTo = prices.length ? formatPrice(Math.max(...prices), currency) : null;

  // The print placement type to send at checkout (e.g. "default", "front").
  // It's the first product file that isn't a mockup/preview.
  const printFile = (product.files || []).find(
    (file) => file.type !== 'mockup' && file.type !== 'preview',
  );

  return {
    id: product.id,
    name: product.title || '',
    description: descriptionToHtml(product.description || ''),
    category: product.type_name || '',
    brand: product.brand || '',
    priceFrom,
    priceTo,
    priceRange: priceFrom && priceTo && priceFrom !== priceTo ? `${priceFrom} – ${priceTo}` : priceFrom,
    printFileType: printFile?.type || 'default',
    // Configurable options the product requires (e.g. stitch_color on a beanie).
    options: Array.isArray(product.options) ? product.options : [],
    colors: [...colorGroups.values()],
  };
}

// Pick a sensible default for a product option. Printful option `values` may be
// an object ({ white: "White" }), an array, or carry a `default` — handle all.
function defaultOptionValue(option) {
  if (option.default !== undefined && option.default !== null && option.default !== '') {
    return option.default;
  }
  const values = option.values;
  if (Array.isArray(values) && values.length) {
    const first = values[0];
    return typeof first === 'object' ? first.value ?? first.id ?? first.key : first;
  }
  if (values && typeof values === 'object') {
    const keys = Object.keys(values);
    if (keys.length) return keys[0];
  }
  return undefined;
}

// Build the item.options array a checkout needs, giving every required option a
// default value (e.g. stitch_color -> "white") so Printful accepts the order.
export function buildCheckoutOptions(options = []) {
  return options
    .map((option) => {
      const value = defaultOptionValue(option);
      return value !== undefined && value !== null ? { id: option.id, value } : null;
    })
    .filter(Boolean);
}

export async function fetchPrintfulProductDetail(productId, signal) {
  if (productDetailCache.has(productId)) {
    return productDetailCache.get(productId);
  }

  const payload = await fetchJson(`${API_BASE}/api/printful-products/${productId}`, signal);
  console.log(`[Printful][catalog] GET /printful-products/${productId} ->`, payload);

  if (!payload.success || !payload.data?.product) {
    throw new Error('The Printful product detail response is invalid');
  }

  const mapped = mapProductDetail(payload.data);
  productDetailCache.set(productId, mapped);
  return mapped;
}

// -----------------------------------------------------------------------------
// 3) GET /api/printful-products/:id/sizes  ->  optional size guide
//    Only apparel has one; decor/accessories return nothing useful. We resolve
//    to null instead of throwing so the detail page never breaks on a 404.
// -----------------------------------------------------------------------------
export async function fetchPrintfulProductSizes(productId, signal) {
  if (sizeGuideCache.has(productId)) {
    return sizeGuideCache.get(productId);
  }

  try {
    const payload = await fetchJson(`${API_BASE}/api/printful-products/${productId}/sizes`, signal);
    console.log(`[Printful][catalog] GET /printful-products/${productId}/sizes ->`, payload);

    const guide = payload?.success ? payload.data : null;
    sizeGuideCache.set(productId, guide);
    return guide;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    console.warn(`[Printful][catalog] No size guide for product ${productId}:`, error.message);
    sizeGuideCache.set(productId, null);
    return null;
  }
}
