import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export function ProductListItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-2 sm:p-2.5 sm:px-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-xs border border-zinc-200 dark:border-zinc-800 min-h-[80px] sm:min-h-[84px] h-[80px] sm:h-[84px] animate-pulse">
      <div className="flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0 pr-2">
        <Skeleton className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4 rounded-md" />
          <Skeleton className="h-3 w-1/3 rounded-md" />
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="w-16 h-8 rounded-lg" />
        <Skeleton className="w-8 h-8 rounded-xl" />
        <Skeleton className="w-3 h-3 rounded-full ml-1" />
      </div>
    </div>
  );
}
