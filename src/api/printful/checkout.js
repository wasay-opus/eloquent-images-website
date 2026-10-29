// PRINTFUL FOLDER — "stripe-checkout"

import { getToken } from '../authToken.js';
import { API_BASE } from '../endpoints.js';

export async function createPrintfulCheckout({ recipient, items }) {
  const token = getToken();

  const response = await fetch(`${API_BASE}/api/printful-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ recipient, items }),
  });

  const data = await response.json().catch(() => ({ success: false }));
  console.log('[Printful][checkout] POST /printful-checkout ->', data);

  if (!response.ok || data.success === false) {
    // Printful's specific validation reason lives in error.result (e.g.
    // "Recipient: Invalid state code"). Prefer it over the generic message.
    const detail =
      data?.error?.result || data?.result || data?.message || 'Checkout could not be started';
    throw new Error(detail);
  }

  return data; // { success, sessionId, checkoutUrl, order }
}

// -----------------------------------------------------------------------------
// GET /api/my-orders  ->  logged-in user's orders (history page)
// -----------------------------------------------------------------------------
export async function fetchMyOrders(signal) {
  const token = getToken();

  const response = await fetch(`${API_BASE}/api/my-orders`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const data = await response.json().catch(() => ({ success: false }));
  console.log('[Printful][checkout] GET /my-orders ->', data);

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Could not load your orders');
  }

  // Backend may nest the list under data / orders — normalize to an array.
  const orders = Array.isArray(data) ? data : data.data || data.orders || [];
  return orders;
}
