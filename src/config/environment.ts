// Environment configuration for Manticore connection
export const getManticoreBaseUrl = () => {
  // In development, use Vite proxy
  if (import.meta.env.DEV) {
    return '/manticore';
  }
  
  // In production, use the backend proxy server
  // You can set this via environment variables
  return import.meta.env.VITE_MANTICORE_PROXY_URL || '/api';
};

export const isDevelopment = () => import.meta.env.DEV;
export const isProduction = () => import.meta.env.PROD;
