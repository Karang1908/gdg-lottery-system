# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Entrants** join a shared lottery from their own phone or computer. Their job
  is deliberately small: provide a name and email address, receive confirmation,
  and then leave the page if they wish.
- **Administrator** runs the draw from a separate password-protected screen,
  schedules the next lottery, monitors the entrant list, and presents the wheel
  to a room or screen share.

Expected roster is approximately 150 people, with room to grow beyond that.

## Product Purpose

A persistent, fair event lottery. An entrant must remain in the draw after
closing their tab, and every connected screen must converge on the same roster,
winner, and countdown without requiring a manual refresh.

## Positioning

The server chooses the winner with cryptographically secure randomness and
persists the authoritative state before the wheel animates. The wheel is a
visualization of an already-committed draw, never the source of the outcome.

## Operating Context

- Entrants primarily join on phones from a shared link.
- The administrator may operate while presenting to a room or over a compressed
  video call, so critical state and controls must remain large and unambiguous.
- The app is deployed to Vercel, where server functions are short-lived and
  in-process memory cannot be the source of truth.
- The source project's GDG BITS Pilani Dubai identity is preserved as the current
  brand assumption because this app is derived from the council onboarding app.

## Capabilities and Constraints

- Entrants submit a required name and valid email address once. Email comparison
  is case-insensitive, preventing duplicate entries while allowing duplicate
  human names.
- Public state exposes names and draw status but never email addresses.
- The administrator can draw, advance, return an accidental winner to the pool,
  remove an entry, reset eligibility, clear the entire lottery, and schedule or
  cancel a persistent countdown.
- Draws exclude previous winners until eligibility is reset.
- State is stored in an Upstash Redis database connected through Vercel. Local
  development uses an ignored JSON file with the same state shape.
- Short polling replaces WebSockets because Vercel Functions do not provide a
  long-lived process for shared socket state.
- The supported capacity is 1,000 entries per lottery, comfortably above the
  requested 150-person operating size.

## Brand Commitments

- Current assumption: retain Google Developer Group, BITS Pilani Dubai Campus
  logo assets, self-hosted Google Sans fonts, Google brand colors, theme toggle,
  and pill-shaped controls from the provided source project.
- The logo remains top-left on entrant and administrator pages.

## Evidence on Hand

- Real GDG logo and mark assets in `public/assets/`.
- Self-hosted Google Sans and Google Sans Text font files in
  `public/assets/fonts/`.
- No entrant list, testimonials, event date, sponsor content, or legal copy was
  supplied. The interface must not fabricate them.

## Product Principles

1. **Persist before celebration.** A join or draw is acknowledged only after the
   durable store accepts it.
2. **Randomness is server-owned.** The wheel animates to the server's result.
3. **One-minute learning curve.** Joining and drawing must be obvious without
   instructions.
4. **Density without fragility.** 150+ slices remain performant; names stay
   discoverable through hover/focus and the roster when labels cannot fit.
5. **Private by default.** Emails are administrator-only and never placed in the
   public wheel payload.

## Accessibility & Inclusion

- Full keyboard focus, visible error/loading/empty/disabled states, and reduced
  motion support are required.
- Color is never the sole indication of eligible, selected, or current status.
- The wheel has a text roster equivalent because dense canvas labels cannot be
  reliably read by every user.
