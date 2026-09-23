# Masa Search Inspector

One-click on-page **SEO, GEO / AI-visibility and structured-data** inspector for Chrome, Edge and Firefox. By **[Masa Media Digital LTD](https://masamedia.co.il)**.

Click the toolbar icon on any page and see, instantly:

- **Overview** — title, meta description, canonical (self vs cross), indexability, H1, heading counts, images/alt, schema types.
- **GEO** — whether GPTBot, ClaudeBot, PerplexityBot, Google-Extended and ten other AI crawlers are **allowed, blocked or partially blocked** by the site's robots.txt.
- **Schema** — every JSON-LD `@type`, with invalid blocks flagged.
- **Social** — Open Graph, Twitter cards, hreflang.
- **Links** — internal vs external, external `nofollow`.
- **Findings** — a prioritised list of issues, each with a category.

It reads the **live, rendered DOM**, so it reflects client-side rendering — exactly what an AI crawler sees once JavaScript runs.

## Privacy

Everything runs locally in your browser. The extension analyses the page you are on and fetches that site's `robots.txt`. It sends **nothing** to Masa Media or anyone else, sets no cookies, and uses no analytics. Permissions: `activeTab` and `scripting`, used only when you click the icon. See [PRIVACY.md](PRIVACY.md).

## Build from source

```bash
pnpm install
cd apps/browser-extension
pnpm build        # -> dist/chrome, dist/firefox
pnpm package      # -> zips ready for the stores
```

Load `dist/chrome` unpacked at `chrome://extensions` (Developer mode), or `dist/firefox` via `about:debugging`.

Built on [`@masamedia/audit-core`](../../packages/audit-core).

## License

MIT © Masa Media Digital LTD
