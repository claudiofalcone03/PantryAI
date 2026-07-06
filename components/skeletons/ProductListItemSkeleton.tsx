import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export function ProductListItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 animate-pulse">
      <Skeleton className="w-12 h-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex flex-col items-end space-y-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}
