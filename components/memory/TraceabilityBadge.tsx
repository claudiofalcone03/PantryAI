"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, ChevronDown, ChevronUp, SlidersHorizontal, CheckCircle2 } from "lucide-react";

interface TraceabilityBadgeProps {
  regime?: string | null;
  principles?: string[] | null;
  className?: string;
  defaultExpanded?: boolean;
}

export function TraceabilityBadge({
  regime,
  principles,
  className = "",
  defaultExpanded = false,
}: TraceabilityBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const hasRegime = Boolean(regime && regime.trim());
  const hasPrinciples = Boolean(principles && principles.length > 0);

  if (!hasRegime && !hasPrinciples) {
    return null;
  }

  return (
    <div className={`inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 hover:bg-emerald-100/70 transition-colors cursor-pointer group"
        title="Mostra preferenze e principi considerati dall'IA per questa ricetta"
      >
        <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
        <span>Personalizzato per te</span>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400 ml-0.5" />
        ) : (
          <ChevronDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400 ml-0.5" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-1.5">
            <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Principi applicati da ZenChef</span>
            </span>
            <Link
              href="/profilo/memoria"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Gestisci memoria →</span>
            </Link>
          </div>

          <div className="space-y-1 text-zinc-700 dark:text-zinc-300">
            {hasRegime && (
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                <span>
                  <strong>Regime:</strong> {regime}
                </span>
              </div>
            )}

            {hasPrinciples && (
              <div className="space-y-1">
                {principles!.map((p, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
