# IRANSansX fonts — integration PENDING

Whoush's primary typeface is IRANSans / IRANSansX, which is commercially licensed. The font files are **not** in this
repository and must never be downloaded from unofficial sources or committed without a verified license.

The project owner must place the licensed WOFF2 files here:

- `IRANSansX-Regular.woff2` (400)
- `IRANSansX-Medium.woff2` (500)
- `IRANSansX-Bold.woff2` (700)

`app/fonts.css` already declares them (`font-display: swap`), with `local("IRANSansX")` / `local("IRANSans")` first.
Until the files exist the interface falls back to Inter Variable (Latin) and Tahoma (Persian), and the browser logs 404s
for these URLs. Font integration is PENDING; do not describe it as complete.
