=== Ahime Joinery Configurator for WooCommerce ===
Contributors: ahime
Tags: woocommerce, product configurator, windows, doors, 3d
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 0.5.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Customers configure windows, doors, shutters and blinds in 2D and 3D, priced to the cent from a built-in reference catalogue.

== Description ==

Ahime Joinery Configurator adds a joinery configurator to your WooCommerce store. Your customers compose the product themselves and see the price as they go; your store checks the configuration and recalculates the price before writing the order, so the price shown is the price paid.

= What customers can configure =

* Windows, French windows, sliding doors, entrance doors and roof windows.
* Roller shutters, hinged shutters, garage doors, awnings, insect screens, interior blinds, external venetian blinds and zip screens.
* Dimensions to the millimetre, shapes, number of leaves, opening types, materials, ranges, glazing, colours and fitting.
* 2D drawing with dimensions, facade view and 3D view, on desktop and mobile.

= For the merchant =

* Prices calculated to the cent from the built-in reference catalogue, by your own store, without any connection to an external service.
* The configuration sent by the browser is checked field by field against an allowlist, then against the catalogue; combinations that cannot be manufactured, and values the catalogue does not know, are refused before the cart.
* WooCommerce cart and orders, with the configuration attached to each order line.
* Compatible with WooCommerce order storage (HPOS).

= Full version =

This plugin uses the built-in reference catalogue. The full version from Ahime sells at your own prices and adds workshop tools (site survey on each order, production file), updates and support. More at https://ahime.net

= Source code =

The configurator is written in TypeScript and React. This plugin ships a readable, unminified build of it in the `assets` folder. The human-readable source code of that build, the build configuration and the build instructions are public:

https://github.com/nahim-salami/ahime-joinery-configurator

To rebuild the JavaScript from that repository: `npm ci`, then `npm run build` (Node.js 20 or later). The files are written to `ahime-joinery-configurator/assets/`.

= Third-party libraries =

The JavaScript build bundles the following libraries, each under the MIT license, unmodified:

* React 18.3.1 and React DOM 18.3.1, with Scheduler 0.23.2: https://github.com/facebook/react
* three.js 0.185.1 (r185): https://github.com/mrdoob/three.js

They are bundled from their published npm packages, in their own production builds.

== Installation ==

1. Install and activate WooCommerce.
2. Install Ahime Joinery Configurator from Plugins > Add New, or upload the ZIP file, then activate it.
3. Create a WooCommerce product (for example "Custom window") and note its ID.
4. Add the shortcode to a page: `[ahjc_configurator famille="fenetre" produit="123"]` (replace 123 with the product ID).

Families for the `famille` attribute: fenetre (window), porte-fenetre (French window), coulissant (sliding door), porte-entree (entrance door), fenetre-toit (roof window), volet-roulant (roller shutter), volet-battant (hinged shutter), porte-garage (garage door), store-banne (awning), moustiquaire (insect screen), store-interieur (interior blind), bso (external venetian blind), screen-zip (zip screen).

== Frequently Asked Questions ==

= Does the configurator call an external service? =

No. Prices and drawings are calculated in the customer's browser and checked again by your store. The plugin makes no network request.

= Can I use my own prices? =

This plugin uses the built-in reference catalogue. Selling at your own prices is part of the full version from Ahime.

= Where is the source code of the JavaScript? =

At https://github.com/nahim-salami/ahime-joinery-configurator, with the build tools and instructions. See the Source code section above.

== Screenshots ==

1. A two-leaf window configured with its dimensions, range, glazing and price.

== Changelog ==

= 0.5.0 =
* New name and slug: Ahime Joinery Configurator for WooCommerce (ahime-joinery-configurator).
* The plugin now only contains the windows, doors, shutters and blinds configurator.
* Cart: the posted configuration is filtered against an allowlist generated from the configuration type (known keys, types, allowed values, bounds); invalid configurations are refused with a notice.
* Pricing: a colour, glazing, door infill or other value unknown to the catalogue is refused by the server instead of being priced with a zero coefficient. A cart line that can no longer be priced is removed.
* All PHP identifiers, hooks, handles, meta keys and the shortcode use the ahjc prefix. The shortcode is now [ahjc_configurator].
* A single admin notice remains (unreadable catalogue), on the product edit screen only.
* Public source code and build instructions.

= 0.4.3 =
* Every PHP file refuses direct access; exception messages are escaped.

= 0.4.1 =
* First version submitted to WordPress.org.
