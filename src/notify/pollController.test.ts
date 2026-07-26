import assert from 'node:assert/strict';
import test from 'node:test';
import * as pollControllerModule from './pollController';

type TimerHandle = ReturnType<typeof setInterval>;
type Scheduler = {
  set(callback: () => void, intervalMs: number): TimerHandle;
  clear(handle: TimerHandle): void;
};
type PollController = {
  start(token: string | null, task: (activeToken: string) => Promise<void>): () => void;
  stop(): void;
};

function getCreatePollController(): (scheduler: Scheduler, intervalMs: number) => PollController {
  const candidate: unknown = Reflect.get(pollControllerModule, 'createPollController');
  assert.equal(typeof candidate, 'function');
  return candidate as (scheduler: Scheduler, intervalMs: number) => PollController;
}

function fakeScheduler() {
  const callbacks = new Map<TimerHandle, () => void>();
  const cleared: TimerHandle[] = [];
  let nextHandle = 1;

  const scheduler: Scheduler = {
    set(callback) {
      const handle = nextHandle as unknown as TimerHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      return handle;
    },
    clear(handle) {
      cleared.push(handle);
      callbacks.delete(handle);
    }
  };

  return { callbacks, cleared, scheduler };
}

test('does not run or schedule polling without an authenticated token', () => {
  const createPollController = getCreatePollController();
  const fake = fakeScheduler();
  let runs = 0;
  const controller = createPollController(fake.scheduler, 15_000);

  const cleanup = controller.start(null, async () => {
    runs += 1;
  });
  cleanup();

  assert.equal(runs, 0);
  assert.equal(fake.callbacks.size, 0);
  assert.equal(fake.cleared.length, 0);
});

test('cleanup clears the owned interval exactly once', async () => {
  const createPollController = getCreatePollController();
  const fake = fakeScheduler();
  const tokens: string[] = [];
  const controller = createPollController(fake.scheduler, 15_000);

  const cleanup = controller.start('jwt-one', async (token) => {
    tokens.push(token);
  });
  await Promise.resolve();

  assert.deepEqual(tokens, ['jwt-one']);
  assert.equal(fake.callbacks.size, 1);

  cleanup();
  cleanup();

  assert.equal(fake.cleared.length, 1);
  assert.equal(fake.callbacks.size, 0);
});

test('a replacement stops the old interval and stale cleanup cannot stop the new one', () => {
  const createPollController = getCreatePollController();
  const fake = fakeScheduler();
  const controller = createPollController(fake.scheduler, 15_000);

  const firstCleanup = controller.start('jwt-one', async () => undefined);
  const secondCleanup = controller.start('jwt-two', async () => undefined);

  assert.equal(fake.cleared.length, 1);
  assert.equal(fake.callbacks.size, 1);

  firstCleanup();
  assert.equal(fake.cleared.length, 1);
  assert.equal(fake.callbacks.size, 1);

  secondCleanup();
  assert.equal(fake.cleared.length, 2);
  assert.equal(fake.callbacks.size, 0);
});
