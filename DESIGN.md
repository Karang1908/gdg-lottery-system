# Design

<!-- impeccable:design-system 1 -->

The lottery inherits the GDG BITS Pilani Dubai visual system from the council
onboarding app and adapts it to a much denser, simpler drawing workflow.

## Direction

The interface is an event control surface: the wheel is the shared spectacle,
while every administrative action is arranged as calm, legible equipment around
it. It refuses casino ornament, confetti-first gamification, and dashboard-card
clutter. Solid Google brand colors provide energy; neutral surfaces carry work.

## Type

- Google Sans for display, countdown numerals, buttons, and wheel labels.
- Google Sans Text for forms, status, rosters, and supporting copy.
- Both are self-hosted from `public/assets/fonts/`.
- Display tracking stays between `-0.02em` and `-0.035em`; body copy stays at a
  readable 65–72 character measure.

## Color

The color strategy is restrained for the operating surface: neutral Google
grays plus one blue action. The four Google brand colors are reserved for wheel
slices and the small timing rhythm.

Light mode is the default because the host surface is likely used in a lit room
or projector environment. Dark mode remains first-class and explicit.

## Shape and depth

- Buttons and small status controls are pills.
- Content panels use 14–16px corners, never pill containers.
- Form fields use 12px corners and 2px focus/error borders.
- Depth uses an offset plus soft blur; controls never use decorative glows.
- The wheel rim is heavy enough to survive screen-share compression.

## Layout

- Entrant: a two-column composition on wide screens, with the form/confirmation
  owning the reading path and the live wheel proving the entry joined.
- Admin: wheel and winner stage on the left, operational rail on the right.
- Under 900px both become one column without horizontal overflow.
- The roster is virtual-feeling through capped scroll regions and inexpensive
  DOM updates, suitable for 150–1,000 entries.

## Wheel density

- Every entry always owns one stable segment.
- Up to 48 entries show fitted names. At higher counts labels progressively
  abbreviate, then yield to pointer/focus lookup and the searchable roster rather
  than drawing illegible pixels.
- Previous winners remain present but muted, preserving segment positions.
- The backend commits the winner first; a 5.2-second ease-out rotates the canvas
  to that exact segment. Reduced motion shortens the spin to 700ms.

## Interaction

- One authored motion moment: the wheel spin.
- Countdown changes use no theatrical transition; accuracy matters more.
- Admin destructive actions require confirmation and are visually subordinate.
- Errors state both the problem and the recovery.

## Accessibility

- Text contrast meets WCAG AA; screen-share-critical text aims higher.
- Canvas content is duplicated in semantic roster and winner regions.
- All actionable icons carry accessible labels and consistent SVG geometry.
- Focus outlines remain visible in both themes.

## Phone adaptation

- Entrant pages remain single-purpose: identity form first, live wheel second,
  with 16px inputs to prevent iOS focus zoom and safe-area padding for notches.
- The admin console gains a sticky Draw / Schedule / Entrants navigator and a
  thumb-reachable draw action bar below 620px; no capability is removed.
- All phone controls and inputs provide at least a 44×44px touch target.
- Phone canvases render at 720px and cap spin painting near 30fps, preserving
  legibility while reducing memory and main-thread work on lower-power devices.
- Polling pauses while a tab is hidden, then refreshes immediately on return.
- Dense wheel slices support tap lookup in addition to desktop hover.
