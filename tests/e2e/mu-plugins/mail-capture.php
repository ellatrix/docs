<?php
/**
 * Captures outgoing emails for e2e testing.
 *
 * Accumulates all emails in a transient, readable via REST API.
 * Reading the emails also deletes them (consume on read).
 */

add_filter( 'pre_wp_mail', function( $null, $atts ) {
	$emails = get_transient( 'docs_captured_emails' ) ?: array();
	$emails[] = array(
		'to'      => $atts['to'],
		'subject' => $atts['subject'],
		'message' => $atts['message'],
	);
	set_transient( 'docs_captured_emails', $emails );

	return true;
}, 10, 2 );

add_action( 'rest_api_init', function() {
	register_rest_route( 'docs-test/v1', '/emails', array(
		'methods'             => 'GET',
		'callback'            => function() {
			$emails = get_transient( 'docs_captured_emails' ) ?: array();
			delete_transient( 'docs_captured_emails' );
			return $emails;
		},
		'permission_callback' => '__return_true',
	) );
} );
