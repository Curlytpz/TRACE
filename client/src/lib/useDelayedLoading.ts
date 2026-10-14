import { useEffect, useRef, useState } from 'react';

/**
 * Avoids flashing loading affordances for quick requests while keeping a
 * displayed affordance visible long enough to be perceived as intentional.
 */
export function useDelayedLoading(loading: boolean, delay = 150, minimum = 300) {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (loading) {
      timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delay);
    } else if (shownAt.current !== null) {
      const remaining = Math.max(0, minimum - (Date.now() - shownAt.current));
      timer = setTimeout(() => {
        shownAt.current = null;
        setVisible(false);
      }, remaining);
    } else {
      setVisible(false);
    }

    return () => timer && clearTimeout(timer);
  }, [delay, loading, minimum]);

  return visible;
}
