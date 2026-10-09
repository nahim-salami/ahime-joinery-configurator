# Ahime Joinery Configurator for WooCommerce

Source code of the WordPress plugin **Ahime Joinery Configurator for WooCommerce** (slug `ahime-joinery-configurator`), version 0.5.0.

The plugin adds a joinery configurator to a WooCommerce store: customers configure windows, doors, shutters and blinds in 2D and 3D and see the price as they go; the store checks the configuration and recalculates the price on the server before writing the order.

This repository contains everything needed to rebuild the JavaScript shipped in the plugin's `assets/` folder from human-readable source.

## What is included

| Path | Content |
| --- | --- |
| `packages/core/src/` | The configurator engine, in TypeScript: types, reference catalogue, prices (integer cents), manufacturing rules, 2D drawing, 3D geometry. No DOM, no clock, no network. |
| `packages/widget/src/` | The `<ahjc-configurator>` web component (React 18, three.js for the 3D view). |
| `packages/widget/vite.config.ts` | The build configuration: ES modules, lazy chunks, **readable output** (no minification, no identifier renaming). |
| `ahime-joinery-configurator/` | The WordPress plugin as shipped, except `assets/` which is produced by the build: main file, PHP engine (a port of the TypeScript pricing and validation), WooCommerce cart integration, reference catalogue, `readme.txt`, `uninstall.php`. |
| `scripts/zip.mjs` | Packs the plugin folder as the ZIP uploaded to WordPress.org. |

Product families included: window, French window, sliding door, entrance door, roof window, roller shutter, hinged shutter, garage door, awning, insect screen, interior blind, external venetian blind, zip screen.

## Build

Requirements: Node.js 20 or later, npm.

```sh
npm ci           # installs the exact versions pinned in package-lock.json
npm run build    # writes ahime-joinery-configurator/assets/ (readable ES modules)
npm run zip      # optional: dist/ahime-joinery-configurator-0.5.0.zip
```

`npm run typecheck` runs the TypeScript compiler on both packages.

The entry point loaded by the plugin is `ahime-joinery-configurator/assets/ahjc-widget.js`; the other `ahjc-*.js` files are chunks loaded on demand (one per family group, the 3D scene, the English dictionary, the PDF quote).

## How the plugin works

- The shortcode `[ahjc_configurator famille="fenetre" produit="123"]` prints the `<ahjc-configurator>` element and passes the catalogue to it as JSON (`window.__AHJC_CONTEXT__`).
- The browser computes the price for display. When the customer adds the item to the cart, the configuration (never a price) is posted with a nonce.
- The server filters the posted configuration against an allowlist generated from the `JoineryConfiguration` type (`includes/schema-configuration.php`: known keys, types, allowed values, bounds), refuses values unknown to the catalogue, runs the validation rules, and recalculates the price with the PHP engine. Any refusal is shown as a WooCommerce notice.

## Third-party libraries

Bundled in the build, unmodified, from their published npm packages:

- React 18.3.1, React DOM 18.3.1 and Scheduler 0.23.2, MIT license: https://github.com/facebook/react
- three.js 0.185.1 (r185), MIT license: https://github.com/mrdoob/three.js

Build tools (not shipped): Vite 6.4.3, @vitejs/plugin-react 4.7.0, TypeScript 5.9.3, fflate 0.8.3.

## License

GPL-2.0-or-later, see `LICENSE`. Copyright Ahime.
