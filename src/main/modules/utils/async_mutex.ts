/**
 * Async mutex implementation for preventing concurrent access
 * to critical sections in asynchronous code
 */
export class AsyncMutex {
  private mutex = Promise.resolve();
  private locked = false;

  /**
   * Lock the mutex and execute the provided function
   * Returns the result of the function
   */
  public async runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Acquire the mutex lock
   * Returns a release function that must be called to unlock
   */
  public async acquire(): Promise<() => void> {
    const ticket = new Promise<() => void>(resolve => {
      this.mutex = this.mutex.then(() => {
        return new Promise<void>(release => {
          this.locked = true;
          resolve(() => {
            this.locked = false;
            release();
          });
        });
      });
    });

    return await ticket;
  }

  /**
   * Check if the mutex is currently locked
   */
  public isLocked(): boolean {
    return this.locked;
  }

  /**
   * Try to acquire the lock without waiting
   * Returns null if already locked
   */
  public tryAcquire(): (() => void) | null {
    if (this.locked) {
      return null;
    }

    const release = () => {
      this.locked = false;
    };
    this.locked = true;
    return release;
  }
}

/**
 * Decorator for methods that need mutex protection
 */
export function WithMutex(mutexPropertyName: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: unknown, ...args: any[]) {
      const mutex: AsyncMutex = this[mutexPropertyName];
      if (!mutex || !(mutex instanceof AsyncMutex)) {
        throw new Error(
          `Mutex property '${mutexPropertyName}' not found or not an AsyncMutex instance`
        );
      }

      return await mutex.runExclusive(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
