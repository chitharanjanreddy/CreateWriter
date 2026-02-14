describe('Subscription instance methods', () => {
  // We test the method logic directly by creating plain objects
  // that mimic Mongoose documents with the same method implementations

  const createMockSubscription = (usageOverrides = {}, methodOverrides = {}) => {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const sub = {
      usage: {
        lyricsGenerated: 0,
        musicGenerated: 0,
        videoGenerated: 0,
        voiceGenerated: 0,
        periodStart: now,
        periodEnd: periodEnd,
        ...usageOverrides
      },
      save: jest.fn().mockResolvedValue(true),
      ...methodOverrides
    };

    // Attach the same methods from the schema
    sub.checkAndResetUsage = function () {
      const now = new Date();
      if (now > this.usage.periodEnd) {
        this.usage.lyricsGenerated = 0;
        this.usage.musicGenerated = 0;
        this.usage.videoGenerated = 0;
        this.usage.voiceGenerated = 0;
        this.usage.periodStart = now;
        const end = new Date(now);
        end.setMonth(end.getMonth() + 1);
        this.usage.periodEnd = end;
        return true;
      }
      return false;
    };

    sub.checkLimit = function (type, planLimits) {
      const mapping = {
        lyrics: { usage: 'lyricsGenerated', limit: 'lyricsPerMonth' },
        music: { usage: 'musicGenerated', limit: 'musicGenerations' },
        video: { usage: 'videoGenerated', limit: 'videoGenerations' },
        voice: { usage: 'voiceGenerated', limit: 'voiceGenerations' }
      };

      const map = mapping[type];
      if (!map) return { allowed: false, current: 0, limit: 0, remaining: 0 };

      const limit = planLimits[map.limit];
      const current = this.usage[map.usage];

      if (limit === -1) {
        return { allowed: true, current, limit: -1, remaining: -1 };
      }

      if (limit === 0) {
        return { allowed: false, current, limit: 0, remaining: 0 };
      }

      return {
        allowed: current < limit,
        current,
        limit,
        remaining: Math.max(0, limit - current)
      };
    };

    sub.incrementUsage = async function (type) {
      const mapping = {
        lyrics: 'lyricsGenerated',
        music: 'musicGenerated',
        video: 'videoGenerated',
        voice: 'voiceGenerated'
      };

      const field = mapping[type];
      if (!field) return;

      this.usage[field] += 1;
      await this.save();
    };

    return sub;
  };

  // ==================== checkAndResetUsage ====================
  describe('checkAndResetUsage', () => {
    it('should return false when period has not expired', () => {
      const sub = createMockSubscription();
      const result = sub.checkAndResetUsage();
      expect(result).toBe(false);
    });

    it('should reset usage and return true when period has expired', () => {
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 2);
      const pastEnd = new Date(pastDate);
      pastEnd.setMonth(pastEnd.getMonth() + 1);

      const sub = createMockSubscription({
        lyricsGenerated: 10,
        musicGenerated: 5,
        videoGenerated: 3,
        voiceGenerated: 2,
        periodStart: pastDate,
        periodEnd: pastEnd // This is in the past
      });

      const result = sub.checkAndResetUsage();

      expect(result).toBe(true);
      expect(sub.usage.lyricsGenerated).toBe(0);
      expect(sub.usage.musicGenerated).toBe(0);
      expect(sub.usage.videoGenerated).toBe(0);
      expect(sub.usage.voiceGenerated).toBe(0);
    });

    it('should set new period start and end after reset', () => {
      const pastEnd = new Date();
      pastEnd.setMonth(pastEnd.getMonth() - 1);

      const sub = createMockSubscription({
        periodEnd: pastEnd
      });

      const beforeReset = new Date();
      sub.checkAndResetUsage();

      expect(sub.usage.periodStart.getTime()).toBeGreaterThanOrEqual(beforeReset.getTime() - 100);
      expect(sub.usage.periodEnd.getTime()).toBeGreaterThan(sub.usage.periodStart.getTime());
    });

    it('should set periodEnd to approximately one month after reset', () => {
      const pastEnd = new Date();
      pastEnd.setMonth(pastEnd.getMonth() - 1);

      const sub = createMockSubscription({
        periodEnd: pastEnd
      });

      sub.checkAndResetUsage();

      const diffMs = sub.usage.periodEnd.getTime() - sub.usage.periodStart.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      // A month is between 28-31 days
      expect(diffDays).toBeGreaterThanOrEqual(27);
      expect(diffDays).toBeLessThanOrEqual(32);
    });
  });

  // ==================== checkLimit ====================
  describe('checkLimit', () => {
    it('should return allowed=true when under limit', () => {
      const sub = createMockSubscription({ lyricsGenerated: 3 });
      const result = sub.checkLimit('lyrics', { lyricsPerMonth: 5 });

      expect(result).toEqual({
        allowed: true,
        current: 3,
        limit: 5,
        remaining: 2
      });
    });

    it('should return allowed=false when at limit', () => {
      const sub = createMockSubscription({ lyricsGenerated: 5 });
      const result = sub.checkLimit('lyrics', { lyricsPerMonth: 5 });

      expect(result).toEqual({
        allowed: false,
        current: 5,
        limit: 5,
        remaining: 0
      });
    });

    it('should return allowed=false when over limit', () => {
      const sub = createMockSubscription({ lyricsGenerated: 7 });
      const result = sub.checkLimit('lyrics', { lyricsPerMonth: 5 });

      expect(result).toEqual({
        allowed: false,
        current: 7,
        limit: 5,
        remaining: 0
      });
    });

    it('should return allowed=true with limit=-1 (unlimited)', () => {
      const sub = createMockSubscription({ lyricsGenerated: 1000 });
      const result = sub.checkLimit('lyrics', { lyricsPerMonth: -1 });

      expect(result).toEqual({
        allowed: true,
        current: 1000,
        limit: -1,
        remaining: -1
      });
    });

    it('should return allowed=false with limit=0 (not available)', () => {
      const sub = createMockSubscription({ musicGenerated: 0 });
      const result = sub.checkLimit('music', { musicGenerations: 0 });

      expect(result).toEqual({
        allowed: false,
        current: 0,
        limit: 0,
        remaining: 0
      });
    });

    it('should handle music type correctly', () => {
      const sub = createMockSubscription({ musicGenerated: 2 });
      const result = sub.checkLimit('music', { musicGenerations: 5 });

      expect(result.allowed).toBe(true);
      expect(result.current).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(3);
    });

    it('should handle video type correctly', () => {
      const sub = createMockSubscription({ videoGenerated: 10 });
      const result = sub.checkLimit('video', { videoGenerations: 10 });

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle voice type correctly', () => {
      const sub = createMockSubscription({ voiceGenerated: 1 });
      const result = sub.checkLimit('voice', { voiceGenerations: 3 });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should return not-allowed for unknown type', () => {
      const sub = createMockSubscription();
      const result = sub.checkLimit('unknown', { lyricsPerMonth: 5 });

      expect(result).toEqual({
        allowed: false,
        current: 0,
        limit: 0,
        remaining: 0
      });
    });
  });

  // ==================== incrementUsage ====================
  describe('incrementUsage', () => {
    it('should increment lyrics usage by 1', async () => {
      const sub = createMockSubscription({ lyricsGenerated: 3 });
      await sub.incrementUsage('lyrics');

      expect(sub.usage.lyricsGenerated).toBe(4);
      expect(sub.save).toHaveBeenCalledTimes(1);
    });

    it('should increment music usage by 1', async () => {
      const sub = createMockSubscription({ musicGenerated: 1 });
      await sub.incrementUsage('music');

      expect(sub.usage.musicGenerated).toBe(2);
      expect(sub.save).toHaveBeenCalledTimes(1);
    });

    it('should increment video usage by 1', async () => {
      const sub = createMockSubscription({ videoGenerated: 0 });
      await sub.incrementUsage('video');

      expect(sub.usage.videoGenerated).toBe(1);
    });

    it('should increment voice usage by 1', async () => {
      const sub = createMockSubscription({ voiceGenerated: 5 });
      await sub.incrementUsage('voice');

      expect(sub.usage.voiceGenerated).toBe(6);
    });

    it('should not save for unknown type', async () => {
      const sub = createMockSubscription();
      await sub.incrementUsage('invalid');

      expect(sub.save).not.toHaveBeenCalled();
    });

    it('should call save after incrementing', async () => {
      const sub = createMockSubscription({ lyricsGenerated: 0 });
      await sub.incrementUsage('lyrics');

      expect(sub.save).toHaveBeenCalledTimes(1);
    });
  });
});
