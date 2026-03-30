<?php

/*
 * Plugin Name: Docs
 * Plugin URI: https://wordpress.org/plugins/docs/
 * Description: Create and share documents with WordPress!
 * Version: 0.0.2
 * Requires at least: 6.9
 * Requires Plugins: gutenberg
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
	// check (e.g. collab sync endpoint). Per-doc access is still
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

// Delete anonymous link users whose sessions have all expired.
// Only cleans up users without an email (truly anonymous "anyone with the link"
// visitors). Email-invited users are kept so they can be re-invited later.
add_action( 'docs_cleanup_anon_users', function() {
	$anon_users = get_users( array( 'role' => 'docs_anon' ) );

	foreach ( $anon_users as $user ) {
		if ( ! empty( $user->user_email ) ) {
			continue;
		}

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

	$author = get_userdata( get_post( $post )->post_author );
	$author_name = $author ? $author->display_name : '';

	$message = (
		"Hi $email_address\r\n\r\n" .
		"$author_name from \"$site_name\" invites you to edit \"$post_title\". Use the link below to open the editor.\r\n\r\n" .
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
			sanitize_text_field( wp_unslash( $_GET['login'] ) ) !== $current_user->user_login &&
			sanitize_text_field( wp_unslash( $_GET['action'] ) ) === 'rp'
		) {
			$reset_key   = sanitize_text_field( wp_unslash( $_GET['key'] ) );
			$reset_login = sanitize_text_field( wp_unslash( $_GET['login'] ) );

			$user = check_password_reset_key( $reset_key, $reset_login );
			$wpdb->update(
				$wpdb->users,
				array( 'user_activation_key' => '' ),
				array( 'user_login' => $reset_login )
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

			// "anyone with the link" — any of the link-sharing values.
			if ( in_array( $anyone, array( 'anyone', 'anyone-view', 'anyone-comment' ), true ) ) {
				$animals = array(
					'1f436' => __( 'Dog', 'docs' ),
					'1f431' => __( 'Cat', 'docs' ),
					'1f42d' => __( 'Mouse', 'docs' ),
					'1f439' => __( 'Hamster', 'docs' ),
					'1f430' => __( 'Rabbit', 'docs' ),
					'1f98a' => __( 'Fox', 'docs' ),
					'1f43b' => __( 'Bear', 'docs' ),
					'1f43c' => __( 'Panda', 'docs' ),
					'1f428' => __( 'Koala', 'docs' ),
					'1f42f' => __( 'Tiger', 'docs' ),
					'1f981' => __( 'Lion', 'docs' ),
					'1f435' => __( 'Monkey', 'docs' ),
				);

				$animal_code = array_rand( $animals );
				$animal_name = $animals[ $animal_code ];

				$id = wp_insert_user( array(
					'user_pass' => wp_generate_password(),
					'user_login' => wp_generate_password(),
					'display_name' => sprintf( __( 'Anonymous %s', 'docs' ), $animal_name ),
					'admin_color' => 'coffee',
					'role' => 'docs_anon',
				) );

				add_user_meta( $id, 'animal', $animal_code, true );

				// Reload with auth cookie.
				wp_set_auth_cookie( $id, true );
				wp_redirect( get_permalink() );
				die;
			}

			// Check if there are people with email access.
			$shared_user_ids = get_post_meta( $post->ID, 'docs-share-edit', false );

			if ( empty( $shared_user_ids ) ) {
				exit;
			}

			if ( ! $_POST ) {
				include ABSPATH . 'wp-login.php';
				exit;
			}

			if ( ! isset( $_POST['_wpnonce'] ) || ! wp_verify_nonce( $_POST['_wpnonce'], 'docs-magic-link' ) ) {
				$doc_errors->add( 'invalid_nonce', __( '<strong>Error</strong>: Security check failed. Please try again.', 'docs' ) );
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

			$email_address = sanitize_email( trim( wp_unslash( $_POST['user_login'] ) ) );

			if ( ! is_email( $email_address ) ) {
				$doc_errors->add( 'empty_username', __( '<strong>Error</strong>: Enter an email address.', 'docs' ) );
				include ABSPATH . 'wp-login.php';
				exit;
			}

			$user = get_user_by( 'email', $email_address );
			$shared_ids = array_map( 'intval', get_post_meta( $post->ID, 'docs-share-edit', false ) );

			if ( ! $user || ! in_array( $user->ID, $shared_ids, true ) ) {
				$doc_errors->add( 'empty_username', __( '<strong>Error</strong>: You do not have access to this document.', 'docs' ) );
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
		$user_login = sanitize_email( wp_unslash( $_POST['user_login'] ) );
	}

	?>
	<form name="lostpasswordform" id="lostpasswordform" action="<?php echo esc_url( get_permalink() ); ?>" method="post">
		<p>
			<label for="user_login" ><?php _e( 'Email Address', 'docs' ); ?><br />
			<input type="text" name="user_login" id="user_login" class="input" value="<?php echo esc_attr( $user_login ); ?>" size="20" autocapitalize="off" /></label>
		</p>
		<?php wp_nonce_field( 'docs-magic-link' ); ?>
		<p class="submit">
			<input type="submit" name="wp-submit" id="wp-submit" class="button button-primary button-large" value="<?php esc_attr_e( 'Get Link' ); ?>" />
		</p>
	</form>
	<?php
	login_footer();
	exit;
} );

add_filter( 'get_avatar_url', function( $url, $id_or_email ) {
	if ( $id_or_email instanceof WP_User ) {
		$user_id = $id_or_email->ID;
	} elseif ( is_object( $id_or_email ) && isset( $id_or_email->user_id ) ) {
		$user_id = $id_or_email->user_id;
	} elseif ( is_numeric( $id_or_email ) ) {
		$user_id = (int) $id_or_email;
	} elseif ( is_string( $id_or_email ) ) {
		$user = get_user_by( 'email', $id_or_email );
		$user_id = $user ? $user->ID : 0;
	} else {
		return $url;
	}

	if ( ! $user_id ) {
		return $url;
	}

	$animal = get_user_meta( $user_id, 'animal', true );

	if ( ! $animal ) {
		return $url;
	}

	$svg_base = apply_filters( 'emoji_svg_url', 'https://s.w.org/images/core/emoji/17.0.2/svg/' );
	return $svg_base . $animal . '.svg';
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

// Hide anonymous users from list queries (admin list, REST API search, etc).
// Allow single-user lookups by ID so getUser() works for shared docs_anon users.
add_action( 'pre_get_users', function( $query ) {
	if ( $query->get( 'include' ) ) {
		return;
	}
	$role_not_in = $query->get( 'role__not_in' );
	if ( ! is_array( $role_not_in ) ) {
		$role_not_in = array();
	}
	$role_not_in[] = 'docs_anon';
	$query->set( 'role__not_in', $role_not_in );
} );

// When a user can't be created because the email belongs to a docs_anon user,
// show a helpful error with a link to upgrade the account using the form data.
add_filter( 'user_profile_update_errors', function( $errors ) {
	if ( ! $errors->get_error_message( 'email_exists' ) ) {
		return;
	}

	$email = isset( $_POST['email'] ) ? sanitize_email( $_POST['email'] ) : '';
	if ( ! $email ) {
		return;
	}

	$existing = get_user_by( 'email', $email );
	if ( ! $existing || ! in_array( 'docs_anon', $existing->roles, true ) ) {
		return;
	}

	// Store form data in a transient so we don't put passwords in URLs.
	$token = wp_generate_password( 20, false );
	set_transient( 'docs_upgrade_' . $token, array(
		'user_id'      => $existing->ID,
		'display_name' => trim( ( $_POST['first_name'] ?? '' ) . ' ' . ( $_POST['last_name'] ?? '' ) ),
		'role'         => $_POST['role'] ?? 'subscriber',
		'user_login'   => $_POST['user_login'] ?? '',
		'user_pass'    => $_POST['pass1'] ?? '',
	), 300 ); // 5 minute expiry.

	$upgrade_url = wp_nonce_url(
		admin_url( 'admin-post.php?action=docs_upgrade_anon&token=' . $token ),
		'docs_upgrade_anon'
	);

	$errors->remove( 'email_exists' );
	$errors->add(
		'email_exists',
		sprintf(
			__( '<strong>Note:</strong> This email is used by a document collaborator account. <a href="%s">Upgrade it</a> to a full account with the details you entered.', 'docs' ),
			esc_url( $upgrade_url )
		)
	);
} );

// Handle the upgrade action.
add_action( 'admin_post_docs_upgrade_anon', function() {
	check_admin_referer( 'docs_upgrade_anon' );

	if ( ! current_user_can( 'create_users' ) ) {
		wp_die( __( 'You do not have permission to do this.', 'docs' ) );
	}

	$token = isset( $_GET['token'] ) ? sanitize_text_field( $_GET['token'] ) : '';
	$data  = get_transient( 'docs_upgrade_' . $token );

	if ( ! $data || empty( $data['user_id'] ) ) {
		wp_die( __( 'This upgrade link has expired. Please try again.', 'docs' ) );
	}

	delete_transient( 'docs_upgrade_' . $token );

	$user = get_userdata( $data['user_id'] );
	if ( ! $user || ! in_array( 'docs_anon', $user->roles, true ) ) {
		wp_die( __( 'Invalid user.', 'docs' ) );
	}

	$update_args = array( 'ID' => $data['user_id'] );

	if ( ! empty( $data['role'] ) ) {
		$update_args['role'] = sanitize_text_field( $data['role'] );
	}
	if ( ! empty( $data['display_name'] ) ) {
		$update_args['display_name'] = sanitize_text_field( $data['display_name'] );
	}
	if ( ! empty( $data['user_login'] ) ) {
		$update_args['user_login'] = sanitize_user( $data['user_login'] );
	}
	if ( ! empty( $data['user_pass'] ) ) {
		$update_args['user_pass'] = $data['user_pass'];
	}

	wp_update_user( $update_args );

	wp_safe_redirect( get_edit_user_link( $data['user_id'] ) );
	exit;
} );

// Hide the "Anonymous (Docs)" role tab from the admin users list.
add_filter( 'views_users', function( $views ) {
	unset( $views['docs_anon'] );
	return $views;
} );

// Remove the template selector from the doc editor.
add_filter( 'block_editor_settings_all', function( $settings, $context ) {
	if ( isset( $context->post ) && $context->post->post_type === 'doc' ) {
		$settings['supportsTemplateMode'] = false;
	}
	return $settings;
}, 10, 2 );

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
			'wp-editor',
			'wp-data',
			'wp-components',
			'wp-compose',
			'wp-api-fetch',
			'wp-primitives',
		),
		filemtime( dirname( __FILE__ ) . '/index.js' )
	);
} );

// Send invitation emails when users are added to sharing meta.
// The REST API diffs multi-value meta and only calls add_metadata() for
// genuinely new values, so this hook fires once per newly added user.
add_action( 'added_post_meta', function( $meta_id, $post_id, $meta_key, $meta_value ) {
	if ( $meta_key !== 'docs-share-edit' ) {
		return;
	}

	$user_id = (int) $meta_value;
	$post    = get_post( $post_id );

	if ( ! $post || $post->post_type !== 'doc' ) {
		return;
	}

	// Don't send to the doc author.
	if ( (int) $post->post_author === $user_id ) {
		return;
	}

	$user = get_userdata( $user_id );

	if ( ! $user || ! $user->user_email ) {
		return;
	}

	docs__send_email( $user->user_email, $post );
}, 10, 4 );

// REST endpoint to get or create a user by email for the share panel.
add_action( 'rest_api_init', function() {
	register_rest_route( 'docs/v1', '/get-or-create-user', array(
		'methods'             => 'POST',
		'callback'            => function( WP_REST_Request $request ) {
			$email = sanitize_email( $request->get_param( 'email' ) );

			if ( ! is_email( $email ) ) {
				return new WP_Error( 'invalid_email', __( 'Invalid email address.', 'docs' ), array( 'status' => 400 ) );
			}

			$user = docs__get_or_create_user_by_email( $email );

			return array(
				'id'          => $user->ID,
				'name'        => $user->display_name,
				'email'       => $user->user_email,
				'avatar_urls' => rest_get_avatar_urls( $user ),
			);
		},
		'permission_callback' => function() {
			return current_user_can( 'edit_docs' );
		},
		'args'                => array(
			'email' => array(
				'required' => true,
				'type'     => 'string',
			),
		),
	) );
} );

// Replace the sync server with our subclass that supports doc capabilities.
// Register before Gutenberg/core (priority 9) so our handler is tried first
// by the REST server. Their handler remains as a fallback but is never reached.
add_action( 'rest_api_init', function() {
	if ( ! class_exists( 'WP_HTTP_Polling_Sync_Server' ) ) {
		return;
	}

	require_once __DIR__ . '/class-docs-http-polling-sync-server-custom-caps.php';

	$sync_server = new Docs_HTTP_Polling_Sync_Server_Custom_Caps( new WP_Sync_Post_Meta_Storage() );
	$sync_server->register_routes();
}, 9 );

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
	if ( in_array( $anyone, array( 'anyone', 'anyone-view', 'anyone-comment' ), true ) ) {
		$user_caps['edit_docs']           = true;
		$user_caps['edit_others_docs']    = true;
		$user_caps['edit_published_docs'] = true;
		return $user_caps;
	}

	// Check if user ID is in the sharing list.
	$all_shared_ids = array_map( 'intval', get_post_meta( $post->ID, 'docs-share-edit', false ) );

	if ( in_array( $user_id, $all_shared_ids, true ) ) {
		$user_caps['edit_docs']           = true;
		$user_caps['edit_others_docs']    = true;
		$user_caps['edit_published_docs'] = true;
		return $user_caps;
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
