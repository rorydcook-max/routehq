# Guide and resource images

- `covers/*.svg`, `covers/og/*.png` and `guides/diagrams/*.svg`: original flat illustrations and diagrams drawn for
  RoveHQ (7 Nov 2026) in the website's colours. No third-party artwork, no photos of people. The PNGs are 1200x630
  renditions of the SVGs for Open Graph, made with sharp.
- `docs/screens/*.webp`: screenshots of the RoveHQ app taken with Playwright on the test business "Island Wheels".
  Everything shown (customers, vehicles, amounts) is test data; phone numbers were masked before capture. Each
  screenshot is captioned "From a demo business (Island Wheels) with test data." where it's used.

The covers are chosen per article in frontmatter (`cover`, `coverAlt`); lib/site/covers.ts picks one by slug or topic
when an article has none.
