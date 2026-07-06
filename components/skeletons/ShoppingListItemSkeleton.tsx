import React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export function ShoppingListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 animate-pulse">
      <Skeleton className="w-6 h-6 rounded-full shrink-0" />
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="w-6 h-5" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
    </div>
  );
}
