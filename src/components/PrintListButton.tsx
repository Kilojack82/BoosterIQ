import Link from 'next/link';

export function PrintListButton({ eventId }: { eventId: string | null }) {
  const href = eventId ? `/shopping-list/print?event=${eventId}` : '/shopping-list/print';
  return (
    <Link
      href={href}
      className="bg-royal hover:bg-royal/90 transition-colors block w-full text-center text-white font-semibold rounded-lg py-3"
    >
      Print shopping list ↗
    </Link>
  );
}
