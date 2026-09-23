<?php
/**
 * Uninstall cleanup for Masa AI Crawler Control.
 *
 * @package MasaAICrawlerControl
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'masa_aicc_settings' );
