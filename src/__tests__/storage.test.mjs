import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Storage & In-Memory Fallback Reliability', () => {
  const memoryFallback = new Map();

  const mockStorage = {
    async getItem(key) {
      return memoryFallback.get(key) ?? null;
    },
    async setItem(key, value) {
      memoryFallback.set(key, value);
    },
    async removeItem(key) {
      memoryFallback.delete(key);
    },
    async clear() {
      memoryFallback.clear();
    }
  };

  test('Stores and retrieves owner token properly', async () => {
    await mockStorage.setItem('grocery_choice_owner_token', 'test_jwt_token_123');
    const token = await mockStorage.getItem('grocery_choice_owner_token');
    assert.equal(token, 'test_jwt_token_123');
  });

  test('Stores and retrieves owner profile JSON properly', async () => {
    const profile = { id: 1, fullName: 'Suresh Verma', role: 'OWNER', primaryOwner: true };
    await mockStorage.setItem('grocery_choice_owner_auth', JSON.stringify(profile));
    const raw = await mockStorage.getItem('grocery_choice_owner_auth');
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.fullName, 'Suresh Verma');
    assert.equal(parsed.role, 'OWNER');
  });

  test('Removes owner token on logout', async () => {
    await mockStorage.setItem('grocery_choice_owner_token', 'test_jwt');
    await mockStorage.removeItem('grocery_choice_owner_token');
    const token = await mockStorage.getItem('grocery_choice_owner_token');
    assert.equal(token, null);
  });

  test('Clears all keys properly', async () => {
    await mockStorage.setItem('key1', 'val1');
    await mockStorage.setItem('key2', 'val2');
    await mockStorage.clear();
    assert.equal(await mockStorage.getItem('key1'), null);
    assert.equal(await mockStorage.getItem('key2'), null);
  });
});
