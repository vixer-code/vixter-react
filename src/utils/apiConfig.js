// API configuration utility
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;

export const getBackendUrl = () => BACKEND_URL;

export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${BACKEND_URL}/${cleanEndpoint}`;
};

export default {
  getBackendUrl,
  getApiUrl
};
