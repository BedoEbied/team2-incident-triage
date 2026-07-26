import assert from 'node:assert/strict';
import test from 'node:test';
import * as tokenStoreModule from './tokenStore';

type SecureTokenPort = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
};
type TokenStorage = {
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
};

function getCreateTokenStorage(): (port: SecureTokenPort) => TokenStorage {
  const candidate: unknown = Reflect.get(tokenStoreModule, 'createTokenStorage');
  assert.equal(typeof candidate, 'function');
  return candidate as (port: SecureTokenPort) => TokenStorage;
}

test('reads, writes, and deletes the JWT through one secure key', async () => {
  const createTokenStorage = getCreateTokenStorage();
  const calls: string[] = [];
  const values = new Map<string, string>();
  const port: SecureTokenPort = {
    async getItem(key) {
      calls.push(`get:${key}`);
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      calls.push(`set:${key}`);
      values.set(key, value);
    },
    async deleteItem(key) {
      calls.push(`delete:${key}`);
      values.delete(key);
    }
  };
  const storage = createTokenStorage(port);

  await storage.setToken('signed.jwt.value');
  assert.equal(await storage.getToken(), 'signed.jwt.value');
  await storage.clearToken();
  assert.equal(await storage.getToken(), null);

  assert.deepEqual(calls, [
    'set:team2.jwt',
    'get:team2.jwt',
    'delete:team2.jwt',
    'get:team2.jwt'
  ]);
});
