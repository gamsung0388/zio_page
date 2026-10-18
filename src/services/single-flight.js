// Share only a request that is still running. Never cache an authorization result.
export function singleFlight(run) {
  let pending = null;
  return function (...args) {
    if (!pending)
      pending = Promise.resolve()
        .then(() => run(...args))
        .finally(() => {
          pending = null;
        });
    return pending;
  };
}
