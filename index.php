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

	require 'register.php';
	flush_rewrite_rules();

} );

// Fake user system for anonymous "anyone with the link" visitors.
// Instead of creating real WP users, we store identity in a cookie and
// intercept WordPress user lookups to return a synthetic WP_User object.

$GLOBALS['docs_anon_animals'] = array(
	'1f436' => 'Dog',    '1f431' => 'Cat',     '1f42d' => 'Mouse',
	'1f439' => 'Hamster', '1f430' => 'Rabbit',  '1f98a' => 'Fox',
	'1f43b' => 'Bear',   '1f43c' => 'Panda',   '1f428' => 'Koala',
	'1f42f' => 'Tiger',  '1f981' => 'Lion',     '1f435' => 'Monkey',
);

// Derive animal identity from the session token.
function docs__animal_from_token( $token ) {
	$animals = $GLOBALS['docs_anon_animals'];
	$codes = array_keys( $animals );
	$index = abs( crc32( $token ) ) % count( $codes );
	$code = $codes[ $index ];
	return array(
		'code' => $code,
		'name' => sprintf( __( 'Anonymous %s', 'docs' ), $animals[ $code ] ),
	);
}

// Detect a fake anon user from the WP logged-in cookie.
// Returns the parsed token or null if not a fake user.
function docs__is_anon_cookie() {
	$cookie = $_COOKIE[ LOGGED_IN_COOKIE ] ?? '';
	if ( ! $cookie ) {
		return null;
	}
	$parts = explode( '|', $cookie );
	if ( ! isset( $parts[0], $parts[2] ) ) {
		return null;
	}
	if ( $parts[0] !== 'docs_anon_' . PHP_INT_MAX ) {
		return null;
	}
	return $parts[2]; // the session token
}

// Prime the user cache with our fake user so WP_User never hits the DB.
// Accepts an optional token for the first request before the cookie exists.
function docs__prime_anon_cache( $token = null ) {
	if ( ! $token ) {
		$token = docs__is_anon_cookie();
	}
	if ( ! $token ) {
		return;
	}
	$animal = docs__animal_from_token( $token );
	$id = PHP_INT_MAX;
	$obj = new stdClass();
	$obj->ID = $id;
	$obj->user_login = 'docs_anon_' . $id;
	$obj->user_nicename = 'docs_anon_' . $id;
	$obj->user_email = '';
	$obj->user_url = '';
	$obj->user_pass = 'fake';
	$obj->user_registered = '2020-01-01 00:00:00';
	$obj->user_activation_key = '';
	$obj->user_status = 0;
	$obj->display_name = $animal['name'];
	wp_cache_set( $obj->ID, $obj, 'users' );
	wp_cache_set( $obj->user_login, $obj->ID, 'userlogins' );
}

// Prime the user cache as early as possible so wp_validate_auth_cookie()
// (called by auth_redirect in wp-admin) can find our fake user.
// If the WP auth cookie is missing or invalid, clear the docs_anon cookie
// so the user gets a fresh identity on the next visit.
add_action( 'plugins_loaded', function() {
	docs__prime_anon_cache();
}, 0 );


// Also prime on determine_current_user in case plugins_loaded was too late.
add_filter( 'determine_current_user', function( $user_id ) {
	static $resolving = false;
	if ( $user_id || $resolving ) {
		return $user_id;
	}
	if ( ! docs__is_anon_cookie() ) {
		return $user_id;
	}
	$resolving = true;
	docs__prime_anon_cache();
	$resolving = false;
	return PHP_INT_MAX;
}, 30 );

// Grant capabilities for the fake user.
add_filter( 'user_has_cap', function( $allcaps, $caps, $args ) {
	if ( $args[1] !== PHP_INT_MAX || ! docs__is_anon_cookie() ) {
		return $allcaps;
	}
	$allcaps['edit_docs'] = true;
	return $allcaps;
}, 5, 3 );

