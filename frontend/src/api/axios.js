import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const TOKEN_KEY = 'zoopdesk_token';
export const USER_KEY = 'zoopdesk_user';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Pages that a logged-out visitor may legitimately be on — never bounce them to /login.
const PUBLIC_PATHS = ['/login', '/signup', '/join', '/forgot-password', '/reset-password', '/portal', '/public'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthCall = error.config?.url?.startsWith('/auth/login') || error.config?.url?.startsWith('/auth/2fa');
    if (error.response?.status === 401 && !isAuthCall) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (!PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p))) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// A separate, un-intercepted instance for public pages (client portal, ticket tracking,
// password reset). These are visited by anonymous people outside the app shell.
export const publicApi = axios.create({ baseURL: API_URL, timeout: 30000 });

export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export default api;
