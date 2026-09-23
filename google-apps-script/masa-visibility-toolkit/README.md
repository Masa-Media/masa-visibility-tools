# Masa Visibility Toolkit — Google Sheets add-on

On-page SEO and AI-visibility checks as spreadsheet functions. Paste a list of URLs in a column and get titles, canonicals, indexability, schema types and AI-crawler access next to them. By **[Masa Media Digital LTD](https://masamedia.co.il)**.

## Functions

| Function | Returns |
|----------|---------|
| `=MASA_STATUS(url)` | HTTP status code (200, 404, …) |
| `=MASA_TITLE(url)` | The page `<title>` |
| `=MASA_DESCRIPTION(url)` | The meta description |
| `=MASA_CANONICAL(url)` | The canonical URL |
| `=MASA_H1(url)` | The first H1 |
| `=MASA_INDEXABLE(url)` | TRUE unless `meta robots` says noindex |
| `=MASA_SCHEMA_TYPES(url)` | JSON-LD types, comma-separated |
| `=MASA_AI_ACCESS(url, "GPTBot")` | allowed / blocked / partial / unspecified |

Example: with URLs in `A2:A50`, put `=MASA_TITLE(A2)` in `B2`, `=MASA_AI_ACCESS(A2,"GPTBot")` in `C2`, and fill down.

Responses are cached briefly so filling a column doesn't refetch the same page repeatedly.

## Install (for development, via clasp)

```bash
npm install -g @google/clasp
clasp login                       # opens Google auth (manual, one-time)
cd google-apps-script/masa-visibility-toolkit
clasp create --title "Masa Visibility Toolkit" --type sheets --rootDir .
clasp push
```

Then open the bound spreadsheet; the functions are available immediately, and a **Masa Visibility** menu appears.

To distribute publicly on the **Google Workspace Marketplace**, you additionally need an OAuth consent screen and Google's app verification (a manual review) — see the project docs.

## Privacy

The functions fetch only the URLs you pass and their robots.txt, using the `script.external_request` scope. No data is sent to Masa Media or anyone else.

## License

MIT © Masa Media Digital LTD
