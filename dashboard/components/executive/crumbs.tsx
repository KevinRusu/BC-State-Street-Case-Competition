import Link from "next/link";

/** The trail above a page's heading; the last item is the page itself and has no link. */
export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>›</span>}
            {item.href ? (
              <Link href={item.href} className="text-brand-line underline-offset-2 hover:underline">{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
