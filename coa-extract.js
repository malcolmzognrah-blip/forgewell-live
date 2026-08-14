// Reference implementation for POST /api/admin/coa-extract (see
// product-specs-migration.sql for the product_specs/product_coas schema this
// feeds). Not wired into any served page -- this repo is frontend-only, so
// this file documents the extraction logic the external backend should run
// server-side when an admin uploads a COA PDF in admin.html's "Certificates
// of Analysis" tab. Requires `pdf-parse` (https://www.npmjs.com/package/pdf-parse)
// on whatever Node backend adopts this.
//
// Verified against a real Freedom Diagnostics COA PDF (coa-test-sample.pdf)
// via `pdf-parse`'s getText(), which flattens the page into text where
// visually-adjacent fragments are joined with '\t' and line breaks with '\n'.
// Every regex below is anchored on exact label text confirmed present in
// that real output -- not guessed from the PDF's visual layout.

// Two labels appear TWICE in the document with different shapes, which is
// the main extraction hazard:
//   - "Microbial Analysis (PCR): \tPass" (Sample Summary panel, colon,
//     single clean value) vs. "Microbial Analysis (PCR) \tNo Detectable
//     Microbial DNA \tPass" (Analytical Results table, no colon, 2-column
//     value) -- the colon is what disambiguates which one a regex hits.
//   - "Purity:\nVial 1: 99.17%\n..." (Sample Summary panel, per-vial
//     breakdown, no single value) vs. "Purity (HPLC-UV) \t99.17%"
//     (Analytical Results table, single clean value) -- matching the full
//     parenthesized label name avoids the per-vial listing entirely.
// Do not simplify these regexes to bare "Purity" / "Microbial Analysis
// (PCR)" without the colon -- both changes reintroduce the collision.
function extractCoaFields(text) {
  function grab(regex) {
    var m = text.match(regex);
    return m ? m[1].trim() : null;
  }
  return {
    current_lot: grab(/Lot:\s*\t?\s*([^\n\t]+)/),
    appearance: grab(/Appearance:\s*\t?\s*([^\n\t]+)/),
    purity: grab(/Purity \(HPLC-UV\)\s*\t?\s*([\d.]+%)/),
    endotoxin_threshold: grab(/Endotoxin Threshold:\s*\t?\s*([^\n\t]+)/),
    microbial_analysis: grab(/Microbial Analysis \(PCR\):\s*\t?\s*([^\n\t]+)/),
    fentanyl_screen: grab(/Fentanyl Screen:\s*\t?\s*([^\n\t]+)/),
    net_content_average: grab(/Net Content Average\s*\t?\s*([\d.]+\s?mg)/i),
    // Not a product_specs column -- returned only so the admin UI can warn
    // "this PDF says <X> but you selected a different product" before save.
    product_name_on_coa: grab(/Product:\s*\t?\s*([^\n\t]+)/),
    reported_date_raw: grab(/Reported:\s*\t?\s*([\d\/]+)/),
  };
}

// "07/11/2026" -> "2026-07-11". Plain string slicing rather than Date
// parsing -- same reasoning as product.html's formatCoaDate(): a date this
// far removed from any time-of-day/timezone concept should never round-trip
// through a timezone-aware Date object, which risks shifting the calendar
// day depending on server TZ.
function normalizeReportedDate(raw) {
  if (!raw) return null;
  var parts = raw.split('/');
  if (parts.length !== 3) return null;
  var month = parts[0].padStart(2, '0');
  var day = parts[1].padStart(2, '0');
  var year = parts[2];
  return year + '-' + month + '-' + day;
}

// What POST /api/admin/coa-extract should return: extracted fields plus a
// batch_date suggestion (admin still reviews/edits both before save -- see
// admin.html). Pure preview -- persists nothing.
async function buildExtractionPreview(pdfBuffer) {
  var { PDFParse } = require('pdf-parse');
  var parser = new PDFParse({ data: pdfBuffer });
  var result = await parser.getText();
  var fields = extractCoaFields(result.text);
  return {
    current_lot: fields.current_lot,
    appearance: fields.appearance,
    purity: fields.purity,
    endotoxin_threshold: fields.endotoxin_threshold,
    microbial_analysis: fields.microbial_analysis,
    fentanyl_screen: fields.fentanyl_screen,
    net_content_average: fields.net_content_average,
    product_name_on_coa: fields.product_name_on_coa,
    batch_date_guess: normalizeReportedDate(fields.reported_date_raw),
  };
}

module.exports = {
  extractCoaFields: extractCoaFields,
  normalizeReportedDate: normalizeReportedDate,
  buildExtractionPreview: buildExtractionPreview,
};
