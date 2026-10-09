<?php
/**
 * Plugin Name:       Ahime Joinery Configurator for WooCommerce
 * Plugin URI:        https://github.com/nahim-salami/ahime-joinery-configurator
 * Description:       Let customers configure windows, doors, shutters and blinds in 2D and 3D, with a price calculated to the cent and checked again by your store before the order is written.
 * Version:           0.5.0
 * Author:            Ahime
 * Author URI:        https://www.ahime.net
 * Requires at least: 6.5
 * Requires PHP:      8.1
 * WC requires at least: 8.0
 * Requires Plugins:  woocommerce
 * Text Domain:       ahime-joinery-configurator
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package AhimeJoineryConfigurator
 */

if (!defined('ABSPATH')) {
    exit;
}

// When the full version of this configurator (sold by Ahime) is active, it does everything this one does:
// this plugin steps aside so that only one configurator is loaded.
if (defined('JNC_VERSION')) {
    return;
}

define('AHJC_VERSION', '0.5.0');
define('AHJC_CHEMIN', plugin_dir_path(__FILE__));
define('AHJC_URL', plugin_dir_url(__FILE__));

// The pricing and validation engine. These classes only know a catalogue array and a configuration array:
// they never call WordPress, which is what lets the same engine run in the browser (TypeScript) and here.
require_once AHJC_CHEMIN . 'includes/class-ahjc-catalogue.php';
require_once AHJC_CHEMIN . 'includes/class-ahjc-mecanique.php';
require_once AHJC_CHEMIN . 'includes/class-ahjc-structural.php';
require_once AHJC_CHEMIN . 'includes/class-ahjc-pricing.php';
require_once AHJC_CHEMIN . 'includes/class-ahjc-validate.php';
// The WooCommerce glue: the allowlist of a posted configuration, and the cart.
require_once AHJC_CHEMIN . 'includes/class-ahjc-configuration.php';
require_once AHJC_CHEMIN . 'includes/class-ahjc-panier.php';

/** Compatible with WooCommerce order storage (HPOS): only order item meta is read and written. */
add_action('before_woocommerce_init', static function (): void {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
    }
});

/** The technical meta of an order line stays in the order, but is not printed as raw JSON under the item. */
add_filter('woocommerce_hidden_order_itemmeta', static function (array $cachees): array {
    return array_merge($cachees, ['_ahjc_configuration', '_ahjc_catalogue_version', '_ahjc_prix_annonce_cents']);
});

/**
 * The reference catalogue shipped with the plugin, loaded once per request.
 *
 * There is no silent fallback to an empty catalogue: a pricing engine without prices returns zero, and zero
 * is a price the server would write into an order. An unreadable catalogue is reported to the administrator
 * instead (see ahjc_signaler_le_catalogue()).
 */
function ahjc_catalogue(): ?AHJC_Catalogue
{
    static $catalogue = null;
    static $tente = false;
    if ($tente) {
        return $catalogue;
    }
    $tente = true;
    try {
        $catalogue = AHJC_Catalogue::depuisFichier(AHJC_CHEMIN . 'catalogue.json');
    } catch (Throwable $erreur) {
        ahjc_signaler_le_catalogue();
        $catalogue = null;
    }
    return $catalogue;
}

/**
 * The only admin notice of the plugin: the shipped catalogue could not be read (a damaged installation).
 * It is shown on the WooCommerce product edit screen only, where the configurator product is set up, and it
 * can be dismissed.
 */
function ahjc_signaler_le_catalogue(): void
{
    add_action('admin_notices', static function (): void {
        $ecran = function_exists('get_current_screen') ? get_current_screen() : null;
        if ($ecran === null || $ecran->id !== 'product') {
            return;
        }
        printf(
            '<div class="notice notice-error is-dismissible"><p>%s</p></div>',
            esc_html__('Ahime Joinery Configurator: the price catalogue shipped with the plugin cannot be read. Reinstall the plugin.', 'ahime-joinery-configurator')
        );
    });
}

add_action('plugins_loaded', static function (): void {
    // WordPress refuses to activate this plugin without WooCommerce (Requires Plugins header).
    if (!class_exists('WooCommerce')) {
        return;
    }
    $catalogue = ahjc_catalogue();
    if ($catalogue === null) {
        return;
    }
    $structural = new AHJC_Structural($catalogue);
    $pricing = new AHJC_Pricing($catalogue, $structural);
    $validate = new AHJC_Validate($catalogue, $structural);
    (new AHJC_Panier($catalogue, $pricing, $validate))->brancher();
});

