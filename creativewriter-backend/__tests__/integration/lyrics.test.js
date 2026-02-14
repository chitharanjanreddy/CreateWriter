jest.mock('../../src/models/Lyrics');
jest.mock('../../src/models/ApiKey');
jest.mock('../../src/models/User');
jest.mock('../../src/middleware/usageLimit');
jest.mock('node-fetch');

const Lyrics = require('../../src/models/Lyrics');
const ApiKey = require('../../src/models/ApiKey');
const User = require('../../src/models/User');
const { incrementUsage } = require('../../src/middleware/usageLimit');
const fetch = require('node-fetch');
const { createMockReq, createMockRes, createMockNext, flushPromises } = require('../helpers/mockExpress');

const {
  generateLyrics,
  getLyrics,
  getLyricsById,
  updateLyrics,
  deleteLyrics,
  toggleFavorite,
  getStats,
  getPublicLyrics
} = require('../../src/controllers/lyricsController');

describe('Lyrics Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== generateLyrics ====================
  describe('POST /lyrics/generate', () => {
    it('should return error when no theme or customLines provided', async () => {
      const req = createMockReq({ body: {}, user: { _id: 'user1' } });
      const res = createMockRes();
      const next = createMockNext();

      generateLyrics(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('MISSING_INPUT');
    });

    it('should generate lyrics using Anthropic API when key is available', async () => {
      ApiKey.getKeyForService.mockResolvedValue('sk-test-key');
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Generated Telugu lyrics here' }]
        })
      });
      ApiKey.findOne.mockResolvedValue({ recordUsage: jest.fn().mockResolvedValue(true) });
      Lyrics.create.mockResolvedValue({ _id: 'lyrics1', title: 'Love Song' });
      User.findByIdAndUpdate.mockResolvedValue({});
      incrementUsage.mockResolvedValue();

      const req = createMockReq({
        body: { theme: 'Love', style: 'romantic', dialect: 'coastal' },
        user: { _id: 'user1' }
      });
      const res = createMockRes();
      const next = createMockNext();

      generateLyrics(req, res, next);
      await flushPromises();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({ method: 'POST' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.content).toBe('Generated Telugu lyrics here');
      expect(data.generationInfo.isDemo).toBe(false);
      expect(data.saved).toBeDefined();
    });

    it('should use demo mode when no API key configured', async () => {
      ApiKey.getKeyForService.mockResolvedValue(null);
      Lyrics.create.mockResolvedValue({ _id: 'lyrics1', title: 'Demo Song' });
      User.findByIdAndUpdate.mockResolvedValue({});
      incrementUsage.mockResolvedValue();

      const req = createMockReq({
        body: { theme: 'Nature' },
        user: { _id: 'user1' }
      });
      const res = createMockRes();
      const next = createMockNext();

      generateLyrics(req, res, next);
      await flushPromises();

      expect(fetch).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.generationInfo.isDemo).toBe(true);
    });

    it('should fall back to demo when API call fails', async () => {
      ApiKey.getKeyForService.mockResolvedValue('sk-test-key');
      fetch.mockResolvedValue({ ok: false, status: 500 });
      Lyrics.create.mockResolvedValue({ _id: 'lyrics1', title: 'Fallback' });
      User.findByIdAndUpdate.mockResolvedValue({});
      incrementUsage.mockResolvedValue();

      const req = createMockReq({
        body: { theme: 'Test' },
        user: { _id: 'user1' }
      });
      const res = createMockRes();
      const next = createMockNext();

      generateLyrics(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.generationInfo.isDemo).toBe(true);
    });

    it('should not save when saveResult is false', async () => {
      ApiKey.getKeyForService.mockResolvedValue(null);

      const req = createMockReq({
        body: { theme: 'Test', saveResult: false },
        user: { _id: 'user1' }
      });
      const res = createMockRes();
      const next = createMockNext();

      generateLyrics(req, res, next);
      await flushPromises();

      expect(Lyrics.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.saved).toBeNull();
    });

    it('should increment subscription usage on save', async () => {
      ApiKey.getKeyForService.mockResolvedValue(null);
      Lyrics.create.mockResolvedValue({ _id: 'lyrics1', title: 'Song' });
      User.findByIdAndUpdate.mockResolvedValue({});
      incrementUsage.mockResolvedValue();

      const req = createMockReq({
        body: { theme: 'Test' },
        user: { _id: 'user1' }
      });
      const res = createMockRes();
      const next = createMockNext();

      generateLyrics(req, res, next);
      await flushPromises();

      expect(incrementUsage).toHaveBeenCalledWith('lyrics', 'user1');
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user1', {
        $inc: { 'stats.lyricsGenerated': 1 }
      });
    });
  });

  // ==================== getLyrics ====================
  describe('GET /lyrics', () => {
    it('should return paginated lyrics for current user', async () => {
      const mockLyrics = [{ title: 'Song1' }, { title: 'Song2' }];
      Lyrics.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockLyrics)
          })
        })
      });
      Lyrics.countDocuments.mockResolvedValue(2);

      const req = createMockReq({ user: { _id: 'user1' }, query: {} });
      const res = createMockRes();
      const next = createMockNext();

      getLyrics(req, res, next);
      await flushPromises();

      expect(Lyrics.find).toHaveBeenCalledWith(expect.objectContaining({ user: 'user1' }));
      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.count).toBe(2);
      expect(response.pagination.page).toBe(1);
    });

    it('should filter by style, dialect, and favorites', async () => {
      Lyrics.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      });
      Lyrics.countDocuments.mockResolvedValue(0);

      const req = createMockReq({
        user: { _id: 'user1' },
        query: { style: 'devotional', dialect: 'telangana', isFavorite: 'true' }
      });
      const res = createMockRes();
      const next = createMockNext();

      getLyrics(req, res, next);
      await flushPromises();

      expect(Lyrics.find).toHaveBeenCalledWith(expect.objectContaining({
        user: 'user1',
        style: 'devotional',
        dialect: 'telangana',
        isFavorite: true
      }));
    });
  });

  // ==================== getLyricsById ====================
  describe('GET /lyrics/:id', () => {
    it('should return lyrics by id', async () => {
      const mockLyrics = { _id: 'lyrics1', user: 'user1', title: 'Song', isPublic: false };
      mockLyrics.user = { toString: () => 'user1' };
      Lyrics.findById.mockResolvedValue(mockLyrics);

      const req = createMockReq({
        params: { id: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } }
      });
      const res = createMockRes();
      const next = createMockNext();

      getLyricsById(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toBe(mockLyrics);
    });

    it('should return 404 if lyrics not found', async () => {
      Lyrics.findById.mockResolvedValue(null);

      const req = createMockReq({ params: { id: 'nonexistent' }, user: { _id: 'user1' } });
      const res = createMockRes();
      const next = createMockNext();

      getLyricsById(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('LYRICS_NOT_FOUND');
    });

    it('should return 403 if not owner and not public', async () => {
      const mockLyrics = { _id: 'lyrics1', isPublic: false };
      mockLyrics.user = { toString: () => 'other_user' };
      Lyrics.findById.mockResolvedValue(mockLyrics);

      const req = createMockReq({
        params: { id: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } }
      });
      const res = createMockRes();
      const next = createMockNext();

      getLyricsById(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
    });

    it('should allow access to public lyrics by non-owner', async () => {
      const mockLyrics = { _id: 'lyrics1', isPublic: true };
      mockLyrics.user = { toString: () => 'other_user' };
      Lyrics.findById.mockResolvedValue(mockLyrics);

      const req = createMockReq({
        params: { id: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } }
      });
      const res = createMockRes();
      const next = createMockNext();

      getLyricsById(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // ==================== updateLyrics ====================
  describe('PUT /lyrics/:id', () => {
    it('should update lyrics successfully', async () => {
      const mockLyrics = {
        _id: 'lyrics1', title: 'Old Title', content: 'old',
        isFavorite: false, isPublic: false, rating: null, tags: [],
        save: jest.fn().mockResolvedValue(true)
      };
      mockLyrics.user = { toString: () => 'user1' };
      Lyrics.findById.mockResolvedValue(mockLyrics);

      const req = createMockReq({
        params: { id: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: { title: 'New Title', isFavorite: true }
      });
      const res = createMockRes();
      const next = createMockNext();

      updateLyrics(req, res, next);
      await flushPromises();

      expect(mockLyrics.title).toBe('New Title');
      expect(mockLyrics.isFavorite).toBe(true);
      expect(mockLyrics.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if lyrics not found', async () => {
      Lyrics.findById.mockResolvedValue(null);

      const req = createMockReq({
        params: { id: 'nonexistent' },
        user: { _id: { toString: () => 'user1' } },
        body: { title: 'Test' }
      });
      const res = createMockRes();
      const next = createMockNext();

      updateLyrics(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('LYRICS_NOT_FOUND');
    });

    it('should return 403 if not owner', async () => {
      const mockLyrics = { _id: 'lyrics1' };
      mockLyrics.user = { toString: () => 'other_user' };
      Lyrics.findById.mockResolvedValue(mockLyrics);

      const req = createMockReq({
        params: { id: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: { title: 'Test' }
      });
      const res = createMockRes();
      const next = createMockNext();

      updateLyrics(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
    });
  });

  // ==================== deleteLyrics ====================
  describe('DELETE /lyrics/:id', () => {
    it('should delete lyrics successfully', async () => {
      const mockLyrics = { _id: 'lyrics1', deleteOne: jest.fn().mockResolvedValue(true) };
      mockLyrics.user = { toString: () => 'user1' };
      Lyrics.findById.mockResolvedValue(mockLyrics);

      const req = createMockReq({
        params: { id: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } }
      });
      const res = createMockRes();
      const next = createMockNext();

      deleteLyrics(req, res, next);
      await flushPromises();

      expect(mockLyrics.deleteOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if lyrics not found', async () => {
      Lyrics.findById.mockResolvedValue(null);

      const req = createMockReq({
        params: { id: 'nonexistent' },
        user: { _id: { toString: () => 'user1' } }
      });
      const res = createMockRes();
      const next = createMockNext();

      deleteLyrics(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('LYRICS_NOT_FOUND');
    });

    it('should return 403 if not owner', async () => {
      const mockLyrics = { _id: 'lyrics1' };
      mockLyrics.user = { toString: () => 'other_user' };
      Lyrics.findById.mockResolvedValue(mockLyrics);

      const req = createMockReq({
        params: { id: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } }
      });
      const res = createMockRes();
      const next = createMockNext();

      deleteLyrics(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
    });
  });

  // ==================== toggleFavorite ====================
  describe('PATCH /lyrics/:id/favorite', () => {
    it('should toggle favorite status', async () => {
      const mockLyrics = {
        _id: 'lyrics1', isFavorite: false,
        save: jest.fn().mockResolvedValue(true)
      };
      mockLyrics.user = { toString: () => 'user1' };
      Lyrics.findById.mockResolvedValue(mockLyrics);

      const req = createMockReq({
        params: { id: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } }
      });
      const res = createMockRes();
      const next = createMockNext();

      toggleFavorite(req, res, next);
      await flushPromises();

      expect(mockLyrics.isFavorite).toBe(true);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.isFavorite).toBe(true);
    });

    it('should return 404 if lyrics not found', async () => {
      Lyrics.findById.mockResolvedValue(null);

      const req = createMockReq({
        params: { id: 'nonexistent' },
        user: { _id: { toString: () => 'user1' } }
      });
      const res = createMockRes();
      const next = createMockNext();

      toggleFavorite(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('LYRICS_NOT_FOUND');
    });

    it('should return 403 if not owner', async () => {
      const mockLyrics = { _id: 'lyrics1' };
      mockLyrics.user = { toString: () => 'other_user' };
      Lyrics.findById.mockResolvedValue(mockLyrics);

      const req = createMockReq({
        params: { id: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } }
      });
      const res = createMockRes();
      const next = createMockNext();

      toggleFavorite(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
    });
  });

  // ==================== getStats ====================
  describe('GET /lyrics/stats', () => {
    it('should return user lyrics stats', async () => {
      const mockStats = { totalLyrics: 10, favorites: 3, styleBreakdown: { romantic: 5 } };
      Lyrics.getUserStats.mockResolvedValue(mockStats);

      const req = createMockReq({ user: { _id: 'user1' } });
      const res = createMockRes();
      const next = createMockNext();

      getStats(req, res, next);
      await flushPromises();

      expect(Lyrics.getUserStats).toHaveBeenCalledWith('user1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toEqual(mockStats);
    });
  });

  // ==================== getPublicLyrics ====================
  describe('GET /lyrics/public', () => {
    it('should return public lyrics with default limit', async () => {
      const mockLyrics = [{ title: 'Public Song' }];
      Lyrics.getPopular.mockResolvedValue(mockLyrics);

      const req = createMockReq({ query: {} });
      const res = createMockRes();
      const next = createMockNext();

      getPublicLyrics(req, res, next);
      await flushPromises();

      expect(Lyrics.getPopular).toHaveBeenCalledWith(10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].count).toBe(1);
    });

    it('should respect custom limit', async () => {
      Lyrics.getPopular.mockResolvedValue([]);

      const req = createMockReq({ query: { limit: '5' } });
      const res = createMockRes();
      const next = createMockNext();

      getPublicLyrics(req, res, next);
      await flushPromises();

      expect(Lyrics.getPopular).toHaveBeenCalledWith(5);
    });
  });
});
