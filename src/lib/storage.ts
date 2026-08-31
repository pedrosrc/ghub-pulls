import type { PullsResult } from '../core/types';

const TOKEN_KEY = 'github_token';
const CACHE_KEY = 'pulls_cache';

export async function getToken(): Promise<string | null> {
  const stored = await chrome.storage.local.get(TOKEN_KEY);
  const token = stored[TOKEN_KEY];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export async function setToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_KEY]: token.trim() });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove(TOKEN_KEY);
  await clearCache();
}

export async function getCache(): Promise<PullsResult | null> {
  try {
    const stored = await chrome.storage.session.get(CACHE_KEY);
    return (stored[CACHE_KEY] as PullsResult | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function setCache(result: PullsResult): Promise<void> {
  try {
    await chrome.storage.session.set({ [CACHE_KEY]: result });
  } catch {
  }
}

export async function clearCache(): Promise<void> {
  try {
    await chrome.storage.session.remove(CACHE_KEY);
  } catch {
  }
}

export function maskToken(token: string): string {
  const tail = token.slice(-4);
  return `${'•'.repeat(12)}${tail}`;
}
