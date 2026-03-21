import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://upalpha.onrender.com",
  timeout: 15000, // 15 s — prevents requests hanging forever
});

// Attach JWT to every request using the explicit Axios 1.x AxiosHeaders API
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 401 = invalid/expired token  |  403 = header missing entirely (HTTPBearer strict)
// In both cases the token is unusable — clear it and go back to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("token");
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export default api;
