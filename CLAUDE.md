<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# CLAUDE.md

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## Language

Always communicate with the user in French. All messages, explanations, questions, and summaries must be written in French.

All CLAUDE.md files, rules, skills, and agent configuration files must be written in English. Merge request titles, descriptions, and commit messages must also be written in English.

## Project Overview

Angular 21+ enterprise application for GRDF (French gas distribution). It manages gas network capacity analysis, act scheduling, user permissions, and regulation optimization.

### State Management

Uses NgRx Signals (`@ngrx/signals`) for state management. Feature stores are provided at route level.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- **No `any` type** — use `unknown` when type is uncertain
- **Functional style**: prefer pure functions that receive data via parameters instead of accessing `this`. Extract logic into standalone functions when possible — it simplifies testing, refactoring, and reuse.

## Components

- **Standalone components only** (no NgModules for components). Do NOT set `standalone: true` (default in Angular 20+)
- **OnPush change detection** (`changeDetection: ChangeDetectionStrategy.OnPush`) on every component
- Keep components small and focused on a single responsibility
- **Container/Presentational pattern**: smart (container) components manage state and pass data down via `input()`. Dumb (presentational) components receive data via `input()` and emit events via `output()`. A child component must NEVER directly modify properties of its parent (e.g., `parent.addControl()`, `parent.someProperty = ...`). Similarly, a parent should not reach into a child's internal state. Each component works only with its own inputs and properties.
- Use `input()` and `output()` functions — no `@Input`/`@Output` decorators
- Use `resource()` or `rxResource()` functions instead of subscribing to httpRequest
- Use signal forms with FormRoot, the FormField directive, and form() functions when creating forms, instead of ReactiveFormsModule or FormsModule.
- Use `computed()` for derived state
- Prefer inline templates for small components
- Do NOT use `ngClass` — use `class` bindings instead
- Do NOT use `ngStyle` — use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file
- **Host bindings** in `host` object — no `@HostBinding`/`@HostListener`
- Use `NgOptimizedImage` for all static images (does not work for inline base64 images)
- Component prefix: `app-` (element), `app` (attribute directive)
- **French text accuracy**: always use correct French accents in HTML templates and labels (e.g. « Libellé », « liés », « créé », « modifié », « précédent ») — never omit diacritics in French UI text

### State Management

- Use signals for local component state: `signal()`, `computed()`
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals — use `update` or `set` instead

### Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) — never `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like `new Date()` are available in templates

### Services

- Design services around a single responsibility
- Use `providedIn: 'root'` for singleton services
- Use `inject()` function — no constructor injection

### Angular Material

- For Angular Material imports, always import standalone components/directives individually, e.g. MatFormField instead of MatFormFieldModule; do not use Material NgModules.

### Accessibility

- It MUST pass all AXE checks
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes

### Styling

- Use tailwindCss

## Testing

- **Test runner**: always use `npm test` (via `ng test`) — **NEVER `npx vitest run`** (Vitest globals `describe`, `it`, `expect` are provided by the Angular builder, not by Vitest CLI directly)
- Unit tests: `*.spec.ts` files alongside source
- Framework: Vitest (executed via the Angular builder)
