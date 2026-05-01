'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-royal hover:bg-royal/90 text-white font-semibold rounded-lg px-4 py-2 text-sm"
    >
      Print / Save as PDF
    </button>
  );
}
