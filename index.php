<?php

/*
 * Plugin Name: Docs
 * Plugin URI: https://wordpress.org/plugins/docs/
 * Description: Create and share documents with WordPress!
 * Version: 0.0.1
 * Author: Ella van Durpe
 * Author URI: https://ellavandurpe.com
 * License: GPLv2 or later
 * Text Domain: docs
 */

add_action( 'init', function() {
    require 'register.php';
} );

register_activation_hook( __FILE__, function() {
	remove_role( 'docs_anon' );
	add_role( 'docs_anon', __( 'Anonymous (Docs)', 'docs' ) );

	// Admin, editor: full doc caps including editing others' docs.
	foreach ( array( 'administrator', 'editor' ) as $role_name ) {
		$role = get_role( $role_name );
		$role->add_cap( 'create_docs' );
		$role->add_cap( 'edit_others_docs' );
		$role->add_cap( 'edit_docs' );
		$role->add_cap( 'edit_published_docs' );
	}

	$role = get_role( 'author' );
	$role->add_cap( 'create_docs' );
	$role->add_cap( 'edit_docs' );
	$role->add_cap( 'edit_published_docs' );

	$role = get_role( 'contributor' );
	$role->add_cap( 'create_docs' );
	$role->add_cap( 'edit_docs' );

	// docs_anon: minimal caps. edit_docs is needed as a generic capability
	// check (e.g. WP 7.0 collab sync endpoint). Per-doc access is still
	// controlled by the user_has_cap filter based on sharing settings.
	$role = get_role( 'docs_anon' );

	$role->add_cap( 'edit_docs' );
	// Required to read global styles (wp_global_styles CPT) which the block
	// editor fetches client-side for theme features like padding-aware alignments.
	$role->add_cap( 'read' );

	require 'register.php';
	flush_rewrite_rules();

	if ( ! wp_next_scheduled( 'docs_cleanup_anon_users' ) ) {
		wp_schedule_event( time(), 'daily', 'docs_cleanup_anon_users' );
	}
} );

register_deactivation_hook( __FILE__, function() {
	wp_clear_scheduled_hook( 'docs_cleanup_anon_users' );
} );

// Delete anonymous users whose sessions have all expired.
// Anon users can't re-authenticate, so expired sessions mean the user is unreachable.
add_action( 'docs_cleanup_anon_users', function() {
	$anon_users = get_users( array( 'role' => 'docs_anon' ) );

	foreach ( $anon_users as $user ) {
		$manager = WP_Session_Tokens::get_instance( $user->ID );

		if ( empty( $manager->get_all() ) ) {
			wp_delete_user( $user->ID );
		}
	}
} );

function docs__get_or_create_user_by_email( $email_address ) {
	$user = get_user_by( 'email', $email_address );

	if ( ! empty( $user ) ) {
		return $user;
	}

	return get_user_by( 'id', wp_insert_user( array(
		'user_pass' => wp_generate_password(),
		'user_login' => wp_generate_password(),
		'display_name' => $email_address,
		'user_email' => $email_address,
		'role' => 'docs_anon',
	) ) );
}

function docs__send_email( $email_address, $post ) {
	if ( ! is_email( $email_address ) ) {
		return;
	}

	$user = docs__get_or_create_user_by_email( $email_address );

	if ( is_multisite() ) {
		$site_name = get_network()->site_name;
	} else {
		$site_name = wp_specialchars_decode( get_option( 'blogname' ), ENT_QUOTES );
	}

	$post_title = get_the_title( $post );
	$title = sprintf( __( 'Invitation to Edit "%s"', 'docs' ), $post_title );
	$title = wp_specialchars_decode( $title );

	$link = get_permalink( $post );
	$link = add_query_arg( array(
		'action' => 'rp',
		'key' => get_password_reset_key( $user ),
		'login' => rawurlencode( $user->user_login ),
	), $link );

	$message = (
		"Hi $email_address\r\n\r\n" .
		"$site_name invites you to edit \"$post_title\". Use the link below to open the editor.\r\n\r\n" .
		$link
	);

	return wp_mail( $email_address, $title, $message );
}

