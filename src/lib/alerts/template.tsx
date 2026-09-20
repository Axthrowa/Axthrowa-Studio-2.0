/** Alert şablon motoru — {name}/{amount} yeşil çip vurgusu */

import type { ReactNode } from "react";

const VAR_RE = /(\{name\}|\{user\}|\{amount\}|\{message\})/gi;

export function renderTemplateNodes(
  template: string,
  vars: { name?: string; amount?: string | number; message?: string },
  colors: { text: string; highlight: string }
): ReactNode[] {
  const parts = template.split(VAR_RE);
  return parts.filter(Boolean).map((part, i) => {
    const key = part.toLowerCase();
    if (key === "{name}" || key === "{user}") {
      return (
        <span
          key={`v-${i}`}
          className="inline-block rounded-md px-1.5 py-0.5 font-extrabold"
          style={{ color: colors.highlight, background: `${colors.highlight}22` }}
        >
          {vars.name || "İsim"}
        </span>
      );
    }
    if (key === "{amount}") {
      return (
        <span
          key={`v-${i}`}
          className="inline-block rounded-md px-1.5 py-0.5 font-extrabold"
          style={{ color: colors.highlight, background: `${colors.highlight}22` }}
        >
          {vars.amount != null && vars.amount !== "" ? String(vars.amount) : "0"}
        </span>
      );
    }
    if (key === "{message}") {
      return (
        <span key={`v-${i}`} style={{ color: colors.text, opacity: 0.85 }}>
          {vars.message || ""}
        </span>
      );
    }
    return (
      <span key={`t-${i}`} style={{ color: colors.text }}>
        {part}
      </span>
    );
  });
}

/** Editörde değişken çiplerini vurgula (ham şablon) */
export function highlightTemplateEditor(template: string): ReactNode[] {
  const parts = template.split(VAR_RE);
  return parts.filter(Boolean).map((part, i) => {
    if (/^\{(name|user|amount|message)\}$/i.test(part)) {
      return (
        <span
          key={i}
          className="mx-0.5 inline-flex rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export const TEMPLATE_CHIPS = ["{name}", "{amount}", "{message}"] as const;
