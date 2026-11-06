# Openverse API: evidence

**Read 2026-11-06** from the live schema at `https://api.openverse.org/v1/schema/`. Checked live.

**What it is:** a search engine for openly licensed media, covering Flickr, Wikimedia, museums and others.

## Request

```
GET https://api.openverse.org/v1/images/?q=<q>&license_type=commercial,modification&page_size=<n>
```

- **`license_type`:** one of `all`, `all-cc`, `commercial` or `modification`. `commercial,modification` excludes NC and ND licenses.
- **Mature results** are excluded unless asked for.
- **Result fields:** `title`, `url`, `thumbnail`, `foreign_landing_url`, `creator`, `license` (`by`, `by-sa`, `cc0`, `pdm` and others), `license_version`, `source`, `provider`.

## Limits

These come from the response headers. Anonymous use allows:
- **burst:** 20 requests per minute;
- **sustained:** 200 requests per day.

A registered application, using OAuth client credentials, raises the limits. Registration needs an email: an owner action.

## Live check, 2026-11-06

"Achaemenid Persian soldier relief" returned Flickr photos of Persian warriors and Persepolis bas-reliefs, licensed CC BY 2.0 and CC BY-SA 2.0.
