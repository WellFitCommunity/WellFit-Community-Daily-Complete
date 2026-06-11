#!/usr/bin/env bash
# Convert the feature/manual markdown docs to Word (.docx) AND PDF — FAST, no AI, non-destructive.
# Reads docs/*.md, writes docs/manual/*.docx and docs/manual/*.pdf.
# Never modifies the source markdown.
# Usage: bash scripts/headless/md-to-docx.sh   (or: npm run docs:docx)
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! command -v pandoc >/dev/null 2>&1; then
  echo "ERROR: pandoc is not installed. Install with: sudo apt-get install -y pandoc" >&2
  exit 1
fi

# PDF support is optional — produced only if weasyprint is available.
PDF_CSS="scripts/headless/pdf-style.css"
PDF_OK=0
if pandoc --list-input-formats >/dev/null 2>&1 && python -c "import weasyprint" >/dev/null 2>&1; then
  PDF_OK=1
else
  echo "NOTE: weasyprint not available — generating .docx only (no PDF)." >&2
  echo "      To enable PDFs: pip install weasyprint" >&2
fi

mkdir -p docs/manual

# The documents to convert. Add a filename (without .md) to include it.
DOCS=(FEATURE_CATALOG FEATURE_LIST FEATURE_LIST_ONE_PAGE TOP_24_FEATURES USER_MANUAL)

for f in "${DOCS[@]}"; do
  if [ -f "docs/$f.md" ]; then
    pandoc "docs/$f.md" -o "docs/manual/$f.docx" --toc --toc-depth=2
    echo "OK  docs/manual/$f.docx"
    if [ "$PDF_OK" -eq 1 ]; then
      pandoc "docs/$f.md" -o "docs/manual/$f.pdf" --pdf-engine=weasyprint --css="$PDF_CSS" --toc --toc-depth=2
      echo "OK  docs/manual/$f.pdf"
    fi
  else
    echo "skip docs/$f.md (not found)" >&2
  fi
done

echo "Done. Documents are in docs/manual/ (.docx$( [ "$PDF_OK" -eq 1 ] && echo ' + .pdf'))"
