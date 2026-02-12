const API_BASE = '/api/v1';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('cw_token') || '';
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('cw_token', token);
    else localStorage.removeItem('cw_token');
  }

  async request(method, endpoint, body = null) {
    const opts = {
      method,
      headers: {}
    };
    if (this.token) opts.headers['Authorization'] = `Bearer ${this.token}`;
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(API_BASE + endpoint, opts);
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  }

  // Auth
  login(email, password) { return this.request('POST', '/auth/login', { email, password }); }
  register(body) { return this.request('POST', '/auth/register', body); }
  logout() { return this.request('POST', '/auth/logout'); }
  getMe() { return this.request('GET', '/auth/me'); }
  updateProfile(body) { return this.request('PUT', '/auth/updatedetails', body); }
  updatePassword(current, newPass) { return this.request('PUT', '/auth/updatepassword', { currentPassword: current, newPassword: newPass }); }
  forgotPassword(email) { return this.request('POST', '/auth/forgotpassword', { email }); }
  resetPassword(token, password) { return this.request('PUT', `/auth/resetpassword/${token}`, { password }); }

  // Lyrics
  generateLyrics(body) { return this.request('POST', '/lyrics/generate', body); }
  getMyLyrics(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request('GET', '/lyrics' + (q ? '?' + q : ''));
  }
  getLyricsById(id) { return this.request('GET', `/lyrics/${id}`); }
  updateLyrics(id, body) { return this.request('PUT', `/lyrics/${id}`, body); }
  deleteLyrics(id) { return this.request('DELETE', `/lyrics/${id}`); }
  toggleFavorite(id) { return this.request('PATCH', `/lyrics/${id}/favorite`); }
  getLyricsStats() { return this.request('GET', '/lyrics/stats'); }
  getPublicLyrics(limit = 10) { return this.request('GET', `/lyrics/public?limit=${limit}`); }

  // Admin
  getDashboard() { return this.request('GET', '/admin/dashboard'); }
  getUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request('GET', '/admin/users' + (q ? '?' + q : ''));
  }
  getUser(id) { return this.request('GET', `/admin/users/${id}`); }
  adminUpdateUser(id, body) { return this.request('PUT', `/admin/users/${id}`, body); }
  deleteUser(id, deleteLyrics = false) { return this.request('DELETE', `/admin/users/${id}?deleteLyrics=${deleteLyrics}`); }
  toggleUserRole(id) { return this.request('PATCH', `/admin/users/${id}/role`); }
  toggleUserStatus(id) { return this.request('PATCH', `/admin/users/${id}/status`); }
  getApiKeys() { return this.request('GET', '/admin/apikeys'); }
  updateApiKey(service, body) { return this.request('PUT', `/admin/apikeys/${service}`, body); }
  testApiKey(service) { return this.request('POST', `/admin/apikeys/${service}/test`); }
  clearApiKey(service) { return this.request('DELETE', `/admin/apikeys/${service}`); }
}

const api = new ApiService();
export default api;
