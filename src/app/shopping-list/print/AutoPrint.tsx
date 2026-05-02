'use client';

import { useEffect } from 'react';

export function AutoPrint() {
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      window.print();
    });
    return () => window.cancelAnimationFrame(id);
  }, []);
  return null;
}

export function ReprintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-3 py-1.5 text-sm"
    >
      Print again
    </button>
  );
}
