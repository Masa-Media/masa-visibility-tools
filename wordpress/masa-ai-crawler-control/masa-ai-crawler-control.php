<?php
/**
 * Plugin Name:       Masa AI Crawler Control
 * Plugin URI:        https://masamedia.co.il/tools/ai-crawler-control/
 * Description:       Choose which AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended and more) may access your site — from one settings screen. Writes clean robots.txt rules and an optional llms.txt.
 * Version:           0.1.0
 * Requires at least: 5.8
 * Requires PHP:      7.2
 * Author:            Masa Media Digital LTD
 * Author URI:        https://masamedia.co.il
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       masa-ai-crawler-control
 *
 * @package MasaAICrawlerControl
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

final class Masa_AICC {

	const OPTION  = 'masa_aicc_settings';
	const VERSION = '0.1.0';

	/**
	 * Supported AI crawlers, grouped by the company behind them.
	 *
	 * @return array<string,array<string,string>> agent token => [label, group]
	 */
	public static function crawlers() {
		return array(
			'GPTBot'             => array( 'label' => 'OpenAI GPTBot (model training)', 'group' => 'OpenAI' ),
			'OAI-SearchBot'      => array( 'label' => 'OpenAI SearchBot (ChatGPT search)', 'group' => 'OpenAI' ),
			'ChatGPT-User'       => array( 'label' => 'OpenAI ChatGPT-User (user browsing)', 'group' => 'OpenAI' ),
			'ClaudeBot'          => array( 'label' => 'Anthropic ClaudeBot', 'group' => 'Anthropic' ),
			'anthropic-ai'       => array( 'label' => 'Anthropic anthropic-ai', 'group' => 'Anthropic' ),
			'PerplexityBot'      => array( 'label' => 'Perplexity PerplexityBot', 'group' => 'Perplexity' ),
			'Perplexity-User'    => array( 'label' => 'Perplexity-User (user browsing)', 'group' => 'Perplexity' ),
			'Google-Extended'    => array( 'label' => 'Google-Extended (Gemini / AI Overviews training)', 'group' => 'Google' ),
			'CCBot'              => array( 'label' => 'Common Crawl CCBot', 'group' => 'Common Crawl' ),
			'Bytespider'         => array( 'label' => 'ByteDance Bytespider', 'group' => 'ByteDance' ),
			'Amazonbot'          => array( 'label' => 'Amazonbot', 'group' => 'Amazon' ),
			'Applebot-Extended'  => array( 'label' => 'Applebot-Extended (Apple AI training)', 'group' => 'Apple' ),
			'meta-externalagent' => array( 'label' => 'Meta meta-externalagent', 'group' => 'Meta' ),
		);
	}

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'add_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_filter( 'robots_txt', array( __CLASS__, 'filter_robots' ), 20, 2 );
		add_action( 'template_redirect', array( __CLASS__, 'maybe_serve_llms' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), array( __CLASS__, 'action_links' ) );
	}

	/**
	 * Stored settings, with safe defaults (everything allowed).
	 *
	 * @return array
	 */
	public static function get_settings() {
		$defaults = array(
			'blocked'   => array(), // list of agent tokens to block
			'serve_llms' => 0,
		);
		$saved = get_option( self::OPTION, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		return wp_parse_args( $saved, $defaults );
	}

	public static function add_menu() {
		add_options_page(
			__( 'Masa AI Crawler Control', 'masa-ai-crawler-control' ),
			__( 'AI Crawler Control', 'masa-ai-crawler-control' ),
			'manage_options',
			'masa-aicc',
			array( __CLASS__, 'render_page' )
		);
	}

	public static function register_settings() {
		register_setting(
			'masa_aicc_group',
			self::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
				'default'           => array(),
			)
		);
	}

	/**
	 * Sanitize submitted settings: only known crawler tokens may be blocked.
	 *
	 * @param mixed $input Raw input.
	 * @return array
	 */
	public static function sanitize( $input ) {
		$valid   = array_keys( self::crawlers() );
		$blocked = array();
		if ( isset( $input['blocked'] ) && is_array( $input['blocked'] ) ) {
			foreach ( $input['blocked'] as $token ) {
				$token = sanitize_text_field( wp_unslash( $token ) );
				if ( in_array( $token, $valid, true ) ) {
					$blocked[] = $token;
				}
			}
		}
		return array(
			'blocked'    => array_values( array_unique( $blocked ) ),
			'serve_llms' => empty( $input['serve_llms'] ) ? 0 : 1,
		);
	}

	/**
	 * Append per-crawler rules to the virtual robots.txt.
	 *
	 * @param string $output Existing robots.txt body.
	 * @param bool   $public Whether the site is public.
	 * @return string
	 */
	public static function filter_robots( $output, $public ) {
		if ( ! $public ) {
			return $output; // Respect "discourage search engines".
		}
		$settings = self::get_settings();
		if ( empty( $settings['blocked'] ) ) {
			return $output;
		}
		$lines   = array( '', '# Managed by Masa AI Crawler Control (masamedia.co.il)' );
		foreach ( $settings['blocked'] as $token ) {
			$lines[] = 'User-agent: ' . $token;
			$lines[] = 'Disallow: /';
			$lines[] = '';
		}
		return $output . implode( "\n", $lines ) . "\n";
	}

	/**
	 * Optionally serve /llms.txt describing the site for AI answer engines.
	 */
	public static function maybe_serve_llms() {
		$settings = self::get_settings();
		if ( empty( $settings['serve_llms'] ) ) {
			return;
		}
		$request = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ), PHP_URL_PATH ) : '';
		if ( '/llms.txt' !== untrailingslashit( (string) $request ) ) {
			return;
		}
		$name = get_bloginfo( 'name' );
		$desc = get_bloginfo( 'description' );
		$home = home_url( '/' );
		$body  = '# ' . $name . "\n\n";
		if ( $desc ) {
			$body .= '> ' . $desc . "\n\n";
		}
		$body .= "## Site\n";
		$body .= '- [Home](' . $home . ")\n";
		$pages = get_pages( array( 'sort_column' => 'menu_order', 'number' => 20 ) );
		if ( $pages ) {
			$body .= "\n## Key pages\n";
			foreach ( $pages as $page ) {
				$body .= '- [' . wp_strip_all_tags( $page->post_title ) . '](' . get_permalink( $page ) . ")\n";
			}
		}
		$body .= "\n<!-- llms.txt generated by Masa AI Crawler Control, masamedia.co.il -->\n";

		header( 'Content-Type: text/plain; charset=utf-8' );
		header( 'X-Robots-Tag: noindex' );
		echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- plain text/plain body.
		exit;
	}

	public static function action_links( $links ) {
		$url  = admin_url( 'options-general.php?page=masa-aicc' );
		$link = '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'masa-ai-crawler-control' ) . '</a>';
		array_unshift( $links, $link );
		return $links;
	}

	public static function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$settings = self::get_settings();
		$blocked  = (array) $settings['blocked'];
		$groups   = array();
		foreach ( self::crawlers() as $token => $meta ) {
			$groups[ $meta['group'] ][ $token ] = $meta['label'];
		}
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Masa AI Crawler Control', 'masa-ai-crawler-control' ); ?></h1>
			<p><?php esc_html_e( 'Tick a crawler to block it from your whole site. Blocking writes a robots.txt rule; leaving it unticked keeps the crawler allowed. Nothing is blocked until you choose.', 'masa-ai-crawler-control' ); ?></p>
			<form method="post" action="options.php">
				<?php settings_fields( 'masa_aicc_group' ); ?>
				<?php foreach ( $groups as $group => $items ) : ?>
					<h2><?php echo esc_html( $group ); ?></h2>
					<table class="form-table" role="presentation">
						<tbody>
						<?php foreach ( $items as $token => $label ) : ?>
							<tr>
								<th scope="row"><code><?php echo esc_html( $token ); ?></code></th>
								<td>
									<label>
										<input type="checkbox" name="<?php echo esc_attr( self::OPTION ); ?>[blocked][]" value="<?php echo esc_attr( $token ); ?>" <?php checked( in_array( $token, $blocked, true ) ); ?> />
										<?php echo esc_html( $label ); ?>
										<?php if ( in_array( $token, $blocked, true ) ) : ?>
											<strong style="color:#b32d2e;"><?php esc_html_e( '(blocked)', 'masa-ai-crawler-control' ); ?></strong>
										<?php endif; ?>
									</label>
								</td>
							</tr>
						<?php endforeach; ?>
						</tbody>
					</table>
				<?php endforeach; ?>

				<h2><?php esc_html_e( 'llms.txt', 'masa-ai-crawler-control' ); ?></h2>
				<table class="form-table" role="presentation">
					<tbody>
						<tr>
							<th scope="row"><?php esc_html_e( 'Serve /llms.txt', 'masa-ai-crawler-control' ); ?></th>
							<td>
								<label>
									<input type="checkbox" name="<?php echo esc_attr( self::OPTION ); ?>[serve_llms]" value="1" <?php checked( ! empty( $settings['serve_llms'] ) ); ?> />
									<?php esc_html_e( 'Publish a plain-text llms.txt summarising your site for AI answer engines.', 'masa-ai-crawler-control' ); ?>
								</label>
								<?php if ( ! empty( $settings['serve_llms'] ) ) : ?>
									<p class="description"><a href="<?php echo esc_url( home_url( '/llms.txt' ) ); ?>" target="_blank" rel="noopener"><?php echo esc_html( home_url( '/llms.txt' ) ); ?></a></p>
								<?php endif; ?>
							</td>
						</tr>
					</tbody>
				</table>

				<?php submit_button(); ?>
			</form>
			<hr />
			<p class="description">
				<?php
				printf(
					/* translators: %s: company link. */
					esc_html__( 'This tool works only when WordPress serves a virtual robots.txt (no physical robots.txt file at your site root). Made by %s.', 'masa-ai-crawler-control' ),
					'<a href="https://masamedia.co.il" target="_blank" rel="noopener">Masa Media Digital LTD</a>'
				);
				?>
			</p>
		</div>
		<?php
	}
}

Masa_AICC::init();
