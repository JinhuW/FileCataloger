/**
 * IPC Rate Limiter
 *
 * Provides rate limiting functionality for IPC channels to prevent abuse
 * and ensure application stability under high message volume.
 */

export interface RateLimitConfig {
  maxCallsPerSecond: number;
  maxCallsPerMinute: number;
  burstAllowance: number; // Allow short bursts above the per-second limit
  blacklistDuration: number; // Duration to blacklist after exceeding limits (ms)
}

export interface RateLimitResult {
  allowed: boolean;
  remainingCalls: number;
  resetTime: number;
  reason?: string;
}

export class IPCRateLimiter {
  private channelCalls = new Map<string, number[]>();
  private channelMinuteCalls = new Map<string, number[]>();
  private blacklistedChannels = new Map<string, number>(); // channel -> blacklist end time
  private config: RateLimitConfig;

  private readonly DEFAULT_CONFIG: RateLimitConfig = {
    maxCallsPerSecond: 100,
    maxCallsPerMinute: 1000,
    burstAllowance: 20, // Allow 20 extra calls in short bursts
    blacklistDuration: 30000, // 30 seconds
  };

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if an IPC call should be allowed
   */
  checkRateLimit(channel: string, senderId?: string): RateLimitResult {
    const now = Date.now();
    const key = senderId ? `${channel}:${senderId}` : channel;

    // Check if channel is blacklisted
    const blacklistEnd = this.blacklistedChannels.get(key);
    if (blacklistEnd && now < blacklistEnd) {
      return {
        allowed: false,
        remainingCalls: 0,
        resetTime: blacklistEnd,
        reason: 'Channel temporarily blacklisted due to rate limit violations',
      };
    }

    // Clean up expired blacklist entries
    if (blacklistEnd && now >= blacklistEnd) {
      this.blacklistedChannels.delete(key);
    }

    // Get call history for this channel
    const secondCalls = this.channelCalls.get(key) || [];
    const minuteCalls = this.channelMinuteCalls.get(key) || [];

    // Remove calls older than 1 second
    const recentSecondCalls = secondCalls.filter(time => now - time < 1000);

    // Remove calls older than 1 minute
    const recentMinuteCalls = minuteCalls.filter(time => now - time < 60000);

    // Check per-second limit (with burst allowance)
    const maxSecondCalls = this.config.maxCallsPerSecond + this.config.burstAllowance;
    if (recentSecondCalls.length >= maxSecondCalls) {
      // Blacklist if severely exceeding limits
      if (recentSecondCalls.length > maxSecondCalls * 1.5) {
        this.blacklistedChannels.set(key, now + this.config.blacklistDuration);
        return {
          allowed: false,
          remainingCalls: 0,
          resetTime: now + this.config.blacklistDuration,
          reason: 'Rate limit severely exceeded - channel blacklisted',
        };
      }

      return {
        allowed: false,
        remainingCalls: 0,
        resetTime: now + 1000 - (now - recentSecondCalls[0]),
        reason: 'Per-second rate limit exceeded',
      };
    }

    // Check per-minute limit
    if (recentMinuteCalls.length >= this.config.maxCallsPerMinute) {
      return {
        allowed: false,
        remainingCalls: 0,
        resetTime: now + 60000 - (now - recentMinuteCalls[0]),
        reason: 'Per-minute rate limit exceeded',
      };
    }

    // Allow the call and record it
    recentSecondCalls.push(now);
    recentMinuteCalls.push(now);

    this.channelCalls.set(key, recentSecondCalls);
    this.channelMinuteCalls.set(key, recentMinuteCalls);

    return {
      allowed: true,
      remainingCalls: Math.min(
        maxSecondCalls - recentSecondCalls.length,
        this.config.maxCallsPerMinute - recentMinuteCalls.length
      ),
      resetTime: now + 1000,
    };
  }

  /**
   * Get rate limit statistics for a channel
   */
  getChannelStats(
    channel: string,
    senderId?: string
  ): {
    callsLastSecond: number;
    callsLastMinute: number;
    isBlacklisted: boolean;
    blacklistEndTime?: number;
  } {
    const now = Date.now();
    const key = senderId ? `${channel}:${senderId}` : channel;

    const secondCalls = this.channelCalls.get(key) || [];
    const minuteCalls = this.channelMinuteCalls.get(key) || [];

    const recentSecondCalls = secondCalls.filter(time => now - time < 1000);
    const recentMinuteCalls = minuteCalls.filter(time => now - time < 60000);

    const blacklistEnd = this.blacklistedChannels.get(key);
    const isBlacklisted = blacklistEnd ? now < blacklistEnd : false;

    return {
      callsLastSecond: recentSecondCalls.length,
      callsLastMinute: recentMinuteCalls.length,
      isBlacklisted,
      blacklistEndTime: isBlacklisted ? blacklistEnd : undefined,
    };
  }

  /**
   * Manually clear rate limit history for a channel
   */
  clearChannelHistory(channel: string, senderId?: string): void {
    const key = senderId ? `${channel}:${senderId}` : channel;
    this.channelCalls.delete(key);
    this.channelMinuteCalls.delete(key);
    this.blacklistedChannels.delete(key);
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  cleanup(): void {
    const now = Date.now();

    // Clean up old call records
    for (const [key, calls] of this.channelCalls.entries()) {
      const recentCalls = calls.filter(time => now - time < 1000);
      if (recentCalls.length === 0) {
        this.channelCalls.delete(key);
      } else {
        this.channelCalls.set(key, recentCalls);
      }
    }

    for (const [key, calls] of this.channelMinuteCalls.entries()) {
      const recentCalls = calls.filter(time => now - time < 60000);
      if (recentCalls.length === 0) {
        this.channelMinuteCalls.delete(key);
      } else {
        this.channelMinuteCalls.set(key, recentCalls);
      }
    }

    // Clean up expired blacklist entries
    for (const [key, endTime] of this.blacklistedChannels.entries()) {
      if (now >= endTime) {
        this.blacklistedChannels.delete(key);
      }
    }
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    totalActiveChannels: number;
    totalBlacklistedChannels: number;
    totalCallsLastMinute: number;
  } {
    const now = Date.now();
    let totalCallsLastMinute = 0;
    let activeChannels = 0;

    for (const calls of this.channelMinuteCalls.values()) {
      const recentCalls = calls.filter(time => now - time < 60000);
      if (recentCalls.length > 0) {
        totalCallsLastMinute += recentCalls.length;
        activeChannels++;
      }
    }

    const blacklistedChannels = Array.from(this.blacklistedChannels.values()).filter(
      endTime => now < endTime
    ).length;

    return {
      totalActiveChannels: activeChannels,
      totalBlacklistedChannels: blacklistedChannels,
      totalCallsLastMinute,
    };
  }
}

// Singleton instance for global use
export const globalIPCRateLimiter = new IPCRateLimiter();
