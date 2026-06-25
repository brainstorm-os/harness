# 68 — The Designer app: documents, forms, and (later) pages

> Status: **iteration 1 SHIPPED** (2026-06-22) — Invoices surface: create →
> live preview → Export PDF, verified real-shell (dogfood session 330). Drives the
> commercial-spine **DT-2** (billing documents) in
> [`dogfood/business-wishlist.md`](../dogfood/business-wishlist.md), and sets up
> **DT-5** (publishing) as a later output target. Builds on
> [23-output-printing-pdf.md](23-output-printing-pdf.md) (the shared print/PDF
> render path) and [27-layouts.md](../shell/27-layouts.md) (`Layout/v1`).

## Why

Today's `form-designer` is a **data-collection form builder** — it composes a
list of property fields and, in Fill mode, writes **one entity** with scalar
values. It cannot model a **document**: no line-item table, no computed totals,
no rendered output. So Northbound still **cannot produce an invoice** — the
single deepest gap in the commercial spine (DT-2). A studio that can't invoice
can't operate.

## The shape: one Designer, many output targets

Rather than ship three apps (Invoices, Proposals, a Website builder), the
`form-designer` app **evolves into the Designer** — an element-based surface
that composes a document from elements, where the *same* document can be sent to
different **output targets**:

| Output target | What it produces | Status |
|---|---|---|
| **Document → PDF** | a paginated, sendable PDF (invoice, proposal, SOW, letter) | **iteration 1 (this doc)** |
| **Form** | a fillable data-entry surface that writes an entity | already shipped (Fill mode) |
| **Page → web** | a published webpage / newsletter issue | later — DT-5 |

The unification is real but **proven one target at a time**: a single document
model, swappable renderers. A "form" is just a document whose elements include
inputs; a "page" is a document rendered to HTML-for-web instead of HTML-for-PDF.
The Designer becomes the all-in-one surface **incrementally**, driven by concrete
templates — not as a year-long layout-engine project up front.

> Evolve **additively**: the existing form mode keeps working untouched; the
> document/PDF surface is added beside it. No rewrite of a shipped app.

## Iteration 1 — Invoice → sendable PDF (the DT-2 acceptance)

**Acceptance (from DT-2):** Mira fills an invoice for the Vertex engagement —
line items, fee, dates, bill-to pulled from the client where possible — and
exports a clean PDF she could send. Proposals/SOWs reuse the same render core
later.

### Why a focused `Invoice/v1`, not generic layout cells (yet)

`Layout/v1` ([27](../shell/27-layouts.md)) already has `Text` / `Divider` /
`Group` / `Property` cells, a `Print` context, and conditions — but **no
line-item table cell and no computed-total cell**, and it is a *frozen shared
contract* consumed by the layout resolver, the render pipeline, and the form
builder. Adding cell kinds there is high-blast-radius. So iteration 1 models the
invoice as its own focused entity + render, **discovers** what a real document
needs (repeating rows, derived totals, data-binding), and a later iteration
**promotes** those into `Layout/v1` as new cell kinds (`Table`, `Computed`) once
the shape is proven. Build the vertical slice, then generalise.

### The model — `io.brainstorm.form-designer/Invoice/v1`

```ts
type InvoiceLineItem = { description: string; quantity: number; unitPrice: number };

type InvoiceDoc = {
  number: string;            // "INV-001"
  issueDate: string;         // ISO date
  dueDate: string | null;    // ISO date
  currency: string;          // ISO 4217, e.g. "USD"
  from: PartyBlock;          // issuer (name / address lines / email)
  billTo: PartyBlock;        // recipient — seeded from a linked Client where possible
  billToRef: string | null;  // optional EntityRef → Client/Contact (DT-3 relation)
  lineItems: InvoiceLineItem[];
  taxRatePct: number;        // 0..100
  notes: string;             // payment terms / thank-you
  status: InvoiceStatus;     // draft | sent | paid
};
```

`PartyBlock = { name: string; addressLines: string[]; email: string }`.
`InvoiceStatus = "draft" | "sent" | "paid"` (a string enum; the value *is* the
wire form, per the no-raw-discriminators rule).

**Totals are computed, never stored as source of truth** — a pure
`computeInvoiceTotals(doc)` derives `{ lineAmounts[], subtotal, tax, total }`
(line amount = `quantity × unitPrice`; tax = `subtotal × taxRatePct/100`). This
is the "computed field" the form builder lacks, kept as bounded invoice logic
rather than a formula language.

### The render — reuse the existing PDF path

`renderInvoiceHtml(doc, totals)` → a self-contained, **HTML-escaped** document
string (issuer/bill-to blocks, a line-item `<table>`, a totals block, notes).
Images (a logo) embed as `data:` URIs (the PDF renderer blocks network). Then the
**existing** pipeline does the rest — no new shell code:

- `services.export.printToPdf(html)` → PDF bytes (cap `export.print-to-pdf`,
  sandboxed Electron `printToPDF`, A4 — see [23](23-output-printing-pdf.md)).
- `requestSaveBytes(...)` from `@brainstorm/sdk/export-file` → save dialog
  (filtered to `.pdf`) → `files.write`.

This mirrors the proven Notes *entity → HTML → printToPdf → save* path exactly.

### Designer UI (additive)

A **Documents** surface beside the existing form list: create an invoice, edit
its fields + a **line-item editor** (add/remove rows, qty × rate), see a **live
preview** of the rendered document with totals, and **Export PDF**. Invoices are
ordinary `Invoice/v1` entities in the vault (reactive via `useVaultEntities`),
so "data storage" is free and they're queryable — which is what makes DT-7 next.

## What this unblocks downstream

- **DT-7 (finances)** — once invoices carry `total` + `status`, a Finances view
  is a **rollup over `Invoice/v1`** (revenue = Σ paid; outstanding = Σ sent). No
  new money primitive; it falls out of invoices + the existing aggregation.
- **DT-2 breadth** — proposals / SOWs are the same render core with a different
  template; a generic `Document/v1` + promoted `Layout/v1` table/computed cells
  generalise the Invoice special-case.
- **DT-5 (publishing)** — the same document model with an HTML-for-web renderer
  and a publish target becomes the Page/website output.

## Open questions

- **OQ-DSN-1** — line items as a structured **array property** on the invoice
  (iteration 1) vs **child entities** (each line a related row). Array is simpler
  and fine for render+PDF; child entities matter only if lines must be queried /
  rolled-up independently. *Position: array now; revisit if DT-4 needs per-line
  rollups.*
- **OQ-DSN-2** — when to **promote** `Table` + `Computed` into the shared
  `Layout/v1` cell set (generalising past the Invoice special-case). *Position:
  after a second document template (proposal) validates the element shape.*
- **OQ-DSN-3** — does the Designer **rename** to "Designer", or keep
  "Form Designer" with a Documents section? *Position: keep the app id stable;
  surface "Documents" + "Forms" as modes; defer any rename.*
