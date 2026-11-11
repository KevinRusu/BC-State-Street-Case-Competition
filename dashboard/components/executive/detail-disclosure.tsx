import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function DetailDisclosure({ label, accessibleLabel, className, children }: {
  label: string; accessibleLabel?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <Collapsible className={className}>
      <CollapsibleTrigger
        aria-label={accessibleLabel}
        className="group flex min-h-8 items-center gap-1.5 rounded text-left text-xs font-medium text-brand-line hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {label}
        <ChevronDown aria-hidden className="size-3.5 shrink-0 transition-transform group-data-[panel-open]:rotate-180 motion-reduce:transition-none" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}
