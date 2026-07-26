# REBRAND PASS — Web Dashboard (branch `frontend`)

The dashboard is built and hardened. This pass applies a **new brand identity**. It is a visual
change only — do not alter data flow, API calls, filtering logic or component structure beyond
what the restyle requires. Commit in small, separate commits.

---

## The brand

`contract/tokens.ts` **has been rewritten on `main`.** Re-copy it into `src/theme/tokens.ts`
verbatim (keeping the local `src/theme/types.ts` shim already in place), then rebuild the Mantine
theme from it.

Adapted from the Luciq design language. Its character, in priority order:

1. **A warm bone canvas — `#FBF8F6`.** Never cold grey, never pure white. This is the single most
   recognisable thing about the brand. If a judge remembers one thing visually, it is that the
   page is warm rather than the default grey-white every dashboard has.
2. **A serif display face at REGULAR weight (400)** for the page title and for big numbers — the
   "Total incidents 10" stat should be the serif at ~40px, weight 400. **Not bold.** The elegance
   comes from the letterforms, not the weight. This is the second most recognisable thing.
3. **Near-black ink `#070707`** for text; **warm grey `#6D6864`** for supporting text and column
   headers.
4. **Electric blue `#0A89FC`** as the interactive accent: links, focus rings, primary button,
   active filter state, the Investigating status.
5. **Acid lime `#B6FA05`** as the signature brand mark, used **sparingly** — a small mark beside
   the product name in the header, or a "live" dot. **Never for severity or status**; it must
   never read as a semantic state. One or two appearances on the whole page, maximum.
6. **Radius 8px** for controls and cards, **16px** for large panels. Not pills.
7. **Warm-tinted dark mode**: page `#0B0B0A`, surface `#141412`, border `#2A2724`. A warm brand
   does not flip to neutral charcoal.

Fonts: `FONT_DISPLAY` (Instrument Serif), `FONT_UI` (Instrument Sans), `FONT_MONO` are exported
from tokens. Load the two web fonts, but ensure the page still renders correctly on the system
fallback — **the demo may run with no network**, so a font failure must not break layout.

## Where each font goes

| Surface | Face |
|---|---|
| Product title, section headings, stat numbers | `FONT_DISPLAY`, weight 400 |
| Table cells, labels, buttons, filters | `FONT_UI` |
| Log lines, stack traces, error codes, timestamps, occurrence counts | `FONT_MONO` |

## Where colour is allowed

Severity badge, the left accent border on Critical/High rows, chart series (`CHART_SERIES`),
status pill, and the interactive blue. Everywhere else is ink, warm grey, bone and border.

## Still banned

Gradients of any kind. **Purple/violet anywhere.** Glassmorphism, blur panels, stacked drop
shadows — borders over shadows. Neon or candy colours beyond the two brand accents. Emoji as
iconography. "AI sparkle" motifs. Cold grey page backgrounds. Bold display headings. Airy
marketing spacing — rows stay 40px, body 13px.

---

## Do not regress the hardening pass

The previous pass fixed a real timezone defect: all timestamps must render in **UTC** and be
labelled as such, so the table agrees with the trend chart. Do not reintroduce local-time
formatting while restyling.

---

## Verification before you finish

1. `npx tsc --noEmit` exits 0 and `npm run build` exits 0
2. Grep the tree for purple and for gradients: no `linear-gradient`, no `#6200EE`/`#BB86FC`, no
   violet hexes
3. The page background is `#FBF8F6` in light mode, not `#FFFFFF` and not `#F8F9FA`
4. The stat number and page title render in the serif at weight 400
5. Dark mode is warm-tinted (`#0B0B0A`), not neutral charcoal
6. Critical/High rows still show a visible left accent in both schemes
7. Timestamps still render in UTC and still match the trend chart dates
8. Disable the network in devtools, reload: layout is intact on fallback fonts

Report what you changed, and paste the final palette you ended up using.

---

## Standing instructions

Implement and commit in small messages. **Never stop to ask for approval — you have it.** Work
only in your current directory. **Do not modify `contract/`** — copy from it. If something is
genuinely impossible, implement the closest working alternative and note it in `NOTES.md`; do not
halt. No `git push`, `merge`, `rebase`, or other branches.
