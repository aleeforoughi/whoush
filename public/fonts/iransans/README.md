# IRANSans font files (licensed, not committed)

Whoush's primary typeface is **IRANSans v5.00** (fontiran.com, Moslem Ebrahimi), a commercially licensed font. This
repository is public, so the font binaries are **git-ignored** and must never be committed or redistributed.

`app/fonts.css` expects these files in this folder:

| Weight | Files |
|---|---|
| 200 | `IRANSansWeb_UltraLight.woff2`, `.woff` |
| 300 | `IRANSansWeb_Light.woff2`, `.woff` |
| 400 | `IRANSansWeb.woff2`, `.woff` |
| 500 | `IRANSansWeb_Medium.woff2`, `.woff` |
| 700 | `IRANSansWeb_Bold.woff2`, `.woff` |
| 900 | `IRANSansWeb_Black.woff2`, `.woff` |

The owner keeps a local copy here. CI and any build without the files fall back to Inter Variable (Latin) and Tahoma
(Persian), and the browser logs 404s for these URLs.

Before production: confirm the IRANSans license covers the Whoush website/app (fontiran licenses are typically issued
per website or project), then serve the files from private storage or the deployment's static assets, never from Git.
