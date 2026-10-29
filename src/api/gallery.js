import { getToken } from './authToken.js';
import { API_BASE } from './endpoints.js';

let categoriesCache = null;
let categoriesRequest = null;

function getImageName(image) {
  return (
    image.title ||
    image.originalName ||
    image.fileName ||
    image.filename ||
    'Original name unavailable'
  );
}

function getWhatsNewFact(image) {
  return (
    image.whatsNewFact ||
    image.whats_new_fact ||
    image.interestingFact ||
    image.interesting_fact ||
    image.titles ||
    image.newTitleUpdate ||
    image.newTitleUpdatw ||
    image.new_title_update ||
    image.newTitle ||
    image.new_title ||
    image.isNewTitle ||
    image.is_new_title ||
    ''
  );
}

// Clean up titles from raw file imports: drop trailing "(1)"-style numbers,
// turn underscores into spaces, and collapse extra whitespace. Hyphens are intentional.
function cleanCaption(name = '') {
  return name
    .replace(/\.[a-z0-9]{2,4}$/i, '') // strip a leftover file extension
    .replace(/\s*\(\s*\d+\s*\)/g, '') // remove "(1)", "( 2 )" etc.
    .replace(/_+/g, ' ') // underscores -> spaces
    .replace(/\s+\d+\s*$/, '') // drop a trailing number like "American Robin 4"
    .replace(/\s+/g, ' ') // collapse repeated spaces
    .trim();
}

