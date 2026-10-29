import { getToken } from './authToken.js';
import { API_BASE } from './endpoints.js';

// Shared request helper. Set `auth: true` to attach the stored Bearer token.
async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok || data.success === false) {
    throw new Error(data.message || `Request to ${path} failed`);
  }

  return data;
}

// --- Public auth (no token) ---
export function loginRequest({ email, password }) {
  return request('/api/login', { method: 'POST', body: { email, password } });
}

export function registerRequest({ name, email, password }) {
  return request('/api/register', { method: 'POST', body: { name, email, password } });
}

// Forgot-password flow: email -> OTP -> reset.
// These endpoints require the Bearer token (backend returns "Token missing!"
// otherwise), so send it when available.
export function forgotPasswordRequest({ email }) {
  return request('/api/forgot-password', { method: 'POST', body: { email }, auth: true });
}

export function verifyOtpRequest({ otp }) {
  return request('/api/verify-otp', { method: 'POST', body: { otp }, auth: true });
}

export function resendOtpRequest({ email }) {
  return request('/api/resend-otp', { method: 'POST', body: { email }, auth: true });
}

export function resetPasswordRequest({ otp, password }) {
  return request('/api/reset-password', { method: 'POST', body: { otp, password }, auth: true });
}

// --- Authenticated (Bearer token) ---
export function updateProfileRequest({ name, email }) {
  return request('/api/update-profile', { method: 'PUT', body: { name, email }, auth: true });
}

export function getUserByTokenRequest() {
  return request('/api/get-user-by-token', { auth: true });
}
