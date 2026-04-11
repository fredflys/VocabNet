const API_BASE = 'http://localhost:8000/api';

/**
 * A centralized, safe fetch wrapper.
 * Ensures we don't accidentally pass "undefined" in URL params,
 * and standardizes error handling to trigger Error Boundaries if needed.
 */
export const safeRequest = async (endpoint, options = {}) => {
  // 1. Guard against 'undefined' in the URL string
  if (endpoint.includes('undefined')) {
    console.error(`[API Guard] Attempted to fetch an endpoint with 'undefined': ${endpoint}`);
    // Rather than failing silently or sending bad data, we throw to the ErrorBoundary
    throw new Error(`Malformed API Request: ${endpoint} contains 'undefined'.`);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[API Error] ${response.status} on ${endpoint}:`, errText);
      throw new Error(`API Error ${response.status}: ${errText}`);
    }
    
    return await response.json();
  } catch (error) {
    // If it's a network error (e.g. server down), we log it
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      console.error(`[API Network Error] Could not connect to the backend at ${url}. Is it running?`);
    }
    throw error;
  }
};
