# Repository style guide

Read this guide before changing repository code or configuration.

## Application code

- Prefer typed Vue components and explicit domain types over untyped objects.
- Account for Vue template ref auto-unwrapping. Use typed handlers that close
  over script-side refs, or accept plain values at template boundaries.
- Keep components focused: pages coordinate data and routing, while reusable
  display and form behavior belongs in components.
- Do not add a library when the existing stack can solve the task cleanly.

## Dependency imports

**Never import directly from filesystem paths inside `node_modules` or from a
dependency’s private implementation files. This applies to application code,
tests, scripts, configuration, dynamic imports, `require`, mocks, and aliases.**

Use public package entry points or explicitly exported public subpaths. Public
stylesheet entry points declared by a package's `style` field are also supported.
Do not bypass this rule with resolved absolute paths, package-directory traversal,
or aliases pointing to private files. A file existing in an installed package
does not make it a public API.

Allowed examples:

```ts
import { computed } from 'vue'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import 'leaflet/dist/leaflet.css' // Leaflet's declared public stylesheet entry point.
```

Disallowed examples:

```ts
import session from '../../node_modules/nuxt-auth-utils/dist/runtime/server/utils/session.js'
import session from 'nuxt-auth-utils/dist/runtime/server/utils/session.js'
vi.mock('../../node_modules/nuxt-csurf/dist/runtime/server/middleware/csrf.js')
```

When a dependency has no public testing interface, mock the framework boundary
and test application-owned behavior. Defer real module integration testing until
it can use a supported public interface. Do not copy dependency internals into
the repository to work around this rule.
