<?php

/**
 * Extends the collaborative editing sync server to support
 * custom post type capabilities.
 *
 * The core check_permissions() method has a hardcoded edit_posts gate
 * that blocks users who only have doc-specific capabilities (edit_docs).
 * This subclass temporarily grants edit_posts for doc-capable users so
 * the parent's full permission logic (including per-room checks) runs.
 */
class Docs_HTTP_Polling_Sync_Server_Custom_Caps extends WP_HTTP_Polling_Sync_Server {

	/**
	 * Checks if the current user has permission to access sync rooms.
	 *
	 * For users with edit_docs but not edit_posts, temporarily grants
	 * edit_posts so the parent check_permissions can run its full
	 * per-room validation (which includes the private
	 * can_user_sync_entity_type method).
	 *
	 * @param WP_REST_Request $request The REST request.
	 * @return bool|WP_Error True if user has permission, otherwise WP_Error.
	 */
	public function check_permissions( WP_REST_Request $request ) {
		if ( current_user_can( 'edit_posts' ) || ! current_user_can( 'edit_docs' ) ) {
			return parent::check_permissions( $request );
		}

		$grant_edit_posts = function( $allcaps ) {
			$allcaps['edit_posts'] = true;
			return $allcaps;
		};

		add_filter( 'user_has_cap', $grant_edit_posts );
		$result = parent::check_permissions( $request );
		remove_filter( 'user_has_cap', $grant_edit_posts );

		return $result;
	}
}
