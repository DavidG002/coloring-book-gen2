=== ZuzuPlug ===
Contributors: davidghazy
Tags: yoast, polylang, rest-api, multilingual, seo
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Yoast SEO field support and free-tier Polylang language linking for content published via the WordPress REST API.

== Description ==

ZuzuPlug is a small publishing bridge for sites that create posts and taxonomy terms via the WordPress REST API — for example, from an external content pipeline or headless publishing tool.

It solves three specific gaps that show up when publishing this way:

1. **Yoast SEO fields aren't writable via REST by default.** ZuzuPlug registers the SEO title, meta description, and focus keyphrase fields so they can be set through the REST API.

2. **Polylang's language and translation-linking fields are Pro-only in the REST API.** ZuzuPlug adds two REST endpoints that call Polylang's own free-tier functions directly, so posts and taxonomy terms can be assigned a language and linked as translations of each other — no Polylang Pro required.

3. **Yoast's breadcrumbs can show "Uncategorized" for REST-published content**, even when the real category assignment is correct. This is a known Yoast behavior: content created via the REST API doesn't reliably trigger Yoast's indexable/breadcrumb cache the way saving through the normal editor does. ZuzuPlug automatically rebuilds the relevant indexable data right after it sets a post's or term's language — the moment the previously-missing data becomes available.

A manual "Reindex everything now" button is also included under Settings → ZuzuPlug, as a fallback in case the automatic rebuild ever needs to be re-run for existing content.

= Who this is for =

Developers or tools that publish content to WordPress via the REST API, on sites using Yoast SEO and/or Polylang (free version), who need reliable SEO fields and language linking without upgrading to Polylang Pro.

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/zuzuplug` directory, or install directly through the WordPress plugins screen.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Visit Settings → ZuzuPlug to confirm Polylang and Yoast SEO are detected.
4. Your REST client can now call:
   - `POST /wp-json/zuzuplug/v1/set-post-language` with `post_id`, `lang`, and optionally `translations`
   - `POST /wp-json/zuzuplug/v1/set-term-language` with `term_id`, `lang`, and optionally `translations`

== Frequently Asked Questions ==

= Does this require Polylang Pro? =

No. It specifically works around the free version's REST API limitations using Polylang's own core functions.

= Does this work without Yoast SEO installed? =

The Polylang language-linking endpoints work independently of Yoast. The SEO field registration and automatic indexable rebuilding require Yoast SEO to be active.

= Will the automatic breadcrumb fix break on a Yoast update? =

It's possible — it uses an internal Yoast access pattern that Yoast's own team has indicated may change in the future. If it stops working, the "Reindex everything now" button provides a manual fallback that doesn't depend on it.

== Changelog ==

= 1.1.0 =
* Added automatic Yoast indexable rebuild after language linking, fixing stale breadcrumbs on REST-published content.
* Added admin settings page with status dashboard and manual reindex fallback.

= 1.0.0 =
* Initial release: Yoast SEO field registration, Polylang free-tier post and term language linking.
