# Mallacoota Mouth archive

## Purpose

Preserve, index and—where the reuse basis is documented—publish historical
issues of *The Mallacoota Mouth* as a durable community resource.

The archive should support 20–100+ issues without changing the public URL or
catalogue format.


## Status (27 August 2026)

Colin confirmed the Mouth was a publicly distributed community newsletter and that he can collect a couple of dozen issues; someone in town may hold around 100. That volume justifies a real archive track, not a folder of PDFs.

Public distribution is **not** the same as public domain. Each issue gets a rights/permission status. The archive can be built and indexed without publishing a PDF until that status allows it.

Seed record: Issue 1771, 18 June 2020, 28 pages. Checksum recorded so later duplicate scans can be detected. The source PDF remains in `docs/` (private working area, not in the public build).

## Storage model

- Working/source files stay outside the public static build.
- Preservation masters will live in a private Cloudflare R2 bucket.
- Approved public derivatives will be exposed through a separate public R2
  binding or a Worker download route.
- Catalogue metadata lives in `data/archive-index.json` initially and can move
  to D1 when issue/article volume makes database search worthwhile.
- Full text will be stored separately from the master PDF so the catalogue can
  search it without downloading every issue.

Suggested R2 object keys:

```text
masters/mallacoota-mouth/YYYY/mallacoota-mouth-NNNN-YYYY-MM-DD.pdf
public/mallacoota-mouth/YYYY/mallacoota-mouth-NNNN-YYYY-MM-DD.pdf
text/mallacoota-mouth/YYYY/mallacoota-mouth-NNNN-YYYY-MM-DD.txt
thumbnails/mallacoota-mouth/YYYY/mallacoota-mouth-NNNN-YYYY-MM-DD.webp
```

## Intake workflow

1. Copy the best available source into the private intake area; never alter it.
2. Calculate SHA-256 and check for a duplicate.
3. Record issue number, publication date, page count, editor and provenance.
4. Record rights status and its evidence: permission, licence, public-domain
   basis, or `review_required`.
5. Run text extraction for born-digital PDFs or OCR for scans.
6. Visually compare a sample of pages and text before marking extraction ready.
7. Create an accessible reading derivative and thumbnail where useful.
8. Publish only when review status allows it; retain the master privately.

## Rights statuses

- `review_required`: collected but not publicly reproduced.
- `permission_granted`: permission and source are recorded.
- `open_licence`: licence name and version are recorded.
- `public_domain_verified`: the basis and verification date are recorded.
- `restricted`: retained for preservation but not made public.
- `takedown_review`: temporarily unavailable while a request is assessed.

The fact that an issue was publicly distributed is useful provenance, but it
is not by itself the rights record for putting a full reproduction online.

## Metadata required per issue

- Stable ID and publication title
- Issue number and ISO publication date
- Page count and editor/publisher where known
- Source/provenance statement
- SHA-256 checksum
- Topics and names for discovery
- Rights status, evidence note and review date
- Private master key, public URL and extracted-text key when available
- Quality notes, missing pages and superseded-scan link

## Next archive increment

Build an ingestion command that reads an intake folder, detects duplicates,
extracts text, creates thumbnails, validates metadata and uploads preservation
masters to R2. Add page-level full-text search after the first representative
batch has been assessed for scan quality.
