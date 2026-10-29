// Centralized API Base URL & Endpoints
// Base URL is read from Vite environment variable with a safe fallback
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'https://api.eloquent-image.com';

export const ENDPOINTS = {
  // Authentication & Profile
  AUTH: {
    LOGIN: '/api/login',
    REGISTER: '/api/register',
    FORGOT_PASSWORD: '/api/forgot-password',
    VERIFY_OTP: '/api/verify-otp',
    RESEND_OTP: '/api/resend-otp',
    RESET_PASSWORD: '/api/reset-password',
    UPDATE_PROFILE: '/api/update-profile',
    GET_USER_BY_TOKEN: '/api/get-user-by-token',
  },

  // Blogs
  BLOGS: {
    LIST: '/api/Blogs',
  },

  // Contact Form
  CONTACT: {
    SUBMIT: '/api/contact',
  },

  // Photo Gallery & Categories
  GALLERY: {
    CATEGORIES: '/api/categories',
    HOME_CATEGORIES: '/api/home-categories',
    IMAGES_BY_CATEGORY: (categoryId) => `/api/images-by-category/${categoryId}`,
    IMAGES_BY_PAGE: (categoryId) => `/api/category-images-by-page/${categoryId}`,
  },

  // Media Library
  MEDIA: {
    UPLOAD_URL: '/api/media/upload-url',
    SAVE: '/api/media/save',
    LIST: '/api/media/list',
  },

  // Printful Store & Catalog
  PRINTFUL: {
    GET_PRODUCTS: '/api/printful-get-products',
    GET_PRODUCT_DETAIL: (productId) => `/api/printful-products/${productId}`,
    GET_PRODUCT_SIZES: (productId) => `/api/printful-products/${productId}/sizes`,
    CATEGORIES: '/api/printful-categories',
    GET_CATEGORY: (categoryId) => `/api/printful-categories/${categoryId}`,
    CHECKOUT: '/api/printful-checkout',
    MY_ORDERS: '/api/my-orders',
  },
};

// Helper function to build full URLs
export function getApiUrl(path) {
  if (!path) return API_BASE;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}

export default ENDPOINTS;
