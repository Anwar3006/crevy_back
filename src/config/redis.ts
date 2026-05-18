import Redis from 'ioredis';
import settings from './settings';
import { pinoLogger } from './logger';

const redisUrl = settings.REDIS_URL;

const redis = redisUrl 
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    })
  : null;

if (redis) {
  redis.on('connect', () => {
    pinoLogger.info('Redis connected successfully');
  });

  redis.on('error', (err: any) => {
    pinoLogger.error('Redis connection error:', err);
  });
} else {
  pinoLogger.warn('REDIS_URL not provided. Redis caching is disabled.');
}

export default redis;
