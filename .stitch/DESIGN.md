# Design System: Atelier Académico
**Project ID:** 4552469293811886931

## 1. Visual Theme & Atmosphere
Editorial, crisp, authoritative yet warm scholarly studio tailored for educators and students. A sunlit archival paper canvas softens screen glare during long exam-authoring and test-taking sessions, while pure crisp white cards with fine sandstone borders and whisper-soft ambient shadows bring tactile structure and effortless clarity. Generous breathing room, disciplined typographic hierarchy, and purposeful use of color communicate trust, precision, and calm focus.

## 2. Color Palette & Roles
* **Archival Ivory Canvas (`#F7F5F0`):** Global application background providing a calm, low-glare reading and authoring surface.
* **Crisp Paper Surface (`#FFFFFF`):** Elevated containers, exam question cards, analytics modules, and live preview frames.
* **Warm Sand Track (`#EFECE6`):** Subtle recessed surfaces for segmented tabs, table headers, and inline metadata pills.
* **Sandstone Hairline (`#E4E0D8`):** 1px structural borders and clean section dividers without heavy visual noise.
* **Deep Obsidian Ink (`#18181B`):** Primary high-contrast typography for titles, exam questions, and active controls.
* **Muted Graphite (`#52525B`):** Secondary labels, timestamps, descriptions, and supporting metadata.
* **Prussian Cobalt (`#1B3B6F`):** Primary action color for CTAs, active tabs, brand marks, and focus outlines.
* **Terracotta Vermilion (`#C84B31`):** Warm editorial accent for AI tools, active highlights, and subtle badges.
* **Botanical Emerald (`#15803D`):** Success indicators, valid API badges, published status, and passing grades.
* **Warm Amber (`#B45309`):** Warning notices, token limits, and exam security indicators.

## 3. Typography Rules
* **Headlines (`Bricolage Grotesque`):** Expressive architectural sans-serif used at weights 600–700 with tight tracking (`-0.02em`) for page headings, exam headers, and dashboard titles.
* **Body & Controls (`Plus Jakarta Sans`):** Clean, humanist sans-serif at weights 400–600 for question stems, answer choices, buttons, and form labels.
* **Numeric & Technical (`JetBrains Mono`):** Monospaced accent font for scores, percentages, token counters, dates, and code-like identifiers.

## 4. Component Stylings
* **Buttons:** Gently rounded corners (`8px`, `ROUND_EIGHT`) with crisp hover states; primary CTAs in solid Prussian Cobalt (`#1B3B6F`) with white ink; secondary buttons in Crisp Paper Surface (`#FFFFFF`) with Sandstone Hairline (`#E4E0D8`) borders.
* **Cards/Containers:** Softly rounded corners (`12px`) on Crisp Paper Surface (`#FFFFFF`) with fine `1px` borders (`#E4E0D8`) and subtle, whisper-soft shadows (`0 1px 2px rgba(24,24,27,0.04), 0 4px 12px rgba(24,24,27,0.03)`).
* **Inputs/Forms:** Clean white inputs with `#D6D1C7` borders, generous padding, and Prussian Cobalt (`#1B3B6F`) focus rings. Segmented pill/tab tracks use Warm Sand (`#EFECE6`).

## 5. Layout Principles
* Prioritize clarity and scannability: top editorial header bar with clean navigation, generous vertical rhythm (`24px`–`32px` between major sections), and responsive split-view support on desktop (`1fr / 1fr`) pairing the exam builder alongside its live interactive preview.
* Keep student exam views distraction-free (`max-w-2xl` centered column) on the warm paper canvas.
