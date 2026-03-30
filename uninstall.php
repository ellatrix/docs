<?php

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Remove the docs_anon role.
remove_role( 'docs_anon' );

// Delete all docs_anon users.
$anon_users = get_users( array( 'role' => 'docs_anon' ) );
foreach ( $anon_users as $user ) {
	wp_delete_user( $user->ID );
}

// Clear the cron schedule.
wp_clear_scheduled_hook( 'docs_cleanup_anon_users' );
