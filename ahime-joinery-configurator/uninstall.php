<?php
/**
 * Ahime Joinery Configurator uninstall.
 *
 * The plugin stores no option, transient or user meta of its own: its only data are the configuration
 * details attached to WooCommerce order lines (meta keys _ahjc_configuration, _ahjc_catalogue_version and
 * _ahjc_prix_annonce_cents). Those belong to the merchant's orders and are kept on purpose.
 *
 * Defensive clean-up: should any option or transient with the plugin prefix exist, it is removed.
 *
 * @package AhimeJoineryConfigurator
 */

defined('WP_UNINSTALL_PLUGIN') || exit;

global $wpdb;
$ahjc_options = $wpdb->get_col( // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- one-off clean-up at uninstall, nothing to cache
    $wpdb->prepare(
        "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s",
        $wpdb->esc_like('ahjc_') . '%',
        $wpdb->esc_like('_transient_ahjc_') . '%',
        $wpdb->esc_like('_transient_timeout_ahjc_') . '%'
    )
);
foreach ($ahjc_options as $ahjc_option) {
    delete_option($ahjc_option);
}
