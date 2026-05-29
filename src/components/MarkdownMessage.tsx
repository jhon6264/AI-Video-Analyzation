"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "./CodeBlock";

type MarkdownMessageProps = {
  content: string;
};

const markdownComponents: Components = {
  a({ children, href }) {
    return (
      <a
        className="font-medium text-green-300 underline decoration-green-900 decoration-1 underline-offset-4 transition hover:text-green-200"
        href={href}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="rounded-r-md border-l-2 border-zinc-700 bg-zinc-950/60 py-2 pl-4 pr-3 text-sm leading-7 text-zinc-400">
        {children}
      </blockquote>
    );
  },
  code({ children, className }) {
    const match = /language-(\S+)/.exec(className ?? "");
    const text = String(children);

    if (className?.includes("language-")) {
      return <CodeBlock language={match?.[1]}>{text}</CodeBlock>;
    }

    return (
      <code className="rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-100">
        {children}
      </code>
    );
  },
  h1({ children }) {
    return (
      <h1 className="pt-1 text-[1.625rem] font-semibold leading-tight tracking-normal text-zinc-50">
        {children}
      </h1>
    );
  },
  h2({ children }) {
    return (
      <h2 className="pt-3 text-xl font-semibold leading-snug tracking-normal text-zinc-50">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return (
      <h3 className="pt-2 text-base font-semibold leading-snug tracking-normal text-zinc-100">
        {children}
      </h3>
    );
  },
  hr() {
    return <hr className="my-7 border-0 border-t border-zinc-800" />;
  },
  li({ children }) {
    return <li className="pl-1 leading-7">{children}</li>;
  },
  ol({ children }) {
    return (
      <ol className="ml-5 list-decimal space-y-1.5 marker:text-zinc-500">
        {children}
      </ol>
    );
  },
  p({ children }) {
    return <p className="text-sm leading-7 text-zinc-300">{children}</p>;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  table({ children }) {
    return (
      <div className="my-5 overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950/40">
        <table className="w-full border-collapse text-left text-sm leading-6">
          {children}
        </table>
      </div>
    );
  },
  td({ children }) {
    return (
      <td className="border-t border-zinc-800 px-3 py-2.5 text-zinc-300">
        {children}
      </td>
    );
  },
  th({ children }) {
    return (
      <th className="border-b border-zinc-800 bg-zinc-950 px-3 py-2.5 font-semibold text-zinc-100">
        {children}
      </th>
    );
  },
  ul({ children }) {
    return (
      <ul className="ml-5 list-disc space-y-1.5 marker:text-zinc-500">
        {children}
      </ul>
    );
  },
};

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="markdown-message max-w-none space-y-4 break-words text-sm leading-7 text-zinc-300">
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
