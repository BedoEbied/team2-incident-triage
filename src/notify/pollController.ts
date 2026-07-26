export type TimerHandle = ReturnType<typeof setInterval>;

export interface TimerScheduler {
  set(callback: () => void, intervalMs: number): TimerHandle;
  clear(handle: TimerHandle): void;
}

export type PollTask = (activeToken: string) => Promise<void>;

export type PollController = {
  start(token: string | null, task: PollTask): () => void;
  stop(): void;
};

export function createPollController(
  scheduler: TimerScheduler,
  intervalMs: number
): PollController {
  let activeHandle: TimerHandle | null = null;

  function stop() {
    if (activeHandle !== null) {
      scheduler.clear(activeHandle);
      activeHandle = null;
    }
  }

  return {
    start(token, task) {
      stop();
      if (!token) {
        return () => undefined;
      }

      void task(token).catch(() => undefined);
      const ownedHandle = scheduler.set(() => {
        void task(token).catch(() => undefined);
      }, intervalMs);
      activeHandle = ownedHandle;
      let cleaned = false;

      return () => {
        if (cleaned) {
          return;
        }
        cleaned = true;
        if (activeHandle === ownedHandle) {
          scheduler.clear(ownedHandle);
          activeHandle = null;
        }
      };
    },
    stop
  };
}
