'use client';

export function PrintListButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-royal hover:bg-royal/90 transition-colors w-full text-center text-white font-semibold rounded-lg py-3"
    >
      Print list ↗
    </button>
  );
}
