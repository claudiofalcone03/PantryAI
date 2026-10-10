"use client";

import React from "react";

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
  className?: string;
}

/**
 * Renderizza testo formattato in Markdown supportando:
 * - Titoli (#, ##, ###)
 * - Grassetto (**testo**), Corsivo (*testo*), Grassetto Corsivo (***testo***)
 * - Liste puntate (*, -, •) e numerate (1., 2.)
 * - Codice inline (`codice`)
 * - Citazioni (> testo)
 * - Spaziatura intelligente e compatibilità Dark/Light mode
 */
export function MarkdownRenderer({
  content,
  isUser = false,
  className = "",
}: MarkdownRendererProps) {
  if (!content) return null;

  // Parsing inline di grassetto, corsivo e codice
  const renderInline = (text: string): React.ReactNode => {
    // Gestione token inline
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|\*[\s\S]+?\*|`[\s\S]+?`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const raw = match[0];
      if (raw.startsWith("***") && raw.endsWith("***") && raw.length >= 6) {
        parts.push(
          <strong key={`${match.index}-bi`} className="font-bold italic">
            {raw.slice(3, -3)}
          </strong>
        );
      } else if (raw.startsWith("**") && raw.endsWith("**") && raw.length >= 4) {
        parts.push(
          <strong key={`${match.index}-b`} className="font-bold">
            {raw.slice(2, -2)}
          </strong>
        );
      } else if (raw.startsWith("*") && raw.endsWith("*") && raw.length >= 2) {
        parts.push(
          <em key={`${match.index}-i`} className="italic">
            {raw.slice(1, -1)}
          </em>
        );
      } else if (raw.startsWith("`") && raw.endsWith("`") && raw.length >= 2) {
        parts.push(
          <code
            key={`${match.index}-c`}
            className={`px-1 py-0.5 rounded text-[11px] font-mono ${
              isUser
                ? "bg-emerald-700/60 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-700/50"
            }`}
          >
            {raw.slice(1, -1)}
          </code>
        );
      } else {
        parts.push(raw);
      }

      lastIndex = match.index + raw.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length === 0 ? text : parts;
  };

  // Parsing a blocchi riga per riga
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];

  let currentListType: "ul" | "ol" | null = null;
  let currentListItems: React.ReactNode[] = [];

  const flushList = (key: string) => {
    if (!currentListType || currentListItems.length === 0) return;
    if (currentListType === "ul") {
      blocks.push(
        <ul
          key={`ul-${key}`}
          className="my-1.5 space-y-1 list-disc list-inside pl-1 text-inherit"
        >
          {currentListItems}
        </ul>
      );
    } else {
      blocks.push(
        <ol
          key={`ol-${key}`}
          className="my-1.5 space-y-1 list-decimal list-inside pl-1 text-inherit"
        >
          {currentListItems}
        </ol>
      );
    }
    currentListType = null;
    currentListItems = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Linea vuota: flush lista e spazio
    if (!trimmed) {
      flushList(`empty-${index}`);
      return;
    }

    // Titoli Markdown: #, ##, ###
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList(`h-${index}`);
      const level = headingMatch[1]!.length;
      const text = headingMatch[2]!;

      if (level === 1) {
        blocks.push(
          <h3
            key={`h1-${index}`}
            className={`text-base sm:text-lg font-bold mt-2.5 mb-1.5 leading-snug ${
              isUser ? "text-white" : "text-zinc-900 dark:text-zinc-50"
            }`}
          >
            {renderInline(text)}
          </h3>
        );
      } else if (level === 2) {
        blocks.push(
          <h4
            key={`h2-${index}`}
            className={`text-sm sm:text-base font-bold mt-2 mb-1 leading-snug ${
              isUser ? "text-white" : "text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {renderInline(text)}
          </h4>
        );
      } else {
        blocks.push(
          <h5
            key={`h3-${index}`}
            className={`text-xs font-semibold uppercase tracking-wider mt-1.5 mb-0.5 ${
              isUser ? "text-white/90" : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {renderInline(text)}
          </h5>
        );
      }
      return;
    }

    // Separatore orizzontale: --- o ***
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      flushList(`hr-${index}`);
      blocks.push(
        <hr
          key={`hr-${index}`}
          className={`my-2 border-t ${
            isUser ? "border-white/20" : "border-zinc-200 dark:border-zinc-800"
          }`}
        />
      );
      return;
    }

    // Citazione: > citazione
    if (trimmed.startsWith(">")) {
      flushList(`quote-${index}`);
      const quoteText = trimmed.replace(/^>\s*/, "");
      blocks.push(
        <blockquote
          key={`quote-${index}`}
          className={`border-l-2 pl-2.5 my-1.5 italic text-xs ${
            isUser
              ? "border-white/50 text-white/90"
              : "border-emerald-500/60 dark:border-emerald-400/60 text-zinc-600 dark:text-zinc-400"
          }`}
        >
          {renderInline(quoteText)}
        </blockquote>
      );
      return;
    }

    // Lista non ordinata: -, *, •, +
    const ulMatch = trimmed.match(/^[-*•+]\s+(.*)$/);
    if (ulMatch) {
      if (currentListType && currentListType !== "ul") {
        flushList(`switch-ul-${index}`);
      }
      currentListType = "ul";
      currentListItems.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {renderInline(ulMatch[1]!)}
        </li>
      );
      return;
    }

    // Lista ordinata: 1. 2.
    const olMatch = trimmed.match(/^(\d+)[\.)]\s+(.*)$/);
    if (olMatch) {
      if (currentListType && currentListType !== "ol") {
        flushList(`switch-ol-${index}`);
      }
      currentListType = "ol";
      currentListItems.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {renderInline(olMatch[2]!)}
        </li>
      );
      return;
    }

    // Paragrafo normale
    flushList(`p-${index}`);
    blocks.push(
      <p key={`p-${index}`} className="my-1 leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
  });

  // Flush finale di eventuali liste pendenti
  flushList("final");

  return (
    <div
      className={`text-xs sm:text-sm leading-relaxed break-words ${className}`}
    >
      {blocks}
    </div>
  );
}
