import { AppError } from './errors.js';
// Single backend process: serialize ingestion, snapshots and broadcasts to avoid stale snapshots.
export function createQueue(limit = 500) {
  let tail = Promise.resolve();
  let pending = 0;
  return {
    run(task) {
      if (pending >= limit) return Promise.reject(new AppError('BUSY', 'Server is busy; retry later.'));
      pending++;
      const result = tail.then(task);
      tail = result.catch(() => {}).finally(() => { pending--; });
      return result;
    },
    drain: () => tail,
  };
}
