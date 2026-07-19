---
name: Express 5 wildcard params
description: Named wildcard params (*name) in Express 5 routes return an array of segments, not a string
---

In Express 5, a route like `router.get("/tmdb/*path", ...)` captures `req.params.path` as an **array** of path segments, not a string.

**Rule:** Always handle both types when reading wildcard params:
```typescript
const rawPath = (req.params as any).path;
const tmdbPath = (Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath)).replace(/^\/+/, "");
```

**Why:** Express 4 used strings; Express 5 changed named wildcards to return arrays. Calling `.replace()` directly on the value throws "not a function" at runtime.

**How to apply:** Any Express 5 route using `*name` wildcard syntax needs this pattern.
