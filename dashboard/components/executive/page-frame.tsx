/** The scrolling container every executive page sits in, so all of them line up. */
export function PageFrame({ children, spacing = "space-y-8" }: { children: React.ReactNode; spacing?: string }) {
  return (
    <div data-testid="page-frame" className="min-h-0 flex-1 overflow-y-auto">
      <div className={`mx-auto max-w-6xl ${spacing} p-4 md:p-6`}>{children}</div>
    </div>
  );
}
