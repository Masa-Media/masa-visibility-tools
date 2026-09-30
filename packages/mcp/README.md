# @masamedia/mcp

An MCP server for [Masa Media Digital](https://www.masamedia.co.il), an Israeli SEO and GEO agency. It lets AI assistants (Claude Desktop, Claude Code, Cursor and other MCP clients) look things up on masamedia.co.il: search the agency's Hebrew SEO and GEO articles and glossary, read any page as Markdown, list Google's ranking updates, and get the agency's services, published prices, contact details and case studies.

It is read-only and needs no API key.

## Add it to your assistant

Claude Desktop, Cursor and other clients with an `mcpServers` config:

```json
{
  "mcpServers": {
    "masa-media-digital": {
      "command": "npx",
      "args": ["-y", "@masamedia/mcp"]
    }
  }
}
```

Claude Code:

```bash
claude mcp add masa-media-digital -- npx -y @masamedia/mcp
```

Needs Node.js 20 or later. Clients that support remote MCP servers can connect straight to `https://www.masamedia.co.il/mcp/` instead. This package is the same server for clients that run only local (stdio) servers.

## Tools

| Tool | What it does |
|------|--------------|
| `search` | Searches the site's published pages (services, articles, glossary, case studies) and returns up to 10 results |
| `fetch` | Reads one page of masamedia.co.il as Markdown, by the id that `search` returns or by a path such as `/seo-pricing/` |
| `get_company_info` | Services with page links, published prices (monthly SEO packages in ILS, before VAT), contact details, or case studies |
| `glossary_lookup` | Finds terms in the Hebrew SEO glossary, by part of a term in Hebrew or English |
| `google_updates` | Lists Google's official named ranking updates from the last 12 months, with dates and links |

The tools come from the site, so new ones show up without updating this package.

## Privacy

It sends requests only to www.masamedia.co.il, and only when your assistant calls a tool. It stores nothing. Set `MASA_MCP_URL` to point it at another address (for testing).

## License

MIT © Masa Media Digital LTD
