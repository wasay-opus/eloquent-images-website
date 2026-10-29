import { API_BASE } from './endpoints.js';

export async function submitContact(contact) {
  const response = await fetch(`${API_BASE}/api/contact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contact),
  });

  if (!response.ok) {
    let message = `Contact request failed with status ${response.status}`;

    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      // Keep the status-based message when the API does not return JSON.
    }

    throw new Error(message);
  }

  return response.json();
}
