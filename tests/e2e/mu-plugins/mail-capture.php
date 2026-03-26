<?php
/**
 * Captures the last outgoing email for e2e testing.
 *
 * Stores the last email as a transient, readable via REST API.
 * Reading the email also deletes it (consume on read).
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
		'methods'             => 'GET',
		'callback'            => function() {
			$email = get_transient( 'docs_last_email' );
			delete_transient( 'docs_last_email' );
			return $email ?: new WP_Error(
				'no_email',
				'No email captured',
				array( 'status' => 404 )
			);
		},
		'permission_callback' => '__return_true',
	) );
} );
