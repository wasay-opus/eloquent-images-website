import { API_BASE } from './endpoints.js';

const BLOCKED_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'link',
  'meta',
];

function parseHtml(html = '') {
  return new DOMParser().parseFromString(html, 'text/html');
}

function sanitizeContent(html) {
  const document = parseHtml(html);

  document.querySelectorAll(BLOCKED_TAGS.join(',')).forEach((node) => {
    node.remove();
  });

  document.body.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();

      if (
        name.startsWith('on') ||
        name === 'style' ||
        ((name === 'href' || name === 'src') &&
          (value.startsWith('javascript:') || value.startsWith('data:text/html')))
      ) {
        element.removeAttribute(attribute.name);
      }
    });

    if (element.tagName === 'IMG') {
      element.setAttribute('loading', 'lazy');
      element.setAttribute('decoding', 'async');
    }
  });

  return document.body.innerHTML;
}

function makeExcerpt(html, maxLength = 160) {
  const text = parseHtml(html).body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

// Lightweight mapping for the blog LIST — no full-content sanitization
// (that per-element work is only needed on the detail page).
function mapBlogSummary(blog) {
  return {
    id: blog.id,
    title: blog.title,
    slug: blog.slug,
    excerpt: makeExcerpt(blog.content),
    featuredImage: blog.featuredImage,
    status: blog.status,
    createdAt: blog.createdAt,
    author: blog.author,
    category: blog.category,
  };
}

// Full mapping for the blog DETAIL page (sanitized HTML content + images).
function mapBlogFull(blog) {
  return {
    ...mapBlogSummary(blog),
    content: sanitizeContent(blog.content),
    images: Array.isArray(blog.images) ? blog.images : [],
  };
}

// Both the list and the detail page read this same endpoint, so moving between
// them used to pay for the whole round trip twice - and the images cannot even
// start downloading until it lands. Keep the response in memory briefly and
// share a single in-flight request between callers.
const LIST_CACHE_MS = 60000;

let listCache = null;
let listRequest = null;

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException('The blogs request was aborted', 'AbortError');
  }
}

async function loadBlogs() {
  // Deliberately without a caller signal: this request is shared, so one
  // component unmounting must not abort it for everyone else.
  const response = await fetch(`${API_BASE}/api/Blogs`);

  if (!response.ok) {
    throw new Error(`Blogs request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !Array.isArray(data.data)) {
    throw new Error('The blogs response is invalid');
  }

  return data.data.filter((blog) => blog.status === 'ACTIVE');
}

async function fetchBlogsRaw(signal) {
  throwIfAborted(signal);

  if (listCache && Date.now() - listCache.at < LIST_CACHE_MS) {
    return listCache.data;
  }

  if (!listRequest) {
    listRequest = loadBlogs()
      .then((data) => {
        listCache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        listRequest = null;
      });
  }

  const blogs = await listRequest;
  throwIfAborted(signal);
  return blogs;
}

export async function fetchBlogs(signal) {
  const blogs = await fetchBlogsRaw(signal);
  return blogs.map(mapBlogSummary);
}

export async function fetchBlogBySlug(slug, signal) {
  const blogs = await fetchBlogsRaw(signal);
  const blog = blogs.find((item) => item.slug === slug);
  return blog ? mapBlogFull(blog) : null;
}
