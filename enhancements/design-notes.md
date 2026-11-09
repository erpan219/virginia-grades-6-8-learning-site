# Design refinement — 9 November 2026

This is an additive CSS pass for the existing single-file site. It changes no section, navigation destination, learner data, answer state, or lab behavior. The parent implementation should inline `design.css` once in the document head. Selectors intentionally outrank the later legacy CSS blocks. Screen-only rules leave the report and worksheet print layouts alone.

The toolbar becomes a neutral paper surface with forest-green emphasis. Existing controls remain available, including all section links and the full language-mode explanations. At desktop widths the language choices use three balanced columns; the header is compact by default, and the existing Menu control explicitly expands or collapses the extra controls. Buttons retain a 44px minimum target. The same mobile menu sheet keeps its existing scrolling and focus behavior.

The hero retains its current illustration and wording. Its desktop minimum art height drops from 470px to 360px, with more room for the text column. Statistics use a responsive grid. Lesson lists gain stronger titles, quieter metadata, and consistent spacing. Lesson reading and question prompts use scalable rem-based sizes; large-text preferences remain effective. Answer colors, lab SVG dimensions, floating-pill hiding, and mobile Chinese navigation labels are preserved. A separate accessibility fix hides and makes inert the concealed flashcard face; redundant filter pseudo-icons are removed.

Design references researched from primary sources:

- [USWDS typography](https://designsystem.digital.gov/components/typography/): readable line lengths, line height, and heading rhythm. The site retains its easy-read font and supports Chinese at a separate reading measure.
- [USWDS cards](https://designsystem.digital.gov/components/card/): consistent list hierarchy, useful actions, simple borders, and avoiding decorative card clutter.
- [GOV.UK Frontend](https://github.com/alphagov/govuk-frontend) and [error summary guidance](https://design-system.service.gov.uk/components/error-summary/): visible focus and clear form behavior, relevant to the separate account work.
- [Open Props](https://github.com/argyleink/open-props): a useful framework-independent token approach. No package, normalize stylesheet, or code copied.
- [shadcn/ui](https://github.com/shadcn-ui/ui) and [Radix](https://www.radix-ui.com/primitives/docs/overview/introduction) were considered; adding React/Tailwind is disproportionate for this static document.
- [Pico CSS](https://github.com/picocss/pico) was considered but its repository was archived October 4, 2026. It is not adopted.

All CSS here is newly authored. No third-party assets, fonts, framework dependencies, or copied component code are added.

Verification handoff: visually check desktop 1440px and narrow desktop 1024px, mobile 390px, both languages and themes, default/XL text, the expanded/collapsed toolbar, mobile menu, a lesson, challenge feedback, flashcard reveal, and print preview. Browser verification belongs to the parent audit; this file alone does not claim those checks passed.
