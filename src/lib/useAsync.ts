import { useCallback, useEffect, useRef, useState } from "react";

/** Load data with abort-on-change, a retry function and stable loading/error state. */
export function useAsync<T>(loader: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    loaderRef.current(controller.signal).then((value) => {
      if (!controller.signal.aborted) { setData(value); setLoading(false); }
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Couldn't load this data.");
      setLoading(false);
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { data, error, loading, reload, setData };
}
