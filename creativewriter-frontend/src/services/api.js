const API_BASE = '/api/v1';

class ApiService {
  async request(method, endpoint, body = null) {
    const opts = {
      method,
      credentials: 'include',
      headers: {}
    };
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

  // Media
  generateMusic(lyricsId, body = {}) { return this.request('POST', `/media/${lyricsId}/music`, body); }
  generateVideo(lyricsId, body = {}) { return this.request('POST', `/media/${lyricsId}/video`, body); }
  generateVoice(lyricsId, body = {}) { return this.request('POST', `/media/${lyricsId}/voice`, body); }
  checkVideoStatus(videoId) { return this.request('GET', `/media/video/${videoId}/status`); }
  checkMusicStatus(taskId) { return this.request('GET', `/media/music/${taskId}/status`); }
  getVoices() { return this.request('GET', '/media/voices'); }
  getAvatars() { return this.request('GET', '/media/avatars'); }

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

  // Subscriptions - Public
  getPlans() { return this.request('GET', '/subscriptions/plans'); }

  // Subscriptions - User
  getMySubscription() { return this.request('GET', '/subscriptions/my'); }
  getMyUsage() { return this.request('GET', '/subscriptions/my/usage'); }
  validatePromo(code, planId) { return this.request('POST', '/subscriptions/validate-promo', { code, planId }); }
  createOrder(planId, billingCycle, promoCode) { return this.request('POST', '/subscriptions/create-order', { planId, billingCycle, promoCode }); }
  verifyPayment(body) { return this.request('POST', '/subscriptions/verify-payment', body); }
  cancelSubscription() { return this.request('POST', '/subscriptions/cancel'); }

  // Subscriptions - Admin
  adminGetPlans() { return this.request('GET', '/subscriptions/admin/plans'); }
  adminCreatePlan(body) { return this.request('POST', '/subscriptions/admin/plans', body); }
  adminUpdatePlan(id, body) { return this.request('PUT', `/subscriptions/admin/plans/${id}`, body); }
  adminTogglePlan(id) { return this.request('PATCH', `/subscriptions/admin/plans/${id}/toggle`); }
  adminAddOffer(planId, body) { return this.request('POST', `/subscriptions/admin/plans/${planId}/offers`, body); }
  adminRemoveOffer(planId, offerId) { return this.request('DELETE', `/subscriptions/admin/plans/${planId}/offers/${offerId}`); }
  adminOverrideSubscription(userId, planId, reason) { return this.request('POST', `/subscriptions/admin/users/${userId}/override`, { planId, reason }); }
  adminGetSubscriptions(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request('GET', '/subscriptions/admin/subscriptions' + (q ? '?' + q : ''));
  }
  adminGetAnalytics() { return this.request('GET', '/subscriptions/admin/analytics'); }
}

const api = new ApiService();
export default api;
