# Wikimedia Commons API: evidence

**Read 2026-11-06** from `mediawiki.org`: API:Search, API:Imageinfo, Extension:CommonsMetadata and API:Etiquette (raw wikitext). Checked live.

## Request

```
GET https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&generator=search&gsrnamespace=6&gsrsearch=<q> filetype:bitmap
    &gsrlimit=<n>&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=512&iiextmetadatafilter=LicenseShortName|Artist|Copyrighted
```

- **Search in the File namespace:** `gsrnamespace=6`.
- **Thumbnail:** `iiurlwidth` returns `thumburl`. Since T360589 the width is not guaranteed to match the request.
- **License:** `extmetadata` from CommonsMetadata:
  - `LicenseShortName` is the reliable short name.
  - `License` is a best guess.
  - `Artist` may contain HTML.
  - `AttributionRequired` and `Copyrighted` are also available.

## Etiquette

- **Requests one at a time, not in parallel.** There is no hard read limit.
- **A User-Agent with contact information is required:** clients without one may be IP-blocked. Whoush sends `WhoushResearch/0.1 (development; https://github.com/aleeforoughi/whoush)`. **Production needs the owner's contact address.**

## Live check, 2026-11-06

| Query | Results |
|---|---|
| "Persepolis relief Persian guards" | Persepolis reliefs and Persian guards (CC BY-SA 3.0, CC BY 2.0, CC BY-SA 4.0, "No restrictions") |
| "Ishtar Gate reconstruction" | Pergamon Museum photos (CC BY 2.0, CC BY-SA 4.0) |

Each result carried its author and description page.
