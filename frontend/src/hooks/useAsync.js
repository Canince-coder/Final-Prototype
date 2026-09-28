import { useCallback, useEffect, useState } from "react";

/** Run an async loader on mount / when deps change; exposes {data, loading, error, reload, setData}. */
export default function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    run()
      .then((data) => alive && setState({ data, loading: false, error: "" }))
      .catch((err) => alive && setState({ data: null, loading: false, error: err?.detail || "Please try again." }));
    return () => {
      alive = false;
    };
  }, [run]);

  useEffect(reload, [reload]);

  const setData = (updater) =>
    setState((s) => ({ ...s, data: typeof updater === "function" ? updater(s.data) : updater }));

  return { ...state, reload, setData };
}
