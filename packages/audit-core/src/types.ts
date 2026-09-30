/**
 * Public types for @masamedia/audit-core.
 * Everything the engine produces is plain JSON-serialisable data so the same
 * report can be rendered in a browser panel, a VS Code diagnostic, a CLI table
 * or a Google Sheets cell.
 */

export type Severity = "error" | "warn" | "info" | "good";

export interface Finding {
  /** Stable id, e.g. "title.missing". Safe to key UI or filters on. */
  id: string;
  severity: Severity;
  /** Grouping bucket: seo | geo | schema | social | i18n | a11y | crawl. */
  category: Category;
  message: string;
  /** Optional observed value, for display. */
  value?: string | number;
}

export type Category =
  | "seo"
  | "geo"
  | "schema"
  | "social"
  | "i18n"
  | "a11y"
  | "crawl";

/** A framework-neutral snapshot of the parts of a page the engine reads. */
export interface Snapshot {
  lang: string | null;
  title: string | null;
  metas: MetaTag[];
  links: LinkTag[];
  headings: Heading[];
  images: ImageTag[];
  anchors: Anchor[];
  jsonLd: string[];
  baseHref: string | null;
}

export interface MetaTag {
  name?: string;
  property?: string;
  httpEquiv?: string;
  content?: string;
}
export interface LinkTag {
  rel?: string;
  href?: string;
  hreflang?: string;
}
export interface Heading {
  level: number;
  text: string;
}
export interface ImageTag {
  src?: string;
  /** null = alt attribute absent; "" = present but empty. */
  alt: string | null;
}
export interface Anchor {
  href?: string;
  rel?: string;
  text: string;
}

export type AiAccess = "allowed" | "blocked" | "partial" | "unspecified";

export interface AiCrawlerReport {
  /**
   * "robots.txt": rules were read. "missing": the site has no robots.txt (a 4xx answer), so every crawler is allowed.
   * "not-fetched": robots.txt was not read (skipped, a 5xx answer or a network error), so access is unknown.
   */
  source: "robots.txt" | "missing" | "not-fetched";
  /** True when robots.txt has a User-agent: * group that applies as fallback. */
  hasWildcardGroup: boolean;
  /** When set, `agents` says whether each crawler may fetch this path; otherwise it summarises the whole site. */
  path?: string;
  agents: Record<string, AiAccess>;
}

export interface AuditReport {
  url: string;
  fetchedAt: string;
  httpStatus?: number;
  title: { text: string | null; length: number };
  metaDescription: { text: string | null; length: number };
  canonical: { href: string | null; isSelf: boolean | null };
  robotsMeta: { content: string | null; index: boolean; follow: boolean };
  indexable: { value: boolean; reasons: string[] };
  headings: {
    h1: string[];
    counts: Record<string, number>;
    outline: Heading[];
  };
  schema: {
    blocks: { valid: boolean; types: string[]; error?: string }[];
    types: string[];
  };
  openGraph: Record<string, string>;
  twitter: Record<string, string>;
  hreflang: { lang: string; href: string }[];
  images: { total: number; missingAlt: number; emptyAlt: number };
  links: { internal: number; external: number; nofollowExternal: number };
  ai: AiCrawlerReport;
  findings: Finding[];
  score: { overall: number; byCategory: Partial<Record<Category, number>> };
}
