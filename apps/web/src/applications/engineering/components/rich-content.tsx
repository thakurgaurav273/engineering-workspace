"use client";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { MENTION_HREF_PREFIX } from "@/applications/engineering/lib/editor-extensions";
import { cn } from "@grovyn/utils";

/**
 * Read-only renderer for a stored comment/update body (markdown). Mirrors the markdown
 * styling used elsewhere, and renders @mention links (`[@Name](mention:<id>)`) as chips
 * that route to the mentioned person. Shared by both comment surfaces.
 */
const components: Components = {
  p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
  ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5 first:mt-0">{children}</ul>,
  ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5 first:mt-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  code: ({ children }) => (
    <code className="rounded bg-surface px-1 py-0.5 font-mono-num text-[12px]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-md bg-surface p-3 text-[12px] first:mt-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-border pl-3 text-muted-foreground first:mt-0">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => {
    if (typeof href === "string" && href.startsWith(MENTION_HREF_PREFIX)) {
      const id = href.slice(MENTION_HREF_PREFIX.length);
      return (
        <Link
          href={`/people/${id}`}
          className="rounded bg-info/10 px-1 py-0.5 font-medium text-info no-underline hover:bg-info/20"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-info underline underline-offset-2 hover:no-underline"
      >
        {children}
      </a>
    );
  },
};

export function RichContent({ body, className }: { body: string; className?: string }) {
  return (
    <div className={cn("text-[13px] leading-relaxed text-foreground", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