// Return metadata for the fake user.
add_filter( 'get_user_metadata', function( $value, $object_id, $meta_key ) {
	$token = docs__is_anon_cookie();
	if ( ! $token || $object_id !== PHP_INT_MAX ) {
		return $value;
	}
	// The get_user_metadata filter must return array( $value ) for handled keys.
	// WordPress does $check[0] when $single is true.
	if ( $meta_key === 'animal' ) {
		$animal = docs__animal_from_token( $token );
		return array( $animal['code'] );
	}
	if ( $meta_key === 'admin_color' ) {
		return array( 'coffee' );
	}
	// Enable the visual/rich editor (without this, user_can_richedit() returns
	// false and the block editor falls back to the code editor).
	if ( $meta_key === 'rich_editing' ) {
		return array( 'true' );
	}
	return $value;
}, 10, 3 );

// Return the current blog for fake users so the admin bar works.
add_filter( 'pre_get_blogs_of_user', function( $sites, $user_id ) {
	if ( $user_id !== PHP_INT_MAX || ! docs__is_anon_cookie() ) {
		return $sites;
	}
	$site_id = get_current_blog_id();
	$site = new stdClass();
	$site->userblog_id = $site_id;
	$site->blogname    = get_option( 'blogname' );
	$site->domain      = '';
	$site->path        = '';
	$site->site_id     = 1;
	$site->siteurl     = get_option( 'siteurl' );
	$site->archived    = 0;
	$site->spam        = 0;
	$site->deleted     = 0;
	return array( $site_id => $site );
}, 10, 2 );

// Fake session token manager for anonymous users. wp_validate_auth_cookie()
// verifies the session token from the auth cookie. Our fake users use a fixed
// token stored in the docs_anon cookie. This manager accepts that token.
class Docs_Anon_Session_Tokens extends WP_Session_Tokens {
	protected function get_sessions() { return array(); }
	protected function get_session( $verifier ) {
		// Return a session that never expires so verify() accepts the token.
		return array( 'expiration' => time() + DAY_IN_SECONDS );
	}
	protected function update_session( $verifier, $session = null ) {}
	protected function destroy_other_sessions( $verifier ) {}
	protected function destroy_all_sessions() {}
}

// Use the fake session token manager for anon users.
// Only apply when validating the fake user's session — not for real users.
// The global flag is set during the first request when the cookie doesn't
// exist in $_COOKIE yet (it's being sent in the response).
$GLOBALS['docs_use_anon_session'] = false;

add_filter( 'session_token_manager', function( $manager ) {
	if ( $GLOBALS['docs_use_anon_session'] || docs__is_anon_cookie() ) {
		return 'Docs_Anon_Session_Tokens';
	}
	return $manager;
} );

// The REST API checks cookie nonces. For fake users, the nonce is generated
// using the session token from the auth cookie — which is our fixed token.
// This works automatically since wp_get_session_token() reads the auth cookie
// and our session manager accepts it.

function docs__get_or_create_user_by_email( $email_address ) {
	$user = get_user_by( 'email', $email_address );

	if ( ! empty( $user ) ) {
		return $user;
	}

	return get_user_by( 'id', wp_insert_user( array(
		'user_pass' => wp_generate_password(),
		'user_login' => $email_address,
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
				$fake_id = PHP_INT_MAX;
				$token = wp_generate_password( 43, false, false );

				// Prime the cache so wp_set_auth_cookie generates the right HMAC.
				docs__prime_anon_cache( $token );

				// Flag for the session token manager — the cookie doesn't exist
				// in $_COOKIE yet since it's being set in this response.
				$GLOBALS['docs_use_anon_session'] = true;

				wp_set_current_user( $fake_id );
				wp_set_auth_cookie( $fake_id, false, '', $token );

				$GLOBALS['docs_use_anon_session'] = false;

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

// Grant or deny doc editing capabilities based on sharing settings.
// Users who don't already have edit_others_docs (subscribers, anon) get it
// dynamically when the doc is shared with them. Users who do have it get it
// revoked when the doc is not shared with them (unless they're the author).
add_filter( 'user_has_cap', function( $user_caps, $required_primitive_caps, $args ) {
	if ( ! in_array( $args[0], array( 'edit_post', 'read_post', 'edit_post_meta', 'delete_post_meta' ), true ) || ! isset( $args[2] ) ) {
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