// Redirect front end to admin.
add_action( 'template_redirect', function() {
	global $post;
	global $doc_errors;
	global $wp_query;
	global $wpdb;

	if ( is_singular( 'doc' /* 'post', 'page' */ ) ) {
		$doc_errors = new WP_Error();
		$current_user = wp_get_current_user();

		if (
			isset( $_GET['action'] ) &&
			isset( $_GET['key'] ) &&
			isset( $_GET['login'] ) &&
			$_GET['login'] !== $current_user->user_login &&
			$_GET['action'] === 'rp'
		) {
			$user = check_password_reset_key( $_GET['key'], $_GET['login'] );
			$wpdb->update(
				$wpdb->users,
				array( 'user_activation_key' => '' ),
				array( 'user_login' => $_GET['login'] )
			);

			if ( is_wp_error( $user ) ) {
				$doc_errors = $user;
			} else {
				// Reload with auth cookie.
				wp_set_auth_cookie( $user->ID, true );
				wp_redirect( get_permalink() );
				exit;
			}
		}

		if ( ! is_user_logged_in() ) {
			if ( $post->post_status !== 'draft' ) {
				return;
			}

			$anyone = get_post_meta( $post->ID, 'docs-share-anyone', true );

			if ( $anyone === 'anyone' ) {
				$animals = array(
					'1f436', '1f431', '1f42d', '1f439', '1f430', '1f98a',
					'1f43b', '1f43c', '1f428', '1f42f', '1f981', '1f435',
				);

				$id = wp_insert_user( array(
					'user_pass' => wp_generate_password(),
					'user_login' => wp_generate_password(),
					// We could randomise for fun. :)
					'display_name' => __( 'Anonymous', 'docs' ),
					'admin_color' => 'coffee',
					'role' => 'docs_anon',
				) );

				add_user_meta( $id, 'animal', $animals[ array_rand( $animals ) ], true );

				// Reload with auth cookie.
				wp_set_auth_cookie( $id, true );
				wp_redirect( get_permalink() );
				die;
			}

			if ( $anyone !== 'email' ) {
				exit;
			}

			if ( ! $_POST ) {
				include ABSPATH . 'wp-login.php';
				exit;
			}

			if (
				empty( $_POST['user_login'] ) ||
				! is_string( $_POST['user_login'] )
			) {
				$doc_errors->add( 'empty_username', __( '<strong>Error</strong>: Enter an email address.', 'docs' ) );
				include ABSPATH . 'wp-login.php';
				exit;
			}

			$email_address = trim( wp_unslash( $_POST['user_login'] ) );

			if ( ! is_email( $email_address ) ) {
				$doc_errors->add( 'empty_username', __( '<strong>Error</strong>: Enter an email address.', 'docs' ) );
				include ABSPATH . 'wp-login.php';
				exit;
			}

			$email_addresses = get_post_meta( $post->ID, 'docs-share-email-addresses', true );
			$email_addresses = preg_split( '/[\s,]+/', $email_addresses );
			$email_address = trim( wp_unslash( $_POST['user_login'] ) );

			if ( ! in_array( $email_address, $email_addresses ) ) {
				$doc_errors->add( 'empty_username', __( '<strong>Error</strong>: You do not have acces to edit this document.', 'docs' ) );
				include ABSPATH . 'wp-login.php';
				exit;
			}

			if ( ! docs__send_email( $email_address, $post ) ) {
				$doc_errors->add(
					'retrieve_password_email_failure',
					sprintf(
						/* translators: %s: Documentation URL. */
						__( '<strong>ERROR</strong>: The email could not be sent. Your site may not be correctly configured to send emails. <a href="%s">Get support for resetting your password</a>.' ),
						esc_url( __( 'https://wordpress.org/support/article/resetting-your-password/' ) )
					)
				);
				include ABSPATH . 'wp-login.php';
				exit;
			}

			wp_safe_redirect( add_query_arg( 'checkemail', 'confirm',  get_permalink() ) );
			exit;
		} else /* if ( is_singular( array( 'doc' ) ) ) */ {
			wp_redirect( get_edit_post_link( get_the_ID(), null ) );
			exit;
		}
	}
} );

