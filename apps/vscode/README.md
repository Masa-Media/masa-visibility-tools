# Masa Web Audit — VS Code extension

Audit the HTML file you're editing, or any live URL, for **SEO, GEO / AI-visibility, structured data, hreflang and AI-crawler access** — in a panel beside your code. By **[Masa Media Digital LTD](https://masamedia.co.il)**.

## Commands

- **Masa: Audit current HTML file** — analyses the active file's markup.
- **Masa: Audit a URL** — fetches a URL (and its robots.txt) and reports, including the AI-crawler access grid.

Open the Command Palette (`Cmd/Ctrl+Shift+P`) and type "Masa".

## What it reports

Title, meta description (with lengths), canonical (self vs cross), indexability, H1 and heading structure, images missing `alt`, internal/external links and `nofollow`, JSON-LD schema types, Open Graph, hreflang, and per-crawler AI access (GPTBot, ClaudeBot, PerplexityBot, Google-Extended and more) — each with a prioritised findings list.

## Privacy

The extension analyses the file you're editing locally. "Audit a URL" fetches only the URL you enter and its robots.txt. Nothing is sent to Masa Media or anyone else; no telemetry.

Built on [`@masamedia/audit-core`](https://www.npmjs.com/package/@masamedia/audit-core).

## License

MIT © Masa Media Digital LTD