async function fetchJson(url, signal) {
  const token = getToken();
  const response = await fetch(url, {
    cache: 'no-store',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function getImageUrl(value = '') {
  const url = String(value || '').trim();
  const markdownMatch = url.match(/\((https?:\/\/[^)]+)\)/);
  return markdownMatch ? markdownMatch[1] : url;
}

function mapApiImages(images = []) {
  return images
    .filter((image) => image.imageUrl)
    .map((image) => ({
      id: image.id,
      src: image.imageUrl,
      caption: cleanCaption(getImageName(image)),
      whatsNewFact: cleanCaption(getWhatsNewFact(image)),
      categories: image.categories || [],
      type: 'image',
      // Kept so callers can sort a merged, cross-category feed newest-first.
      createdAt: image.createdAt || image.created_at || null,
    }));
}

function mapHomeCategorySection(section = {}) {
  const category = section.category || {};
  const imageItems = Array.isArray(section.images) ? section.images : [];
  const images = imageItems
    .map((item) => item.image || item)
    .filter((image) => getImageUrl(image?.imageUrl))
    .map((image) => ({
      id: image.id,
      src: getImageUrl(image.imageUrl),
      caption: cleanCaption(getImageName(image)),
      whatsNewFact: cleanCaption(getWhatsNewFact(image)),
      type: 'image',
      createdAt: image.createdAt || image.created_at || null,
    }))
    .slice(0, 8);
  const coverImage = section.image || section.coverImage || section.cover_image || images[0];
  const coverSrc = getImageUrl(coverImage?.imageUrl || coverImage?.src || '');

  return {
    id: section.id,
    categoryId: section.category_id || section.categoryId || category.id,
    title: category.name || section.name || section.title || 'Gallery',
    slug: category.slug || section.slug || '',
    description: section.description || '',
    featuredImage: coverSrc || images[0]?.src || '',
    images,
  };
}

function getCategoryRankMap(categories = []) {
  return new Map(categories.map((category, index) => [String(category.id), index]));
}

function getImageCategoryRank(image = {}, categoryRankMap = new Map()) {
  const ranks = (image.categories || [])
    .map((category) => categoryRankMap.get(String(category.id ?? category.categoryId)))
    .filter((rank) => Number.isInteger(rank));

  return ranks.length ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
}

function getImageFirstSortOrder(image = {}) {
  const sortOrders = (image.categories || [])
    .map((category) => Number(category.sortOrder))
    .filter((sortOrder) => Number.isFinite(sortOrder) && sortOrder > 0);

  return sortOrders.length ? Math.min(...sortOrders) : Number.MAX_SAFE_INTEGER;
}

function sortWhatsNewImages(images = [], categories = []) {
  const categoryRankMap = getCategoryRankMap(categories);

  return [...images].sort((first, second) => {
    const categoryRankDiff =
      getImageCategoryRank(first, categoryRankMap) - getImageCategoryRank(second, categoryRankMap);
    if (categoryRankDiff !== 0) return categoryRankDiff;

    const sortOrderDiff = getImageFirstSortOrder(first) - getImageFirstSortOrder(second);
    if (sortOrderDiff !== 0) return sortOrderDiff;

    return getImageName(first).localeCompare(getImageName(second), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

function getImageSortOrder(image, categoryId) {
  const category = (image.categories || []).find(
    (cat) => String(cat.id ?? cat.categoryId) === String(categoryId),
  );
  const sortOrder = Number(category?.sortOrder);
  return Number.isFinite(sortOrder) && sortOrder > 0 ? sortOrder : null;
}

function sortByCaption(images = []) {
  return [...images].sort((first, second) =>
    (first.caption || '').localeCompare(second.caption || '', undefined, {
      numeric: true,
      sensitivity: 'base',
    }),
  );
}

function sortImagesForCategory(images = [], categoryId, categorySlug = '') {
  if (String(categorySlug).toLowerCase() === 'birds') {
    return sortByCaption(images);
  }

  const hasSortOrder = images.some((image) => getImageSortOrder(image, categoryId) !== null);
  if (categoryId && !hasSortOrder) return [...images];

  return [...images].sort((first, second) => {
    const firstOrder = getImageSortOrder(first, categoryId);
    const secondOrder = getImageSortOrder(second, categoryId);

    if (firstOrder !== null && secondOrder !== null && firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }
    if (firstOrder !== null || secondOrder !== null) return firstOrder !== null ? -1 : 1;

    return sortByCaption([first, second])[0] === first ? -1 : 1;
  });
}

function hasIsNewFlag(image) {
  return (
    Object.prototype.hasOwnProperty.call(image, 'isNew') ||
    Object.prototype.hasOwnProperty.call(image, 'is_new')
  );
}

function isMarkedNew(image) {
  return (
    image.isNew === true ||
    image.is_new === true ||
    String(image.isNew).toLowerCase() === 'true' ||
    String(image.is_new).toLowerCase() === 'true'
  );
}

function getWhatsNewSortDate(image) {
  return (
    image.isNewAt ||
    image.is_new_at ||
    image.isNewUpdatedAt ||
    image.is_new_updated_at ||
    image.updatedAt ||
    image.updated_at ||
    image.createdAt ||
    image.created_at ||
    null
  );
}

export async function fetchGalleryCategories() {
  if (categoriesCache) return categoriesCache;
  if (categoriesRequest) return categoriesRequest;

  categoriesRequest = fetchJson(`${API_BASE}/api/Categories`)
    .then((data) => {
      if (!data.success || !Array.isArray(data.categories)) {
        throw new Error('The categories response is invalid');
      }

      categoriesCache = data.categories;
      return categoriesCache;
    })
    .finally(() => {
      categoriesRequest = null;
    });

  return categoriesRequest;
}

export async function fetchHomeCategorySections(signal) {
  const categories = await fetchGalleryCategories();
  const categoryById = new Map(categories.map((category) => [String(category.id), category]));
  const homeCategoryData = await fetchJson(`${API_BASE}/api/whatsnew-get-all-categories`, signal).catch(() => ({}));
  const homeCategoryList = Array.isArray(homeCategoryData.data)
    ? homeCategoryData.data
    : Array.isArray(homeCategoryData.categories)
      ? homeCategoryData.categories
      : Array.isArray(homeCategoryData)
        ? homeCategoryData
        : [];
  const details = await Promise.all(
    homeCategoryList.map(async (section) => {
      const normalizedSection = mapHomeCategorySection(section);
      if (!categoryById.has(String(normalizedSection.categoryId))) return null;

      const detail = normalizedSection.id
        ? await fetchJson(`${API_BASE}/api/whatsnew-get-category/${normalizedSection.id}`, signal)
            .then((response) => response.data || response)
            .catch(() => section)
        : section;
      const category = categoryById.get(String(detail.category_id || detail.categoryId || detail.category?.id));
      const homeSection = mapHomeCategorySection({
        ...detail,
        category: detail.category || category,
      });

      return {
        ...homeSection,
        categoryId: category?.id || homeSection.categoryId,
        title: category?.name || homeSection.title,
        slug: category?.slug || homeSection.slug,
        featuredImage: homeSection.featuredImage || homeSection.images[0]?.src || '',
      };
    }),
  );

  return details
    .filter((section) => section?.title && section.images.length > 0 && section.images.length <= 8)
    .sort(
      (first, second) =>
        (categoryById.has(String(first.categoryId)) ? categories.findIndex((category) => String(category.id) === String(first.categoryId)) : 999) -
        (categoryById.has(String(second.categoryId)) ? categories.findIndex((category) => String(category.id) === String(second.categoryId)) : 999),
    );
}

export async function searchImages(query, signal) {
  const params = new URLSearchParams({ limit: '100', search: query });

  const data = await fetchJson(`${API_BASE}/api/images?${params.toString()}`, signal);

  if (!data.success || !Array.isArray(data.data)) {
    throw new Error('The search response is invalid');
  }

  return mapApiImages(data.data);
}

// Flat list of gallery designs for the product "place your design" picker.
// Uses a high limit so the user sees their available designs in one grid.
export async function fetchGalleryImages(signal) {
  const data = await fetchJson(`${API_BASE}/api/images?limit=100`, signal);

  if (!data.success || !Array.isArray(data.data)) {
    throw new Error('The images response is invalid');
  }

  return mapApiImages(data.data);
}

// Fetch the latest N images across all categories that are marked as "What's New"
export async function fetchLatestImages(limit = 15, signal) {
  const params = new URLSearchParams({ limit: '100', is_new: 'true' });
  const [data, categories] = await Promise.all([
    fetchJson(`${API_BASE}/api/images?${params.toString()}`, signal),
    fetchGalleryCategories(),
  ]);

  if (!data.success || !Array.isArray(data.data)) {
    throw new Error('The images response is invalid');
  }

  let newImages = data.data;

  // The backend filters by is_new but does not always echo isNew in the list
  // response. Only apply the local fallback when the flag is actually present.
  if (newImages.some(hasIsNewFlag)) {
    newImages = newImages.filter(isMarkedNew);
  }

  newImages = sortWhatsNewImages(newImages, categories);

  return mapApiImages(newImages.slice(0, limit));
}

// Every image in a category (walks all pages) — used by the product detail
// design picker so the chosen category shows its full set, not just page 1.
export async function fetchAllCategoryImages(categoryId, signal, options = {}) {
  const first = await fetchCategoryImagesPage(categoryId, 1, signal, 100);
  const totalPages = first.meta?.totalPages ?? 1;
  if (totalPages <= 1) return sortImagesForCategory(first.images, categoryId, options.categorySlug);

  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchCategoryImagesPage(categoryId, index + 2, signal, 100).catch(() => null),
    ),
  );

  const seen = new Set(first.images.map((image) => image.src));
  const more = rest
    .flatMap((page) => (page ? page.images : []))
    .filter((image) => !seen.has(image.src));

  return sortImagesForCategory(first.images.concat(more), categoryId, options.categorySlug);
}

export async function fetchCategoryImagesPage(categoryId, page = 1, signal, limit = 100) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sortBy: categoryId ? 'sortOrder' : 'title',
    order: 'asc',
    _: String(Date.now()),
  });
  if (categoryId) params.set('categoryId', categoryId);

  const data = await fetchJson(`${API_BASE}/api/images?${params.toString()}`, signal);

  if (!data.success || !Array.isArray(data.data)) {
    throw new Error('The images response is invalid');
  }

  return {
    images: mapApiImages(data.data),
    meta: {
      currentPage: data.meta?.currentPage ?? page,
      totalItems: data.meta?.totalItems ?? data.data.length,
      totalPages: data.meta?.totalPages ?? 1,
    },
  };
}