add_action( 'login_init', function() {
	if ( ! is_singular( 'doc' ) ) {
		return;
	}

	if ( isset( $_GET[ 'checkemail' ] ) ) {
		login_header(
			__( 'Magic Link', 'docs' ),
			'<p class="message">' .
				__( 'Email sent.' ) .
			'</p>'
		);
		login_footer();
		exit;
	}

	global $doc_errors;

	login_header(
		__( 'Magic Link', 'docs' ),
		'<p class="message">' .
			__( 'Please enter your email address. You will receive a link to login.', 'docs' ) .
		'</p>',
		$doc_errors
	);

	$user_login = '';

	if ( isset( $_POST['user_login'] ) && is_string( $_POST['user_login'] ) ) {
		$user_login = wp_unslash( $_POST['user_login'] );
	}

	?>
	<form name="lostpasswordform" id="lostpasswordform" action="<?php echo esc_url( get_permalink() ); ?>" method="post">
		<p>
			<label for="user_login" ><?php _e( 'Email Address', 'docs' ); ?><br />
			<input type="text" name="user_login" id="user_login" class="input" value="<?php echo esc_attr( $user_login ); ?>" size="20" autocapitalize="off" /></label>
		</p>
		<p class="submit">
			<input type="submit" name="wp-submit" id="wp-submit" class="button button-primary button-large" value="<?php esc_attr_e( 'Get Link' ); ?>" />
		</p>
	</form>
	<?php
	login_footer();
	exit;
} );

add_filter( 'get_avatar_url', function( $url, $id ) {
	if ( is_string( $id ) ) {
		$id = get_user_by( 'email', $id );
	}

	$animal = get_user_meta( $id, 'animal', true );

	if ( ! $animal ) {
		return $url;
	}

	return "https://s.w.org/images/core/emoji/12.0.0-1/svg/$animal.svg";
}, 10, 2 );

// Make the permalink pretty even though the post type stays in draft status.
add_filter( 'post_type_link', function( $permalink, $post, $leavename, $sample ) {
	if ( $post->post_type !== 'doc' || $post->_docs_permalink_filter ) {
		return $permalink;
	}

	$original_post_status = $post->post_status;
	$post->post_status = 'publish';
	$post->_docs_permalink_filter = true;
	$permalink = get_permalink( $post, $leavename, $sample );
	$post->post_status = $original_post_status;
	return $permalink;
}, 10, 4 );

// Set the permalink and post status when creating a doc.
add_action( 'wp_insert_post_data', function( $data ) {
	if ( $data[ 'post_type' ] === 'doc' ) {
		if ( $data[ 'post_status' ] === 'publish' ) {
			// Always keep the post in draft state.
			$data[ 'post_status' ] = 'draft';
		}

		if ( ! $data[ 'post_name' ] ) {
			// Ideally we use wp_generate_password, but queries are case
			// insentitive in WordPress. Need to find a way around.
			$data[ 'post_name' ] = bin2hex( random_bytes( 30 ) );
		}
	}

	return $data;
} );

// Store the old meta as a global before it is updated.
add_action( 'update_postmeta', function( $meta_id, $object_id, $meta_key, $meta_value ) {
	if ( $meta_key !== 'docs-share-email-addresses' ) {
		return;
	}

	global $docs_old_email_addresses;

	$docs_old_email_addresses = get_post_meta( $object_id, $meta_key, true );
}, 10, 4 );

// Compare the old and new meta. Send an email to any new email addresses found.
add_action( 'updated_postmeta', function( $meta_id, $object_id, $meta_key, $meta_value ) {
	if ( $meta_key !== 'docs-share-email-addresses' ) {
		return;
	}

	global $docs_old_email_addresses;

	if ( $meta_value !== $docs_old_email_addresses ) {
		$email_addresses = preg_split( '/[\s,]+/', $meta_value );
		$old_email_addresses = preg_split( '/[\s,]+/', $docs_old_email_addresses );
		$diff = array_diff( $email_addresses, $old_email_addresses );

		foreach ( $diff as $email_address ) {
			docs__send_email( $email_address, $object_id );
		}
	}
}, 10, 4 );

add_action( 'added_post_meta', function( $meta_id, $object_id, $meta_key, $meta_value ) {
	if ( $meta_key !== 'docs-share-email-addresses' ) {
		return;
	}

	$email_addresses = preg_split( '/[\s,]+/', $meta_value );

	foreach ( $email_addresses as $email_address ) {
		docs__send_email( $email_address, $object_id );
	}
}, 10, 4 );

// Hide anonymous users in the admin user list.
add_filter( 'users_list_table_query_args', function( $args ) {
	$args[ 'role__not_in' ] = array( 'docs_anon' );
	return $args;
} );

