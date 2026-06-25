# Structure Skill

Use this when creating files or deciding where code lives in the CheeseBid frontend.

The folder layout is the backbone the other skills reference. Keep it consistent so a feature's pieces are always findable.

## Use When

- adding a new view, component, store, or api module
- deciding which folder a piece of code belongs in
- naming a file or symbol
- starting a new domain/feature area

Do not use this for: API call shape (api-client skill), state rules (store skill), routing (routing skill), styling (theming skill).

## Folder Layout

```
src/
  main.js              app bootstrap: Vue + Pinia + Router + styles
  App.vue              root shell (layout, router-view)
  router/
    index.js           route table
    guards.js          navigation guards (auth tiers)
  stores/              Pinia stores, one per domain (auth.js, session.js)
  api/
    client.js          the fetch wrapper (envelope, auth, errors)
    <domain>.js        endpoint functions per domain (auth.js, session.js)
  views/               route-level pages (LoginView.vue, ProfileView.vue)
  components/          reusable presentational components
  composables/         reusable logic hooks (useX.js)
  lib/                 framework-free helpers (money.js, format.js)
  assets/              images, fonts, audio
  styles/              tailwind entry + theme tokens
  config/              runtime config (env.js)
```

## Where Things Go

- a backend call -> `api/<domain>.js` (never `fetch` in a view/component/store)
- shared or cross-view state -> `stores/<domain>.js`
- a routed page -> `views/`
- a reusable UI piece -> `components/`
- reusable non-UI logic -> `composables/` (returns reactive state/functions)
- a pure helper with no Vue/DOM dependency -> `lib/`
- env/runtime config -> `config/`

Rule of thumb: if it touches the network, it goes through `api/`. If it holds state shared across views, it goes in `stores/`. If it is pure and frameworkless, it goes in `lib/`.

## Naming

- components and views: PascalCase files, `*View.vue` for routed pages, plain PascalCase for components (`BidRow.vue`, `LoginView.vue`)
- stores: camelCase file, `useXStore` export (`stores/auth.js` -> `useAuthStore`)
- composables: `useX.js` -> `useX()` export
- api modules: domain-named (`api/session.js`) exporting verb functions (`getSession`, `placeBid`)
- lib/helpers: camelCase file + named exports (`lib/money.js` -> `formatDollar`)
- one primary component per `.vue` file; file name matches the component name

## Feature Grouping

- group by layer (the folders above), not by feature, until a feature gets large
- a domain's pieces share a name across layers: `api/session.js`, `stores/session.js`, `views/SessionView.vue` — easy to trace
- when a feature grows past a few components, give it a subfolder under `components/<feature>/`

## Component Granularity

- `views/` orchestrate: pull from stores, hold page state, compose components
- `components/` present: receive props, emit events, no store access by default
- extract a component when markup repeats or a view exceeds a comfortable size
- do not put data fetching inside a presentational component

## Anti-Patterns

- `fetch` / `axios` calls inside a view or component (must go through `api/`)
- business logic or formatting duplicated across components (move to `lib/` or a composable)
- a store importing a component, or a component importing a store it does not need
- giant catch-all `utils.js`; split by purpose under `lib/`
- mixing TypeScript types/syntax (this is a JavaScript project)

## Checklist

- file is in the correct layer folder
- network access goes through `api/<domain>.js`
- shared state is in a Pinia store; pure helpers are framework-free in `lib/`
- naming follows the convention (PascalCase views/components, `useXStore`, `useX`)
- a domain's files share a consistent name across layers
- presentational components take props / emit events, no fetching

If any item fails, the placement is not ready.
