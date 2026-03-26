<?php
/**
 * Captures the last outgoing email for e2e testing.
 *
 * Stores the last email as a transient, readable via REST API.
 */

add_filter( 'pre_wp_mail', function( $null, $atts ) {
	set_transient( 'docs_last_email', array(
		'to'      => $atts['to'],
		'subject' => $atts['subject'],
		'message' => $atts['message'],
	) );

	return true;
}, 10, 2 );

add_action( 'rest_api_init', function() {
	register_rest_route( 'docs-test/v1', '/last-email', array(
		array(
			'methods'             => 'GET',
			'callback'            => function() {
				return get_transient( 'docs_last_email' ) ?: new WP_Error(
					'no_email',
					'No email captured',
					array( 'status' => 404 )
				);
			},
			'permission_callback' => '__return_true',
		),
		array(
			'methods'             => 'DELETE',
			'callback'            => function() {
				delete_transient( 'docs_last_email' );
				return true;
			},
			'permission_callback' => '__return_true',
		),
	) );
} );
