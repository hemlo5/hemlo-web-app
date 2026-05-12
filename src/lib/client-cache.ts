"use client";

type CacheRecord<T> = {
  data: T;
  expiresAt: number;
};

const CACHE_PREFIX = "hemlo:client-cache:v1:";
const memoryCache = new Map<string, CacheRecord<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function now() {
  return Date.now();
}

function storageKey(key: string) {
  return `${CACHE_PREFIX}${key}`;
}

export function readClientCache<T>(key: string): T | null {
  const record = memoryCache.get(key) as CacheRecord<T> | undefined;
  if (record && record.expiresAt > now()) return record.data;

  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheRecord<T>;
    if (!parsed || parsed.expiresAt <= now()) {
      window.sessionStorage.removeItem(storageKey(key));
      return null;
    }
    memoryCache.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeClientCache<T>(key: string, data: T, ttlMs = 60_000) {
  const record: CacheRecord<T> = { data, expiresAt: now() + ttlMs };
  memoryCache.set(key, record);

  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(key), JSON.stringify(record));
  } catch {
    // Storage may be unavailable or full; memory cache still keeps this session smooth.
  }
}

export async function cachedJson<T>(
  url: string,
  options: RequestInit & { ttlMs?: number; cacheKey?: string; force?: boolean } = {},
): Promise<T> {
  const { ttlMs = 60_000, cacheKey = url, force = false, ...fetchOptions } = options;

  if (!force) {
    const cached = readClientCache<T>(cacheKey);
    if (cached) return cached;
  }

  const running = inflight.get(cacheKey) as Promise<T> | undefined;
  if (running) return running;

  const request = fetch(url, fetchOptions)
    .then((res) => {
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      return res.json() as Promise<T>;
    })
    .then((data) => {
      writeClientCache(cacheKey, data, ttlMs);
      return data;
    })
    .finally(() => {
      inflight.delete(cacheKey);
    });

  inflight.set(cacheKey, request);
  return request;
}
