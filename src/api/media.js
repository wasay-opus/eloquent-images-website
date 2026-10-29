import { getToken } from './authToken.js';
import { API_BASE } from './endpoints.js';

async function authPost(path, body) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({ success: false }));

  if (!response.ok || !data.success) {
    throw new Error(data.message || data.error || `Request ${path} failed`);
  }

  return data;
}

// Step 1: ask our backend for a temporary pre-signed Google Storage URL.
export async function requestUploadUrl({ fileName, contentType, size }) {
  const data = await authPost('/api/media/upload-url', { fileName, contentType, size });
  return data.data; // { uploadUrl, fileUrl, expiresAt }
}

// Step 2: PUT the raw file bytes straight to Google Storage (no app token here).
export async function uploadFileToStorage(uploadUrl, file) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`File upload failed with status ${response.status}`);
  }
}

// Step 3: register the uploaded file in the media library.
export async function saveMedia({ fileName, fileUrl }) {
  const data = await authPost('/api/media/save', { fileName, fileUrl });
  return data.data; // { id, uri, thumbnail, preview }
}

// The full 3-step flow: hand it a File and get back the saved media item.
export async function uploadImage(file) {
  const { uploadUrl, fileUrl } = await requestUploadUrl({
    fileName: file.name,
    contentType: file.type,
    size: file.size,
  });

  await uploadFileToStorage(uploadUrl, file);

  return saveMedia({ fileName: file.name, fileUrl });
}

export async function fetchMediaList(signal) {
  const token = getToken();
  const response = await fetch(`${API_BASE}/api/media/list`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const data = await response.json();

  if (!response.ok || !data.success || !Array.isArray(data.data)) {
    throw new Error('Media list request failed');
  }

  return data.data; // [{ id, uri, thumbnail, preview, width, height }]
}
