<?php

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

// Remove the docs_anon role (legacy).
remove_role( 'docs_anon' );

// Remove doc capabilities from standard roles.
foreach ( array( 'administrator', 'editor', 'author', 'contributor' ) as $role_name ) {
	$role = get_role( $role_name );
	if ( $role ) {
		$role->remove_cap( 'create_docs' );
		$role->remove_cap( 'edit_others_docs' );
		$role->remove_cap( 'edit_docs' );
		$role->remove_cap( 'edit_published_docs' );
	}
}
