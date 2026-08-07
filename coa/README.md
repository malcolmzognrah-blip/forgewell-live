# Certificate of Analysis PDFs

Drop one PDF per product in this folder, named exactly `<product.id>.pdf` —
the same `id` value already visible in that product's own URL
(`/product.html?id=<productId>`). No other registration or config needed:
`product.html` checks for a matching file at `/coa/<id>.pdf` on page load
(a HEAD request) and only shows the Certificate of Analysis link/icon when
that file actually exists. A product with no PDF here just shows nothing —
never a broken link.
