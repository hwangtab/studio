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

const runRedisPipeline = async (
  config: RedisRestConfig,
  commands: ReadonlyArray<readonly string[]>,
): Promise<unknown[]> => {
  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new RedisRestError(`pipeline failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload)) {
    throw new RedisRestError('pipeline returned an invalid result');
  }
  return payload;
};

export const incrWithExpire = async ({
  key,
  windowSeconds,
  config = getRedisRestConfig() ?? undefined,
}: IncrWithExpireOptions): Promise<number> => {
  if (!config) {
    throw new RedisRestError('Redis REST is not configured');
  }

  // INCR과 EXPIRE를 단일 파이프라인 요청으로 원자 실행한다. 두 명령을 별도 HTTP로
  // 보내면 INCR 직후 인스턴스가 죽거나 EXPIRE가 네트워크 실패할 때 키가 TTL 없이
  // 영구 잔존해 해당 IP가 영구 차단되는 사고가 발생한다. EXPIRE ... NX는 TTL이
  // 이미 있으면 덮어쓰지 않아 고정 윈도우(첫 요청 기준 만료) 의미를 보존한다.
  const results = await runRedisPipeline(config, [
    ['INCR', key],
    ['EXPIRE', key, String(windowSeconds), 'NX'],
  ]);

  const first = results[0] as { result?: unknown; error?: unknown } | undefined;
  if (!first || typeof first.result !== 'number') {
    throw new RedisRestError('INCR returned an invalid result');
  }
  return first.result;
};
