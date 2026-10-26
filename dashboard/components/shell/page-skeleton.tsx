import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="flex flex-1 gap-4 p-4">
      <Skeleton className="flex-1 rounded-xl" />
      <Skeleton className="hidden w-[380px] rounded-xl lg:block" />
    </div>
  );
}
