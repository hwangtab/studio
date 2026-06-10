export interface RedisRestConfig {
  url: string;
  token: string;
}

export interface IncrWithExpireOptions {
  key: string;
  windowSeconds: number;
  config?: RedisRestConfig;
}

export class RedisRestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisRestError';
  }
}

export const getRedisRestConfig = (): RedisRestConfig | null => {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token };
};

const parseResultNumber = async (response: Response, command: string): Promise<number> => {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new RedisRestError(`${command} failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const payload = await response.json().catch(() => null) as { result?: unknown } | null;
  if (!payload || typeof payload.result !== 'number') {
    throw new RedisRestError(`${command} returned an invalid result`);
  }
  return payload.result;
};

const runRedisCommand = async (
  config: RedisRestConfig,
  command: string,
  segments: readonly string[],
): Promise<number> => {
  const path = [command, ...segments.map((segment) => encodeURIComponent(segment))].join('/');
  const response = await fetch(`${config.url}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}` },
    cache: 'no-store',
  });
  return parseResultNumber(response, command);
};

export const incrWithExpire = async ({
  key,
  windowSeconds,
  config = getRedisRestConfig() ?? undefined,
}: IncrWithExpireOptions): Promise<number> => {
  if (!config) {
    throw new RedisRestError('Redis REST is not configured');
  }

  const count = await runRedisCommand(config, 'incr', [key]);
  if (count === 1) {
    await runRedisCommand(config, 'expire', [key, String(windowSeconds)]);
  }
  return count;
};
