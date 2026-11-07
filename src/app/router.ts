import { useEffect, useState } from 'preact/hooks';

export const MORE_ROUTE = 'more';

const current = () => window.location.hash.replace(/^#\/?/, '').split('/')[0] || '';

export function navigate(id: string): void {
  window.location.hash = `#/${id}`;
}

export function useRoute(): string {
  const [route, setRoute] = useState(current());
  useEffect(() => {
    const listener = () => {
      setRoute(current());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  return route;
}