/**
 * The configurator, placed by a shortcode: `[ahjc_configurator famille="fenetre" produit="123"]`.
 *
 * `famille` is the product family the configurator opens on, `produit` the ID of the WooCommerce product
 * that carries the cart line. Everything else (catalogue, language, cart nonce) reaches the web component as
 * JSON in `window.__AHJC_CONTEXT__`, never as HTML attributes.
 *
 * @param array<string,string>|string $attributs
 */
function ahjc_shortcode($attributs = []): string
{
    $a = shortcode_atts(
        ['famille' => 'fenetre', 'produit' => '0'],
        is_array($attributs) ? $attributs : [],
        'ahjc_configurator'
    );
    $catalogue = ahjc_catalogue();
    if ($catalogue === null || !function_exists('wc_get_cart_url')) {
        return '';
    }
    $familles = array_keys((array) $catalogue->get('familles'));
    $famille = sanitize_key($a['famille']);
    if (!in_array($famille, $familles, true)) {
        $famille = 'fenetre';
    }
    $produit = absint($a['produit']);
    $jeton = wp_create_nonce(AHJC_Panier::JETON);

    wp_enqueue_script('ahjc-widget', AHJC_URL . 'assets/ahjc-widget.js', [], AHJC_VERSION, true);
    wp_add_inline_script(
        'ahjc-widget',
        'window.__AHJC_CONTEXT__ = ' . wp_json_encode([
            'plateforme' => 'wordpress',
            // The same catalogue the server prices with: the browser never shows a price the cart recalculates
            // differently.
            'pricing' => $catalogue->donnees(),
            'famillesActives' => [$famille],
            'langue' => substr(get_locale(), 0, 2),
            // The widget only shows "Add to cart" when it has a nonce.
            'nonce' => $jeton,
            'urlPanier' => wc_get_cart_url(),
        ]) . ';',
        'before'
    );

    // ADDING TO THE CART. The widget posts nothing itself: it emits `ahjc:panier` (configuration, quantity)
    // and `ahjc:configuration` (current price). This bridge turns them into the standard WooCommerce
    // add-to-cart form. The server filters the configuration, validates it and recalculates the price: the
    // price announced by the browser is only compared, never trusted.
    wp_add_inline_script(
        'ahjc-widget',
        '(function(){var prix=null;'
        . 'document.addEventListener("ahjc:configuration",function(e){if(e.detail){prix=e.detail.totalCents;}});'
        . 'document.addEventListener("ahjc:panier",function(e){if(!e.detail||!e.detail.config){return;}'
        . 'var f=document.createElement("form");f.method="post";f.action=' . wp_json_encode(wc_get_cart_url()) . ';'
        . 'var champs={"add-to-cart":' . $produit . ',"quantity":e.detail.quantite||1,'
        . '"ahjc_configuration":JSON.stringify(e.detail.config),'
        . '"ahjc_nonce":' . wp_json_encode($jeton) . '};'
        . 'if(prix!==null){champs.ahjc_prix_annonce_cents=prix;}'
        . 'Object.keys(champs).forEach(function(k){var i=document.createElement("input");i.type="hidden";i.name=k;i.value=String(champs[k]);f.appendChild(i);});'
        . 'document.body.appendChild(f);f.submit();});})();',
        'before'
    );

    return sprintf(
        '<ahjc-configurator data-famille="%s" data-produit="%d"></ahjc-configurator>',
        esc_attr($famille),
        $produit
    );
}
add_shortcode('ahjc_configurator', 'ahjc_shortcode');

/**
 * The widget is an ES module (lazy chunks): only the tag that carries `src` becomes `type="module"`. The
 * context printed "before" stays a classic script, so it runs first.
 */
add_filter('script_loader_tag', static function (string $balise, string $poignee): string {
    if ($poignee !== 'ahjc-widget') {
        return $balise;
    }
    return (string) preg_replace('/<script(?![^>]*\btype=)([^>]*\bsrc=)/', '<script type="module"$1', $balise);
}, 10, 2);

/** The single link to the full version, in the plugin row on the Plugins screen. */
add_filter('plugin_row_meta', static function (array $liens, string $fichier): array {
    if ($fichier === plugin_basename(__FILE__)) {
        $liens[] = sprintf(
            '<a href="%s" target="_blank" rel="noopener">%s</a>',
            esc_url('https://ahime.net'),
            esc_html__('Full version from Ahime', 'ahime-joinery-configurator')
        );
    }
    return $liens;
}, 10, 2);
