# Offline sentence and word reading emphasis

New annotations use `schemaVersion: 2`, `method: luna-sentence-word-v1`, UTF-16 offsets, and `snapshotHash`. The fingerprint covers both prose ranges and the full rendered tree's text, element properties, and protected objects, excluding parser location metadata. Changes inside formulas or links also invalidate annotations. `blocks` contains exact render-time prose snapshots, eligible text ranges, complete sentence ranges, sentence importance (0–100), and position-specific word/phrase information scores (0–100). These are offline semantic judgments from Luna, not model token probabilities. Existing `primary`/`secondary` entries retain their legacy behavior.

The offline tools in `C:/CloudingYu/Documents/Notes/blog-notes` prepare snapshots, validate original source bytes and the full render snapshot, and export one website entry. Blog keys are exact titles; notebook keys are full course-note URLs. Only explicitly selected content is regraded. No model, inference server, new browser control, or page-time API is required.

`reading-markdown.mjs` shares the existing parser options and unchanged notebook preprocessing between the website and snapshot extraction. `reading-analysis.mjs` protects math, code, headings, links, images, and author emphasis; inline protected objects become U+FFFC in the snapshot. `rehype-reading-emphasis.mjs` checks the complete snapshot before painting any range. Stale data produces no annotations; `reading-preferences.js` enables the switch only when annotations actually rendered.

`reading-scoring.mjs` adapts InfoHighlight's paragraph min-max normalization (minimum spread 0.05), conservative top-half important-sentence selection (raw score >=75 and normalized >=0.75), sentence readability floor (score 0.36), bounded bright-candidate expansion (target 2x, eligible pool cap 85%), and sixteen-level cubic-bezier display curve. Tied cutoff candidates are not arbitrarily promoted. Single-sentence or nearly tied paragraphs remain neutral for sentence promotion. Source scores are retained.

Local differences: phrase scores are semantic, the bright budget counts annotated phrases, unannotated gaps receive score zero and only the readability floor when eligible, and text alpha spans 30–100% rather than the upstream default fade range of 8–100%. Formula/code/link/author-emphasis subtrees retain their original rendering and all source characters remain unchanged. Old profiles are never automatically converted.

Run focused checks with `node --test tests/reading-emphasis.test.mjs`. The normal content workflow validates and pushes without a local site build or preview.

Adapted code attribution and modifications: [licenses/InfoHighlight-NOTICE.md](../licenses/InfoHighlight-NOTICE.md).
