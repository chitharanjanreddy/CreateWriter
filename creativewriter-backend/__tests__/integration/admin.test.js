jest.mock('../../src/models/User');
jest.mock('../../src/models/ApiKey');
jest.mock('../../src/models/Lyrics');

const User = require('../../src/models/User');
const ApiKey = require('../../src/models/ApiKey');
const Lyrics = require('../../src/models/Lyrics');
const { createMockReq, createMockRes, createMockNext, flushPromises } = require('../helpers/mockExpress');

const {
  getDashboard,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  toggleUserRole,
  toggleUserStatus,
  getApiKeys,
  updateApiKey,
  testApiKey,
  deleteApiKey
} = require('../../src/controllers/adminController');

describe('Admin Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== getDashboard ====================
  describe('GET /admin/dashboard', () => {
    it('should return dashboard stats', async () => {
      User.getStats.mockResolvedValue({ total: 10, active: 8 });
      Lyrics.countDocuments
        .mockResolvedValueOnce(50)   // totalLyrics
        .mockResolvedValueOnce(3);   // lyricsToday

      const mockApiKeys = [
        { service: 'anthropic', name: 'Anthropic', isActive: true, encryptedKey: 'enc123', lastTested: null, lastTestResult: null },
        { service: 'suno', name: 'Suno', isActive: true, encryptedKey: '', lastTested: null, lastTestResult: null }
      ];
      ApiKey.find.mockReturnValue({ select: jest.fn().mockResolvedValue(mockApiKeys) });

      User.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue([{ name: 'User1' }])
          })
        })
      });

      Lyrics.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue([{ title: 'Song1' }])
            })
          })
        })
      });

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      getDashboard(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.stats.users).toEqual({ total: 10, active: 8 });
      expect(data.stats.lyrics.total).toBe(50);
      expect(data.stats.lyrics.today).toBe(3);
      expect(data.stats.apis.configured).toBe(1);
      expect(data.apiStatus).toHaveLength(2);
      expect(data.recent.users).toHaveLength(1);
    });
  });

  // ==================== getUsers ====================
  describe('GET /admin/users', () => {
    const setupUserFind = (users, total) => {
      User.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue(users)
            })
          })
        })
      });
      User.countDocuments.mockResolvedValue(total);
    };

    it('should return paginated users with defaults', async () => {
      const mockUsers = [{ name: 'User1' }, { name: 'User2' }];
      setupUserFind(mockUsers, 2);

      const req = createMockReq({ query: {} });
      const res = createMockRes();
      const next = createMockNext();

      getUsers(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.count).toBe(2);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.limit).toBe(20);
      expect(response.pagination.total).toBe(2);
    });

    it('should apply pagination params', async () => {
      setupUserFind([], 50);

      const req = createMockReq({ query: { page: '3', limit: '10' } });
      const res = createMockRes();
      const next = createMockNext();

      getUsers(req, res, next);
      await flushPromises();

      const response = res.json.mock.calls[0][0];
      expect(response.pagination.page).toBe(3);
      expect(response.pagination.limit).toBe(10);
      expect(response.pagination.pages).toBe(5);
    });

    it('should filter by role', async () => {
      setupUserFind([], 0);

      const req = createMockReq({ query: { role: 'admin' } });
      const res = createMockRes();
      const next = createMockNext();

      getUsers(req, res, next);
      await flushPromises();

      expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
    });

    it('should filter by isActive', async () => {
      setupUserFind([], 0);

      const req = createMockReq({ query: { isActive: 'true' } });
      const res = createMockRes();
      const next = createMockNext();

      getUsers(req, res, next);
      await flushPromises();

      expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
    });

    it('should search by name or email', async () => {
      setupUserFind([], 0);

      const req = createMockReq({ query: { search: 'john' } });
      const res = createMockRes();
      const next = createMockNext();

      getUsers(req, res, next);
      await flushPromises();

      expect(User.find).toHaveBeenCalledWith(expect.objectContaining({
        $or: expect.arrayContaining([
          expect.objectContaining({ name: expect.any(Object) }),
          expect.objectContaining({ email: expect.any(Object) })
        ])
      }));
    });
  });

  // ==================== getUser ====================
  describe('GET /admin/users/:id', () => {
    it('should return user with lyrics stats', async () => {
      const mockUser = { _id: 'user123', name: 'Test' };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });
      Lyrics.getUserStats.mockResolvedValue({ totalLyrics: 5, favorites: 2 });

      const req = createMockReq({ params: { id: 'user123' } });
      const res = createMockRes();
      const next = createMockNext();

      getUser(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.user).toBe(mockUser);
      expect(data.stats.totalLyrics).toBe(5);
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      const req = createMockReq({ params: { id: 'nonexistent' } });
      const res = createMockRes();
      const next = createMockNext();

      getUser(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0].code).toBe('USER_NOT_FOUND');
    });
  });

  // ==================== updateUser ====================
  describe('PUT /admin/users/:id', () => {
    it('should update user successfully', async () => {
      const mockUser = {
        _id: 'user123', name: 'Old Name', email: 'old@test.com', role: 'user',
        isActive: true, profile: { phone: '', organization: '' },
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(mockUser);

      const req = createMockReq({
        params: { id: 'user123' },
        user: { id: 'admin1', role: 'admin' },
        body: { name: 'New Name', email: 'NEW@TEST.COM' }
      });
      const res = createMockRes();
      const next = createMockNext();

      updateUser(req, res, next);
      await flushPromises();

      expect(mockUser.name).toBe('New Name');
      expect(mockUser.email).toBe('new@test.com');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      const req = createMockReq({
        params: { id: 'nonexistent' },
        user: { id: 'admin1' },
        body: { name: 'Test' }
      });
      const res = createMockRes();
      const next = createMockNext();

      updateUser(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('USER_NOT_FOUND');
    });

    it('should prevent admin from changing own role', async () => {
      const mockUser = { _id: 'admin1', role: 'admin', profile: {} };
      User.findById.mockResolvedValue(mockUser);

      const req = createMockReq({
        params: { id: 'admin1' },
        user: { id: 'admin1', role: 'admin' },
        body: { role: 'user' }
      });
      const res = createMockRes();
      const next = createMockNext();

      updateUser(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('CANNOT_CHANGE_OWN_ROLE');
    });
  });

  // ==================== deleteUser ====================
  describe('DELETE /admin/users/:id', () => {
    it('should delete user successfully', async () => {
      const mockUser = { _id: 'user123', deleteOne: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(mockUser);

      const req = createMockReq({
        params: { id: 'user123' },
        user: { id: 'admin1' },
        query: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      deleteUser(req, res, next);
      await flushPromises();

      expect(mockUser.deleteOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      const req = createMockReq({
        params: { id: 'nonexistent' },
        user: { id: 'admin1' },
        query: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      deleteUser(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('USER_NOT_FOUND');
    });

    it('should prevent admin from deleting self', async () => {
      const mockUser = { _id: 'admin1' };
      User.findById.mockResolvedValue(mockUser);

      const req = createMockReq({
        params: { id: 'admin1' },
        user: { id: 'admin1' },
        query: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      deleteUser(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('CANNOT_DELETE_SELF');
    });

    it('should delete user lyrics when deleteLyrics=true', async () => {
      const mockUser = { _id: 'user123', deleteOne: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(mockUser);
      Lyrics.deleteMany.mockResolvedValue({});

      const req = createMockReq({
        params: { id: 'user123' },
        user: { id: 'admin1' },
        query: { deleteLyrics: 'true' }
      });
      const res = createMockRes();
      const next = createMockNext();

      deleteUser(req, res, next);
      await flushPromises();

      expect(Lyrics.deleteMany).toHaveBeenCalledWith({ user: 'user123' });
      expect(mockUser.deleteOne).toHaveBeenCalled();
    });
  });

  // ==================== toggleUserRole ====================
  describe('PATCH /admin/users/:id/role', () => {
    it('should toggle user role from user to admin', async () => {
      const mockUser = { _id: 'user123', role: 'user', save: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(mockUser);

      const req = createMockReq({
        params: { id: 'user123' },
        user: { id: 'admin1' }
      });
      const res = createMockRes();
      const next = createMockNext();

      toggleUserRole(req, res, next);
      await flushPromises();

      expect(mockUser.role).toBe('admin');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should toggle user role from admin to user', async () => {
      const mockUser = { _id: 'user123', role: 'admin', save: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(mockUser);

      const req = createMockReq({
        params: { id: 'user123' },
        user: { id: 'admin1' }
      });
      const res = createMockRes();
      const next = createMockNext();

      toggleUserRole(req, res, next);
      await flushPromises();

      expect(mockUser.role).toBe('user');
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      const req = createMockReq({ params: { id: 'nonexistent' }, user: { id: 'admin1' } });
      const res = createMockRes();
      const next = createMockNext();

      toggleUserRole(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('USER_NOT_FOUND');
    });

    it('should prevent admin from toggling own role', async () => {
      const mockUser = { _id: 'admin1', role: 'admin' };
      User.findById.mockResolvedValue(mockUser);

      const req = createMockReq({ params: { id: 'admin1' }, user: { id: 'admin1' } });
      const res = createMockRes();
      const next = createMockNext();

      toggleUserRole(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('CANNOT_CHANGE_OWN_ROLE');
    });
  });

  // ==================== toggleUserStatus ====================
  describe('PATCH /admin/users/:id/status', () => {
    it('should toggle user status from active to inactive', async () => {
      const mockUser = { _id: 'user123', isActive: true, save: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(mockUser);

      const req = createMockReq({ params: { id: 'user123' }, user: { id: 'admin1' } });
      const res = createMockRes();
      const next = createMockNext();

      toggleUserStatus(req, res, next);
      await flushPromises();

      expect(mockUser.isActive).toBe(false);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);

      const req = createMockReq({ params: { id: 'nonexistent' }, user: { id: 'admin1' } });
      const res = createMockRes();
      const next = createMockNext();

      toggleUserStatus(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('USER_NOT_FOUND');
    });

    it('should prevent admin from deactivating self', async () => {
      const mockUser = { _id: 'admin1', isActive: true };
      User.findById.mockResolvedValue(mockUser);

      const req = createMockReq({ params: { id: 'admin1' }, user: { id: 'admin1' } });
      const res = createMockRes();
      const next = createMockNext();

      toggleUserStatus(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('CANNOT_DEACTIVATE_SELF');
    });
  });

  // ==================== getApiKeys ====================
  describe('GET /admin/apikeys', () => {
    it('should return all API keys with status', async () => {
      const mockKeys = [
        {
          _id: 'key1', service: 'anthropic', name: 'Anthropic', description: 'AI',
          isActive: true, encryptedKey: 'enc123', lastTested: null, lastTestResult: null,
          usageCount: 5, lastUsed: null, metadata: {}, updatedAt: new Date(),
          getMaskedKey: jest.fn().mockReturnValue('sk-a****xyz1')
        },
        {
          _id: 'key2', service: 'suno', name: 'Suno', description: 'Music',
          isActive: false, encryptedKey: '', lastTested: null, lastTestResult: null,
          usageCount: 0, lastUsed: null, metadata: {}, updatedAt: new Date(),
          getMaskedKey: jest.fn().mockReturnValue('')
        }
      ];
      ApiKey.find.mockResolvedValue(mockKeys);

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      getApiKeys(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.count).toBe(2);
      expect(response.data[0].isConfigured).toBe(true);
      expect(response.data[0].maskedKey).toBe('sk-a****xyz1');
      expect(response.data[1].isConfigured).toBe(false);
    });
  });

  // ==================== updateApiKey ====================
  describe('PUT /admin/apikeys/:service', () => {
    it('should update API key successfully', async () => {
      const mockApiKey = {
        service: 'anthropic', name: 'Anthropic', isActive: true,
        encryptedKey: 'old', metadata: {},
        setKey: jest.fn(), save: jest.fn().mockResolvedValue(true),
        getMaskedKey: jest.fn().mockReturnValue('sk-n****ew12')
      };
      ApiKey.findOne.mockResolvedValue(mockApiKey);

      const req = createMockReq({
        params: { service: 'anthropic' },
        user: { _id: 'admin1' },
        body: { key: 'sk-new-key-123', isActive: true }
      });
      const res = createMockRes();
      const next = createMockNext();

      updateApiKey(req, res, next);
      await flushPromises();

      expect(mockApiKey.setKey).toHaveBeenCalledWith('sk-new-key-123');
      expect(mockApiKey.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should clear API key when empty string provided', async () => {
      const mockApiKey = {
        service: 'anthropic', name: 'Anthropic', isActive: true,
        encryptedKey: 'old', metadata: {},
        setKey: jest.fn(), save: jest.fn().mockResolvedValue(true),
        getMaskedKey: jest.fn().mockReturnValue('')
      };
      ApiKey.findOne.mockResolvedValue(mockApiKey);

      const req = createMockReq({
        params: { service: 'anthropic' },
        user: { _id: 'admin1' },
        body: { key: '' }
      });
      const res = createMockRes();
      const next = createMockNext();

      updateApiKey(req, res, next);
      await flushPromises();

      expect(mockApiKey.encryptedKey).toBe('');
      expect(mockApiKey.setKey).not.toHaveBeenCalled();
    });

    it('should return 404 for unknown service', async () => {
      ApiKey.findOne.mockResolvedValue(null);

      const req = createMockReq({
        params: { service: 'unknown' },
        user: { _id: 'admin1' },
        body: { key: 'test' }
      });
      const res = createMockRes();
      const next = createMockNext();

      updateApiKey(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('SERVICE_NOT_FOUND');
    });
  });

  // ==================== testApiKey ====================
  describe('POST /admin/apikeys/:service/test', () => {
    it('should return 404 for unknown service', async () => {
      ApiKey.findOne.mockResolvedValue(null);

      const req = createMockReq({ params: { service: 'unknown' } });
      const res = createMockRes();
      const next = createMockNext();

      testApiKey(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('SERVICE_NOT_FOUND');
    });

    it('should return failed when no key is configured', async () => {
      const mockApiKey = {
        getKey: jest.fn().mockReturnValue(''),
        save: jest.fn().mockResolvedValue(true),
        lastTested: null, lastTestResult: null
      };
      ApiKey.findOne.mockResolvedValue(mockApiKey);

      const req = createMockReq({ params: { service: 'anthropic' } });
      const res = createMockRes();
      const next = createMockNext();

      testApiKey(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.result).toBe('failed');
      expect(res.json.mock.calls[0][0].data.message).toBe('No API key configured');
    });

    it('should return success for non-anthropic service with key', async () => {
      const mockApiKey = {
        getKey: jest.fn().mockReturnValue('test-key'),
        save: jest.fn().mockResolvedValue(true),
        lastTested: null, lastTestResult: null
      };
      ApiKey.findOne.mockResolvedValue(mockApiKey);

      const req = createMockReq({ params: { service: 'suno' } });
      const res = createMockRes();
      const next = createMockNext();

      testApiKey(req, res, next);
      await flushPromises();

      expect(mockApiKey.lastTestResult).toBe('success');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== deleteApiKey ====================
  describe('DELETE /admin/apikeys/:service', () => {
    it('should clear API key successfully', async () => {
      const mockApiKey = {
        service: 'anthropic', name: 'Anthropic',
        encryptedKey: 'enc123', lastTested: new Date(), lastTestResult: 'success',
        save: jest.fn().mockResolvedValue(true)
      };
      ApiKey.findOne.mockResolvedValue(mockApiKey);

      const req = createMockReq({
        params: { service: 'anthropic' },
        user: { _id: 'admin1' }
      });
      const res = createMockRes();
      const next = createMockNext();

      deleteApiKey(req, res, next);
      await flushPromises();

      expect(mockApiKey.encryptedKey).toBe('');
      expect(mockApiKey.lastTested).toBeNull();
      expect(mockApiKey.lastTestResult).toBeNull();
      expect(mockApiKey.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for unknown service', async () => {
      ApiKey.findOne.mockResolvedValue(null);

      const req = createMockReq({
        params: { service: 'unknown' },
        user: { _id: 'admin1' }
      });
      const res = createMockRes();
      const next = createMockNext();

      deleteApiKey(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('SERVICE_NOT_FOUND');
    });
  });
});
