# InfoHighlight / InfoLens attribution

The display curve and sentence/word fusion logic in `src/lib/reading-scoring.mjs` are adapted from:

- [LinXin-CMU/InfoHighlight](https://github.com/LinXin-CMU/InfoHighlight), revision `597cb041267835e208ef58ef9da2171b6e90faf2`, `infolens-prototype/signals.mjs`, `semantic-normalization.mjs`, and `appearance.mjs`.
- The project's upstream [dqy08/InfoLens](https://github.com/dqy08/InfoLens), reference revision `08c65f0756178db5eb09e1be8328014987507b9d`, which supplied the original sixteen-level highlight scheme.

Original authorship and ownership remain with those contributors. License: Apache License 2.0, reproduced in `InfoHighlight-APACHE-2.0.txt`. Original supplied notices are preserved as `InfoHighlight-ORIGINAL-NOTICE.md` and `InfoLens-UPSTREAM-NOTICE.md`.

Modifications for this site (2026-10-24): offline Luna sentence/phrase semantic scores replace model probabilities; spans refer to validated prose snapshots; bright budgets count annotated phrases; unannotated grammar gaps retain only the important-sentence readability floor; color alpha has a 30% minimum; math, code, links, images, headings and author emphasis are protected. No upstream inference code, model weights, preview data, palettes, translation service, or application adapters are included.
