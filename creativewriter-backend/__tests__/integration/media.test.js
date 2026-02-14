jest.mock('../../src/models/Lyrics');
jest.mock('../../src/models/ApiKey');
jest.mock('../../src/middleware/usageLimit');
jest.mock('node-fetch');

const Lyrics = require('../../src/models/Lyrics');
const ApiKey = require('../../src/models/ApiKey');
const { incrementUsage } = require('../../src/middleware/usageLimit');
const fetch = require('node-fetch');
const { createMockReq, createMockRes, createMockNext, flushPromises } = require('../helpers/mockExpress');

const {
  generateMusic,
  generateVideo,
  checkVideoStatus,
  checkMusicStatus,
  sunoCallback,
  audioProxy,
  generateVoice,
  getVoices,
  getAvatars
} = require('../../src/controllers/mediaController');

describe('Media Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockLyrics = (owner = 'user1') => {
    const lyrics = {
      _id: 'lyrics1', title: 'Test Song', content: 'Telugu lyrics content',
      style: 'romantic', dialect: 'coastal',
      save: jest.fn().mockResolvedValue(true)
    };
    lyrics.user = { toString: () => owner };
    return lyrics;
  };

  // ==================== generateMusic ====================
  describe('POST /media/:lyricsId/music', () => {
    it('should return 404 if lyrics not found', async () => {
      Lyrics.findById.mockResolvedValue(null);

      const req = createMockReq({ params: { lyricsId: 'nonexistent' }, user: { _id: 'user1' }, body: {} });
      const res = createMockRes();
      const next = createMockNext();

      generateMusic(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('LYRICS_NOT_FOUND');
    });

    it('should return 403 if not owner', async () => {
      Lyrics.findById.mockResolvedValue(mockLyrics('other_user'));

      const req = createMockReq({
        params: { lyricsId: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      generateMusic(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
    });

    it('should return demo mode when no API key configured', async () => {
      Lyrics.findById.mockResolvedValue(mockLyrics());
      ApiKey.getKeyForService.mockResolvedValue(null);

      const req = createMockReq({
        params: { lyricsId: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: { platform: 'suno' }
      });
      const res = createMockRes();
      const next = createMockNext();

      generateMusic(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.demo).toBe(true);
      expect(data.status).toBe('demo');
    });

    it('should generate music with Suno when key available', async () => {
      const lyrics = mockLyrics();
      Lyrics.findById.mockResolvedValue(lyrics);
      ApiKey.getKeyForService
        .mockResolvedValueOnce('suno-key')   // suno
        .mockResolvedValueOnce(null);        // udio
      ApiKey.findOne.mockResolvedValue({ recordUsage: jest.fn().mockResolvedValue(true) });
      incrementUsage.mockResolvedValue();

      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 200,
          data: { taskId: 'task123' }
        })
      });

      const req = createMockReq({
        params: { lyricsId: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: { platform: 'suno' },
        protocol: 'https',
        get: jest.fn().mockReturnValue('localhost:5000')
      });
      const res = createMockRes();
      const next = createMockNext();

      generateMusic(req, res, next);
      await flushPromises();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.sunoapi.org/api/v1/generate',
        expect.objectContaining({ method: 'POST' })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.platform).toBe('suno');
      expect(data.status).toBe('processing');
      expect(incrementUsage).toHaveBeenCalledWith('music', expect.anything());
    });

    it('should handle Suno API error gracefully', async () => {
      Lyrics.findById.mockResolvedValue(mockLyrics());
      ApiKey.getKeyForService
        .mockResolvedValueOnce('suno-key')
        .mockResolvedValueOnce(null);

      fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ msg: 'Server error' })
      });

      const req = createMockReq({
        params: { lyricsId: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: { platform: 'suno' },
        protocol: 'https',
        get: jest.fn().mockReturnValue('localhost:5000')
      });
      const res = createMockRes();
      const next = createMockNext();

      generateMusic(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.status).toBe('error');
    });

    it('should use Udio when platform is udio and key available', async () => {
      Lyrics.findById.mockResolvedValue(mockLyrics());
      ApiKey.getKeyForService
        .mockResolvedValueOnce(null)         // suno
        .mockResolvedValueOnce('udio-key');  // udio
      ApiKey.findOne.mockResolvedValue({ recordUsage: jest.fn().mockResolvedValue(true) });
      incrementUsage.mockResolvedValue();

      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ id: 'track123', audio_url: 'https://audio.url/track.mp3', status: 'completed' })
      });

      const req = createMockReq({
        params: { lyricsId: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: { platform: 'udio' }
      });
      const res = createMockRes();
      const next = createMockNext();

      generateMusic(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.platform).toBe('udio');
    });
  });

  // ==================== generateVideo ====================
  describe('POST /media/:lyricsId/video', () => {
    it('should return 404 if lyrics not found', async () => {
      Lyrics.findById.mockResolvedValue(null);

      const req = createMockReq({ params: { lyricsId: 'nonexistent' }, user: { _id: 'user1' }, body: {} });
      const res = createMockRes();
      const next = createMockNext();

      generateVideo(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('LYRICS_NOT_FOUND');
    });

    it('should return demo mode when no HeyGen key', async () => {
      Lyrics.findById.mockResolvedValue(mockLyrics());
      ApiKey.getKeyForService.mockResolvedValue(null);

      const req = createMockReq({
        params: { lyricsId: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      generateVideo(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.demo).toBe(true);
    });

    it('should generate video with HeyGen when key available', async () => {
      const lyrics = mockLyrics();
      Lyrics.findById.mockResolvedValue(lyrics);
      ApiKey.getKeyForService.mockResolvedValue('heygen-key');
      ApiKey.findOne.mockResolvedValue({ recordUsage: jest.fn().mockResolvedValue(true) });
      incrementUsage.mockResolvedValue();

      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { video_id: 'vid123', status: 'processing' }
        })
      });

      const req = createMockReq({
        params: { lyricsId: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      generateVideo(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.platform).toBe('heygen');
      expect(data.videoId).toBe('vid123');
      expect(incrementUsage).toHaveBeenCalledWith('video', expect.anything());
    });
  });

  // ==================== checkVideoStatus ====================
  describe('GET /media/video/:videoId/status', () => {
    it('should return error when no HeyGen key configured', async () => {
      ApiKey.getKeyForService.mockResolvedValue(null);

      const req = createMockReq({ params: { videoId: 'vid123' } });
      const res = createMockRes();
      const next = createMockNext();

      checkVideoStatus(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('NO_API_KEY');
    });

    it('should return video status', async () => {
      ApiKey.getKeyForService.mockResolvedValue('heygen-key');
      fetch.mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          data: { status: 'completed', video_url: 'https://video.url/vid.mp4', thumbnail_url: 'https://thumb.url', duration: 120 }
        })
      });

      const req = createMockReq({ params: { videoId: 'vid123' } });
      const res = createMockRes();
      const next = createMockNext();

      checkVideoStatus(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.status).toBe('completed');
      expect(data.videoUrl).toBe('https://video.url/vid.mp4');
    });
  });

  // ==================== generateVoice ====================
  describe('POST /media/:lyricsId/voice', () => {
    it('should return 404 if lyrics not found', async () => {
      Lyrics.findById.mockResolvedValue(null);

      const req = createMockReq({ params: { lyricsId: 'nonexistent' }, user: { _id: 'user1' }, body: {} });
      const res = createMockRes();
      const next = createMockNext();

      generateVoice(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('LYRICS_NOT_FOUND');
    });

    it('should return demo mode when no ElevenLabs key', async () => {
      Lyrics.findById.mockResolvedValue(mockLyrics());
      ApiKey.getKeyForService.mockResolvedValue(null);

      const req = createMockReq({
        params: { lyricsId: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      generateVoice(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data.demo).toBe(true);
    });

    it('should generate voice with ElevenLabs when key available', async () => {
      Lyrics.findById.mockResolvedValue(mockLyrics());
      ApiKey.getKeyForService.mockResolvedValue('elevenlabs-key');
      ApiKey.findOne.mockResolvedValue({ recordUsage: jest.fn().mockResolvedValue(true) });
      incrementUsage.mockResolvedValue();

      const mockArrayBuffer = new ArrayBuffer(8);
      fetch.mockResolvedValue({
        ok: true,
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
        headers: { get: jest.fn().mockReturnValue('audio/mpeg') }
      });

      const req = createMockReq({
        params: { lyricsId: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      generateVoice(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.platform).toBe('elevenlabs');
      expect(data.status).toBe('completed');
      expect(data.audioBase64).toBeDefined();
      expect(incrementUsage).toHaveBeenCalledWith('voice', expect.anything());
    });

    it('should handle ElevenLabs API error', async () => {
      Lyrics.findById.mockResolvedValue(mockLyrics());
      ApiKey.getKeyForService.mockResolvedValue('elevenlabs-key');

      fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: jest.fn().mockResolvedValue({ detail: { message: 'Unauthorized' } })
      });

      const req = createMockReq({
        params: { lyricsId: 'lyrics1' },
        user: { _id: { toString: () => 'user1' } },
        body: {}
      });
      const res = createMockRes();
      const next = createMockNext();

      generateVoice(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.status).toBe('error');
    });
  });

  // ==================== getVoices ====================
  describe('GET /media/voices', () => {
    it('should return default voices when no API key', async () => {
      ApiKey.getKeyForService.mockResolvedValue(null);

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      getVoices(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.source).toBe('defaults');
      expect(response.data.length).toBeGreaterThan(0);
    });

    it('should fetch voices from API when key available', async () => {
      ApiKey.getKeyForService.mockResolvedValue('elevenlabs-key');
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          voices: [
            { voice_id: 'v1', name: 'Voice1', labels: { language: 'Telugu' }, category: 'custom' }
          ]
        })
      });

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      getVoices(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.source).toBe('api');
      expect(response.data[0].name).toBe('Voice1');
    });

    it('should fall back to defaults on API error', async () => {
      ApiKey.getKeyForService.mockResolvedValue('elevenlabs-key');
      fetch.mockResolvedValue({ ok: false, status: 500 });

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      getVoices(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.source).toBe('defaults');
      expect(response.warning).toBeDefined();
    });
  });

  // ==================== getAvatars ====================
  describe('GET /media/avatars', () => {
    it('should return default avatars when no API key', async () => {
      ApiKey.getKeyForService.mockResolvedValue(null);

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      getAvatars(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].source).toBe('defaults');
    });

    it('should fetch avatars from API when key available', async () => {
      ApiKey.getKeyForService.mockResolvedValue('heygen-key');
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            avatars: [{ avatar_id: 'av1', avatar_name: 'Avatar1', preview_image_url: 'https://img.url' }]
          }
        })
      });

      const req = createMockReq();
      const res = createMockRes();
      const next = createMockNext();

      getAvatars(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.source).toBe('api');
      expect(response.data[0].name).toBe('Avatar1');
    });
  });

  // ==================== checkMusicStatus ====================
  describe('GET /media/music/:taskId/status', () => {
    it('should return error when no Suno key configured', async () => {
      ApiKey.getKeyForService.mockResolvedValue(null);

      const req = createMockReq({ params: { taskId: 'task123' } });
      const res = createMockRes();
      const next = createMockNext();

      checkMusicStatus(req, res, next);
      await flushPromises();

      expect(next.mock.calls[0][0].code).toBe('NO_API_KEY');
    });

    it('should return music status with songs', async () => {
      ApiKey.getKeyForService.mockResolvedValue('suno-key');
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 200,
          data: {
            status: 'SUCCESS',
            response: {
              sunoData: [
                { id: 's1', title: 'Song1', audioUrl: 'https://audio.url/1.mp3', streamAudioUrl: null, imageUrl: null, duration: 180, tags: 'romantic' }
              ]
            }
          }
        })
      });

      const req = createMockReq({ params: { taskId: 'task123' } });
      const res = createMockRes();
      const next = createMockNext();

      checkMusicStatus(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.json.mock.calls[0][0].data;
      expect(data.status).toBe('completed');
      expect(data.songs).toHaveLength(1);
      expect(data.songs[0].audioUrl).toBe('https://audio.url/1.mp3');
    });

    it('should return processing status for pending tasks', async () => {
      ApiKey.getKeyForService.mockResolvedValue('suno-key');
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: 200,
          data: {
            status: 'PENDING',
            response: { sunoData: [] }
          }
        })
      });

      const req = createMockReq({ params: { taskId: 'task123' } });
      const res = createMockRes();
      const next = createMockNext();

      checkMusicStatus(req, res, next);
      await flushPromises();

      expect(res.json.mock.calls[0][0].data.status).toBe('processing');
    });
  });

  // ==================== sunoCallback ====================
  describe('POST /media/callback/suno', () => {
    it('should acknowledge callback', async () => {
      const req = createMockReq({ body: { taskId: 'task123', status: 'completed' } });
      const res = createMockRes();
      const next = createMockNext();

      sunoCallback(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].success).toBe(true);
    });
  });

  // ==================== audioProxy ====================
  describe('GET /media/audio-proxy', () => {
    it('should return error when URL param is missing', async () => {
      const req = createMockReq({ query: {} });
      const res = createMockRes();
      const next = createMockNext();

      audioProxy(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });

    it('should proxy audio from external URL', async () => {
      const mockArrayBuffer = new ArrayBuffer(16);
      const mockGlobalFetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockImplementation(h => {
            if (h === 'content-type') return 'audio/mpeg';
            if (h === 'content-length') return '16';
            return null;
          })
        },
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer)
      });
      globalThis.fetch = mockGlobalFetch;

      const req = createMockReq({ query: { url: 'https://cdn.suno.com/audio.mp3' } });
      const res = createMockRes();
      res.setHeader = jest.fn();
      const next = createMockNext();

      audioProxy(req, res, next);
      await flushPromises();

      expect(mockGlobalFetch).toHaveBeenCalledWith(
        'https://cdn.suno.com/audio.mp3',
        expect.objectContaining({ redirect: 'follow' })
      );
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
      expect(res.send).toHaveBeenCalled();
    });
  });
});
