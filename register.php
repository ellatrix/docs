<?php

register_post_type( 'doc', array(
	'labels' => array(
		'name' => _x( 'Docs', 'Post type general name', 'docs' ),
		'singular_name' => _x( 'Doc', 'Post type singular name', 'docs' ),
		'menu_name' => _x( 'Docs', 'Admin Menu text', 'docs' ),
		'name_admin_bar' => _x( 'Docs', 'Add New on Toolbar', 'docs' ),
		'add_new' => __( 'Add New', 'docs' ),
		'add_new_item' => __( 'Add New Doc', 'docs' ),
		'new_item' => __( 'New Doc', 'docs' ),
		'edit_item' => __( 'Edit Doc', 'docs' ),
		'view_item' => __( 'View Doc', 'docs' ),
		'all_items' => __( 'All Docs', 'docs' ),
		'search_items' => __( 'Search Docs', 'docs' ),
		'parent_item_colon' => __( 'Parent Docs:', 'docs' ),
		'not_found' => __( 'No docs found.', 'docs' ),
		'not_found_in_trash' => __( 'No docs found in Trash.', 'docs' ),
		'featured_image' => _x( 'Doc Cover Image', 'Overrides the “Featured Image” phrase for this post type. Added in 4.3', 'docs' ),
		'set_featured_image' => _x( 'Set cover image', 'Overrides the “Set featured image” phrase for this post type. Added in 4.3', 'docs' ),
		'remove_featured_image' => _x( 'Remove cover image', 'Overrides the “Remove featured image” phrase for this post type. Added in 4.3', 'docs' ),
		'use_featured_image' => _x( 'Use as cover image', 'Overrides the “Use as featured image” phrase for this post type. Added in 4.3', 'docs' ),
		'archives' => _x( 'Doc archives', 'The post type archive label used in nav menus. Default “Post Archives”. Added in 4.4', 'docs' ),
		'insert_into_item' => _x( 'Insert into doc', 'Overrides the “Insert into post”/”Insert into page” phrase (used when inserting media into a post). Added in 4.4', 'docs' ),
		'uploaded_to_this_item' => _x( 'Uploaded to this doc', 'Overrides the “Uploaded to this post”/”Uploaded to this page” phrase (used when viewing media attached to a post). Added in 4.4', 'docs' ),
		'filter_items_list' => _x( 'Filter docs list', 'Screen reader text for the filter links heading on the post type listing screen. Default “Filter posts list”/”Filter pages list”. Added in 4.4', 'docs' ),
		'items_list_navigation' => _x( 'Docs list navigation', 'Screen reader text for the pagination heading on the post type listing screen. Default “Posts list navigation”/”Pages list navigation”. Added in 4.4', 'docs' ),
		'items_list' => _x( 'Docs list', 'Screen reader text for the items list heading on the post type listing screen. Default “Posts list”/”Pages list”. Added in 4.4', 'docs' )
	),
	'public' => true,
	'show_ui' => true,
	'supports' => array( 'title', 'editor', 'author', 'custom-fields' ),
	'show_in_rest' => true,
	'rest_base' => 'docs',
	'rewrite' => array( 'slug' => 'docs' ),
	'has_archive' => true,
	'capability_type' => 'doc',
	'capabilities' => array(
		'create_posts' => 'create_docs',
	),
	'map_meta_cap' => true,
	'menu_icon' => 'dashicons-media-document',
) );

$share_meta_args = array(
	'type'         => 'integer',
	'single'       => false,
	'show_in_rest' => true,
);

register_post_meta( 'doc', 'docs-share-edit', $share_meta_args );
register_post_meta( 'doc', 'docs-share-view', $share_meta_args );
register_post_meta( 'doc', 'docs-share-comment', $share_meta_args );

register_post_meta( 'doc', 'docs-share-anyone', array(
	'show_in_rest' => true,
	'single' => true,
	'type' => 'string',
) );
