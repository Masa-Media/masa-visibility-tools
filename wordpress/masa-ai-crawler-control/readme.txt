=== Masa AI Crawler Control ===
Contributors: masamedia
Tags: ai, gptbot, robots.txt, seo, llms.txt
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.2
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Choose which AI crawlers may access your site — GPTBot, ClaudeBot, PerplexityBot, Google-Extended and more — from one settings screen.

== Description ==

Masa AI Crawler Control gives you a single screen to decide which AI crawlers may read your website. Tick a crawler to block it; leave it unticked to keep it allowed. The plugin writes clean, standard rules into your site's robots.txt — no manual editing.

It covers the crawlers that decide whether your content can appear in AI answers and whether it can be used for AI training:

* OpenAI — GPTBot, OAI-SearchBot, ChatGPT-User
* Anthropic — ClaudeBot, anthropic-ai
* Perplexity — PerplexityBot, Perplexity-User
* Google — Google-Extended (Gemini / AI Overviews training)
* Common Crawl — CCBot
* ByteDance — Bytespider
* Amazon — Amazonbot
* Apple — Applebot-Extended
* Meta — meta-externalagent

It can also publish an optional **llms.txt** — a plain-text summary of your site (title, description and key pages) that AI answer engines can read.

Nothing is blocked until you choose. The plugin collects no data and calls no external service. Made by [Masa Media Digital LTD](https://masamedia.co.il), an SEO, GEO and AI-visibility studio.

== Installation ==

1. Upload the plugin to `/wp-content/plugins/masa-ai-crawler-control/`, or install it from the Plugins screen.
2. Activate it.
3. Go to **Settings → AI Crawler Control** and tick the crawlers you want to block.

The robots.txt rules work when WordPress serves a virtual robots.txt (i.e. there is no physical `robots.txt` file at your site root). If you have a physical file, add the rules there instead.

== Frequently Asked Questions ==

= Does blocking a crawler remove my site from AI answers? =

Blocking GPTBot or Google-Extended stops that company using your pages for AI training and, for some crawlers, from citing you in AI answers. Allowing them keeps you eligible. The right choice depends on your strategy — this plugin just makes it a one-click decision.

= Will this affect Google Search rankings? =

No. Google-Extended controls Gemini / AI Overviews training only; it is separate from Googlebot, which handles Search. Blocking Google-Extended does not affect classic Search indexing.

= Does the plugin phone home? =

No. It stores your choices in your database and does nothing else. No tracking, no analytics, no external requests.

== Screenshots ==

1. The settings screen: one toggle per AI crawler, grouped by company.
2. The generated llms.txt.

== Changelog ==

= 0.1.0 =
* First release: per-crawler robots.txt control for 13 AI crawlers, optional llms.txt.
