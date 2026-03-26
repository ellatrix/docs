<?php
/**
 * Captures all outgoing emails for e2e testing.
 *
 * Emails are stored in an option and exposed via a REST endpoint.
 */

// Intercept all emails — prevent sending, store in option.
add_filter( 'pre_wp_mail', function( $null, $atts ) {
	$captured = get_option( 'docs_captured_emails', array() );
	$captured[] = array(
		'to'      => $atts['to'],
		'subject' => $atts['subject'],
		'message' => $atts['message'],
		'time'    => time(),
	);
	update_option( 'docs_captured_emails', $captured );

	// Return true to short-circuit wp_mail — email is "sent" successfully.
	return true;
}, 10, 2 );

// REST endpoint to read and clear captured emails.
add_action( 'rest_api_init', function() {
	register_rest_route( 'docs-test/v1', '/emails', array(
		'methods'             => 'GET',
		'callback'            => function() {
			$emails = get_option( 'docs_captured_emails', array() );
			return $emails;
		},
		'permission_callback' => '__return_true',
	) );

	register_rest_route( 'docs-test/v1', '/emails', array(
		'methods'             => 'DELETE',
		'callback'            => function() {
			delete_option( 'docs_captured_emails' );
			return true;
		},
		'permission_callback' => '__return_true',
	) );
} );
