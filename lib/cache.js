const store = new Map();

export function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && now - hit.time < ttlMs) return hit.promise;

  const promise = Promise.resolve()
    .then(fn)
    .catch((err) => {
      store.delete(key);
      throw err;
    });

  store.set(key, { time: now, promise });
  return promise;
}
