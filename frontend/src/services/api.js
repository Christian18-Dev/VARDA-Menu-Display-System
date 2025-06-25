import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear invalid token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication APIs
export const login = (credentials) => api.post('/auth/login', credentials);
export const register = (userData) => api.post('/auth/register', userData);
export const getProfile = () => api.get('/auth/profile');
export const updateProfile = (profileData) => api.put('/auth/profile', profileData);
export const changePassword = (passwordData) => api.put('/auth/change-password', passwordData);
export const getUsers = () => api.get('/auth/users');
export const toggleUserStatus = (userId) => api.put(`/auth/users/${userId}/toggle-status`);

// Display APIs
export const getDisplays = () => api.get('/displays')
export const createDisplay = (displayData) => api.post('/displays', displayData)
export const deleteDisplay = (displayId) => api.delete(`/displays/${displayId}`)
export const updateDisplayMenus = (displayId, menuIds, slideshowInterval) => 
  api.put(`/displays/${displayId}/menus`, { menuIds, slideshowInterval })

// Menu APIs
export const getMenus = () => api.get('/menus')
export const getMenu = (id) => api.get(`/menus/${id}`)
export const deleteMenu = (id) => api.delete(`/menus/${id}`)
export const createCustomMenu = (menuData) => api.post('/create-custom-menu', menuData)
export const updateMenu = (id, menuData) => api.put(`/menus/${id}`, menuData)

// Upload APIs
export const uploadMenu = (formData) => {
  const token = localStorage.getItem('token');
  return axios.post(`${API_BASE_URL}/upload-menu`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': token ? `Bearer ${token}` : '',
    },
  })
}

export const uploadItemImage = (formData) => {
  const token = localStorage.getItem('token');
  return axios.post(`${API_BASE_URL}/upload-item-image`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'Authorization': token ? `Bearer ${token}` : '',
    },
  })
}

export default api 