add_action( 'enqueue_block_editor_assets', function() {
	if ( get_post_type() !== 'doc' ) {
		return;
	}

	wp_enqueue_style(
		'docs',
		plugins_url( 'index.css', __FILE__ ),
		array(),
		filemtime( dirname( __FILE__ ) . '/index.css' )
	);

	wp_enqueue_script(
		'docs',
		plugins_url( 'index.js', __FILE__ ),
		array(
			'wp-element',
			'wp-i18n',
			'wp-plugins',
			'wp-edit-post',
			'wp-data',
			'wp-components',
		),
		filemtime( dirname( __FILE__ ) . '/index.js' )
	);
} );

// Replace the core sync server with our subclass that supports doc capabilities.
// Register before core (priority 99) so our handler is tried first by the REST
// server. Core's handler remains as a fallback but is never reached.
add_action( 'rest_api_init', function() {
	if ( ! class_exists( 'WP_HTTP_Polling_Sync_Server' ) || ! wp_is_collaboration_enabled() ) {
		return;
	}

	require_once __DIR__ . '/class-docs-http-polling-sync-server-custom-caps.php';

	$sync_server = new Docs_HTTP_Polling_Sync_Server_Custom_Caps( new WP_Sync_Post_Meta_Storage() );
	$sync_server->register_routes();
}, 98 );

add_action( 'pre_get_posts', function( $query ) {
	if ( is_admin() || ! $query->query || ! isset( $query->query[ 'post_type' ] ) ) {
		return;
	}

	if ( $query->query[ 'post_type' ] === 'doc' ) {
		$query->set( 'post_status', 'draft' );
	}
} );

// Allow doc-capable users to read global styles. The block editor fetches the
// wp_global_styles entity client-side to resolve theme features (e.g. padding-aware
// alignments). read_post for this CPT maps to edit_posts via map_meta_cap, which
// doc-only users don't have.
add_filter( 'user_has_cap', function( $user_caps, $required_primitive_caps, $args ) {
	if ( $args[0] !== 'read_post' || ! isset( $args[2] ) ) {
		return $user_caps;
	}

	$post = get_post( $args[2] );

	if ( $post && $post->post_type === 'wp_global_styles' && ! empty( $user_caps['edit_docs'] ) ) {
		$user_caps['edit_posts'] = true;
	}

	return $user_caps;
}, 10, 3 );

// Grant or deny doc editing capabilities based on sharing settings.
// Users who don't already have edit_others_docs (subscribers, anon) get it
// dynamically when the doc is shared with them. Users who do have it get it
// revoked when the doc is not shared with them (unless they're the author).
add_filter( 'user_has_cap', function( $user_caps, $required_primitive_caps, $args ) {
	if ( ! in_array( $args[0], array( 'edit_post', 'read_post' ), true ) || ! isset( $args[2] ) ) {
		return $user_caps;
	}

	$post = get_post( $args[2] );

	if ( ! $post || $post->post_type !== 'doc' ) {
		return $user_caps;
	}

	$user_id = $args[1];

	// Authors can always edit their own docs.
	if ( (int) $post->post_author === $user_id ) {
		return $user_caps;
	}

	$anyone = get_post_meta( $post->ID, 'docs-share-anyone', true );

	// "Anyone with the link" — grant editing caps.
	if ( $anyone === 'anyone' ) {
		$user_caps['edit_docs']           = true;
		$user_caps['edit_others_docs']    = true;
		$user_caps['edit_published_docs'] = true;
		return $user_caps;
	}

	// "Email restricted" — grant caps only if user's email is in the list.
	if ( $anyone === 'email' ) {
		$email_addresses = get_post_meta( $post->ID, 'docs-share-email-addresses', true );

		if ( $email_addresses ) {
			$user = get_userdata( $user_id );
			$email_addresses = preg_split( '/[\s,]+/', $email_addresses );

			if ( $user && in_array( $user->user_email, $email_addresses, true ) ) {
				$user_caps['edit_docs']           = true;
				$user_caps['edit_others_docs']    = true;
				$user_caps['edit_published_docs'] = true;
				return $user_caps;
			}
		}
	}

	// Not shared — deny doc caps for non-authors.
	unset( $user_caps['edit_docs'], $user_caps['edit_others_docs'], $user_caps['edit_published_docs'] );
	return $user_caps;
}, 10, 3 );

// Users should only see their own documents.
add_action( 'pre_get_posts', function( $query ) {
	if ( ! is_post_type_archive( 'doc' ) ) {
		return;
	}

	$query->set( 'post_status', 'draft' );
	$query->set( 'author', (string) get_current_user_id() );
}, 9999999 );
