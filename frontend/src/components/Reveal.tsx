import { ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms before this block animates in. */
  delay?: number;
}

/**
 * Wraps content so it floats up + fades in the first time it scrolls into view
 * (IWC-style). Uses IntersectionObserver and reveals once, then disconnects.
 * Honours prefers-reduced-motion via CSS (see index.css).
 */
export function Reveal({ children, className = '', delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${visible ? 'reveal-visible' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
