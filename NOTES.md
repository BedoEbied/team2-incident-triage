# QA Notes

- Visual browser QA is blocked in this environment because browser discovery returned no
  available browser. The rebrand therefore cannot be spot-checked in rendered light/dark,
  responsive, or DevTools-offline states here. Source/build checks cover the warm palette,
  fallback font stacks, panel/control radii, focus treatment, and Critical/High accents;
  timezone behavior is covered by the same regression suite under `TZ=Africa/Cairo` and
  `TZ=America/Los_Angeles`.
- The local API health endpoint responds, but `contract/mock.json`'s bearer token receives
  `401 UNAUTHORIZED` from `GET /api/incidents`. Mock mode therefore remains the default so the
  dashboard stays populated. Live mode still uses the documented API paths and query format,
  but needs a valid login/token flow before flipping `USE_MOCK`.
