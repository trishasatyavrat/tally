import Link from "next/link";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/import", label: "Import" },
];

export function Nav({ current }: { current: string }) {
  return (
    <nav className="mb-6 flex items-center gap-4 text-sm">
      <span className="font-semibold">tally</span>
      {LINKS.map((l) => (
        <Link
          key={l.href} href={l.href}
          className={l.href === current ? "text-zinc-900 underline" : "text-zinc-500 hover:text-zinc-900"}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
