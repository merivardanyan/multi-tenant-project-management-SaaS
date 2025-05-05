import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

let refreshing = null;

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth-storage');
  if (raw) {
    try {
      const { state } = JSON.parse(raw);
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`;
      }
    } catch {}
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = axios.post('/api/auth/refresh', {}, { withCredentials: true })
          .then((r) => {
            refreshing = null;
            return r.data.accessToken;
          })
          .catch(() => {
            refreshing = null;
            return null;
          });
      }
      const token = await refreshing;
      if (token) {
        const raw = localStorage.getItem('auth-storage');
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.state.accessToken = token;
          localStorage.setItem('auth-storage', JSON.stringify(parsed));
        }
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(err);
  }
);

export default api;
