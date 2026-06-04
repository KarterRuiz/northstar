/** Print CSS inlined for Puppeteer PDF generation (mirrors report-card-print.css + preview layout). */
export const REPORT_CARD_PRINT_STYLES = `
  @page {
    margin: 12mm;
    size: letter;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.4;
    color: #000;
    background: #fff;
  }

  .report-card-print-root {
    max-width: 48rem;
    margin: 0 auto;
    padding: 2rem;
    background: #fff;
  }

  .rc-header {
    border-bottom: 2px solid var(--rc-primary, #1e3a5f);
    padding-bottom: 1rem;
    margin-bottom: 0;
  }

  .rc-header-top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .rc-school-name {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0;
    color: var(--rc-primary, #1e3a5f);
  }

  .rc-contact {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #4b5563;
  }

  .rc-contact p {
    margin: 0.125rem 0;
    white-space: pre-wrap;
  }

  .rc-logo img {
    max-height: 4rem;
    max-width: 10rem;
    object-fit: contain;
  }

  .rc-meta {
    margin-top: 1rem;
    font-size: 0.75rem;
    color: #4b5563;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .rc-meta-sub {
    margin-top: 0.25rem;
    text-transform: none;
    letter-spacing: normal;
  }

  .rc-section {
    margin-top: 1.5rem;
    break-inside: avoid;
  }

  .rc-section.rc-section-breakable {
    break-inside: auto;
  }

  .rc-section-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 0.5rem;
  }

  .rc-student-name {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
  }

  .rc-muted {
    color: #4b5563;
    font-size: 0.875rem;
  }

  .rc-grade-lg {
    font-size: 1.125rem;
    font-variant-numeric: tabular-nums;
    margin: 0;
  }

  table.rc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    margin-top: 0.75rem;
  }

  table.rc-table th {
    text-align: left;
    font-size: 0.625rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4b5563;
    border-bottom: 1px solid #d1d5db;
    padding: 0.25rem 1rem 0.25rem 0;
  }

  table.rc-table th:last-child {
    text-align: right;
    padding-right: 0;
  }

  table.rc-table td {
    padding: 0.375rem 1rem 0.375rem 0;
    border-bottom: 1px solid #f3f4f6;
  }

  table.rc-table td:last-child {
    text-align: right;
    font-variant-numeric: tabular-nums;
    padding-right: 0;
  }

  .rc-pre {
    white-space: pre-wrap;
    font-size: 0.875rem;
    line-height: 1.625;
    margin: 0;
  }

  ul.rc-list {
    margin: 0.25rem 0 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
  }

  ul.rc-list li {
    margin: 0.25rem 0;
  }

  .rc-subheading {
    font-size: 0.625rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #4b5563;
    margin: 0 0 0.25rem;
  }

  .rc-signatures {
    margin-top: 2.5rem;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }

  .rc-sig-line {
    margin-top: 1.5rem;
    border-bottom: 1px solid #9ca3af;
  }

  .rc-footer {
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid #d1d5db;
    font-size: 0.625rem;
    color: #6b7280;
  }

  .rc-footer p {
    margin: 0.5rem 0 0;
    white-space: pre-wrap;
  }
`;
