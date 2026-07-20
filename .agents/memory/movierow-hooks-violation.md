---
name: MovieRow hooks-after-return violation
description: How and why MovieRow.tsx had a Rules-of-Hooks violation that caused "Rendered fewer hooks than expected" on web.
---

## The rule
Any `useMemo` / `useCallback` / `useRef` / `useState` / `useEffect` call in a component MUST come before ALL early returns. Early returns (conditional `return null`, JSX fallback returns, etc.) that precede a hook call produce "Rendered fewer hooks than expected" — especially visible on web with React Compiler enabled.

## What happened
`MovieRow` had two early-return guards at lines ~755–768 (collapse when empty, show placeholder on API failure) followed by a `React.useMemo` at line ~773 for the `visibleMovies` image filter. On the first render with data, all hooks ran. On a subsequent render where `movies` was empty, the component exited early and the `useMemo` was never called — React's hook count dropped from N+1 to N.

**Why:** The `visibleMovies` memoization was added after the early-return guards as a "post-condition" optimization. It looked logically correct (why compute if we're returning early?) but breaks React's invariant that hooks are always called in the same order and count.

## Fix
Move ALL hooks (including `useMemo`) above ALL conditional early returns, regardless of whether the hook's result is used in the early-return branch. The early returns must come last, after every hook call.

**How to apply:** Any time you add a new hook to a component that already has early returns, place the hook ABOVE those returns.
