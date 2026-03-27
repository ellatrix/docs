( function () {
	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var __ = wp.i18n.__;
	var registerPlugin = wp.plugins.registerPlugin;
	var PluginDocumentSettingPanel = wp.editor.PluginDocumentSettingPanel;
	var useSelect = wp.data.useSelect;
	var useDispatch = wp.data.useDispatch;
	var SelectControl = wp.components.SelectControl;
	var Button = wp.components.Button;
	var Icon = wp.components.Icon;
	var ComboboxControl = wp.components.ComboboxControl;
	var SVG = wp.primitives.SVG;
	var Path = wp.primitives.Path;
	var useEffect = wp.element.useEffect;
	var useRef = wp.element.useRef;
	var useCopyToClipboard = wp.compose.useCopyToClipboard;
	var apiFetch = wp.apiFetch;

	var linkIcon = el( SVG, { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24' },
		el( Path, { d: 'M10 17.389H8.444A5.194 5.194 0 1 1 8.444 7H10v1.5H8.444a3.694 3.694 0 0 0 0 7.389H10v1.5ZM14 7h1.556a5.194 5.194 0 0 1 0 10.39H14v-1.5h1.556a3.694 3.694 0 0 0 0-7.39H14V7Zm-4.5 6h5v-1.5h-5V13Z' } )
	);

	var lockIcon = el( SVG, { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24' },
		el( Path, { d: 'M17 10h-1.2V7c0-2.1-1.7-3.8-3.8-3.8-2.1 0-3.8 1.7-3.8 3.8v3H7c-.6 0-1 .4-1 1v8c0 .6.4 1 1 1h10c.6 0 1-.4 1-1v-8c0-.6-.4-1-1-1zm-2.8 0H9.8V7c0-1.2 1-2.2 2.2-2.2s2.2 1 2.2 2.2v3z' } )
	);

	var ANYONE_KEY = 'docs-share-anyone';
	var META_KEYS = {
		editor: 'docs-share-edit',
		viewer: 'docs-share-view',
		commenter: 'docs-share-comment',
	};

	// General access options.
	var ACCESS_OPTIONS = [
		{ label: __( 'View', 'docs' ), value: 'anyone-view', disabled: true },
		{ label: __( 'Comment', 'docs' ), value: 'anyone-comment', disabled: true },
		{ label: __( 'Edit', 'docs' ), value: 'anyone' },
		{ label: __( 'Restricted', 'docs' ), value: '' },
	];

	// Per-person role options.
	var PERSON_ROLE_OPTIONS = [
		{ label: __( 'View', 'docs' ), value: 'viewer', disabled: true },
		{ label: __( 'Comment', 'docs' ), value: 'commenter', disabled: true },
		{ label: __( 'Edit', 'docs' ), value: 'editor' },
		{ label: __( 'Remove', 'docs' ), value: 'remove' },
	];

	// Build a unified list of { id, role } from meta.
	function getPeople( meta ) {
		var people = [];
		Object.keys( META_KEYS ).forEach( function ( role ) {
			( meta[ META_KEYS[ role ] ] || [] ).forEach( function ( userId ) {
				people.push( { id: userId, role: role } );
			} );
		} );
		return people;
	}

	registerPlugin( 'docs-share-settings', {
		render: function () {
			var copied = useState( false );
			var isCopied = copied[ 0 ];
			var setCopied = copied[ 1 ];

			var filterState = useState( '' );
			var filterValue = filterState[ 0 ];
			var setFilterValue = filterState[ 1 ];

			var optionsState = useState( [] );
			var userOptions = optionsState[ 0 ];
			var setUserOptions = optionsState[ 1 ];

			var searchTimer = useRef( null );

			var editPost = useDispatch( 'core/editor' ).editPost;

			var selected = useSelect( function ( select ) {
				var editor = select( 'core/editor' );
				var post = editor.getCurrentPost();
				return {
					meta: editor.getEditedPostAttribute( 'meta' ),
					link: post.link,
					authorId: post.author,
				};
			} );

			var meta = selected.meta;
			var link = selected.link;
			var authorId = selected.authorId;
			var anyone = meta[ ANYONE_KEY ] || '';
			var people = getPeople( meta );

			// Resolve user objects for the people list.
			var users = useSelect( function ( select ) {
				var result = {};
				people.forEach( function ( p ) {
					result[ p.id ] = select( 'core' ).getUser( p.id );
				} );
				return result;
			}, [ people.map( function ( p ) { return p.id; } ).join() ] );

			function fetchUsers( search ) {
				var path = '/wp/v2/users?per_page=5&context=edit';
				if ( authorId ) {
					path += '&exclude=' + authorId;
				}
				if ( search ) {
					path += '&search=' + encodeURIComponent( search );
				}
				apiFetch( { path: path } ).then( function ( results ) {
					setUserOptions( results.map( function ( u ) {
						return { label: u.name + ' (' + u.email + ')', value: u.id };
					} ) );
				} ).catch( function () { setUserOptions( [] ); } );
			}

			useEffect( function () { fetchUsers(); }, [ authorId ] );

			useEffect( function () {
				clearTimeout( searchTimer.current );
				if ( ! filterValue.trim() ) {
					fetchUsers();
					return;
				}
				searchTimer.current = setTimeout( function () {
					fetchUsers( filterValue.trim() );
				}, 300 );
				return function () { clearTimeout( searchTimer.current ); };
			}, [ filterValue, authorId ] );

			var copyRef = useCopyToClipboard( function () {
				return link;
			}, function () {
				setCopied( true );
				setTimeout( function () {
					setCopied( false );
				}, 2000 );
			} );

			function addUserIdToMeta( userId, role ) {
				var key = META_KEYS[ role ];
				var current = meta[ key ] || [];
				if ( current.indexOf( userId ) !== -1 ) return;
				var updated = {};
				updated[ key ] = current.concat( userId );
				editPost( { meta: Object.assign( {}, meta, updated ) } );
				setFilterValue( '' );
				setUserOptions( [] );
			}

		function addPerson( emailOrUserId ) {
				if ( typeof emailOrUserId === 'number' ) {
					addUserIdToMeta( emailOrUserId, 'editor' );
				} else if ( typeof emailOrUserId === 'string' && emailOrUserId.includes( '@' ) ) {
					var postId = wp.data.select( 'core/editor' ).getCurrentPostId();
					apiFetch( {
						path: '/docs/v1/get-or-create-user',
						method: 'POST',
						data: { email: emailOrUserId, doc_id: postId },
					} ).then( function ( user ) {
						addUserIdToMeta( user.id, 'editor' );
					} );
				}
			}

			function removePerson( userId ) {
				var updated = {};
				Object.keys( META_KEYS ).forEach( function ( role ) {
					var current = meta[ META_KEYS[ role ] ] || [];
					updated[ META_KEYS[ role ] ] = current.filter( function ( id ) {
						return id !== userId;
					} );
				} );
				editPost( { meta: Object.assign( {}, meta, updated ) } );
			}

			function updatePersonRole( userId, oldRole, newRole ) {
				var updated = {};
				var oldList = ( meta[ META_KEYS[ oldRole ] ] || [] ).filter( function ( id ) {
					return id !== userId;
				} );
				updated[ META_KEYS[ oldRole ] ] = oldList;
				var newList = ( meta[ META_KEYS[ newRole ] ] || [] ).concat( userId );
				updated[ META_KEYS[ newRole ] ] = newList;
				editPost( { meta: Object.assign( {}, meta, updated ) } );
			}

			// Build combobox options: user search results + raw email option.
			var comboOptions = userOptions.slice();
			if ( filterValue.includes( '@' ) && filterValue.trim().length > 3 ) {
				comboOptions.push( {
					label: __( 'Invite ', 'docs' ) + filterValue.trim(),
					value: 'email:' + filterValue.trim(),
				} );
			}

			return el(
				PluginDocumentSettingPanel,
				{ name: 'docs-share', title: __( 'Share', 'docs' ), icon: linkIcon },

				// General access row.
				el( 'div', { className: 'docs-share-access-row' },
					el( 'div', { className: 'docs-share-access-icon' },
						el( Icon, { icon: anyone ? linkIcon : lockIcon, size: 20 } )
					),
					el( 'div', { className: 'docs-share-access-label' },
						__( 'Anyone with the link', 'docs' )
					),
					el( 'div', { className: 'docs-share-access-select' },
						el( SelectControl, {
							value: anyone,
							options: ACCESS_OPTIONS,
							onChange: function ( value ) {
								editPost( { meta: Object.assign( {}, meta, {
									'docs-share-anyone': value,
								} ) } );
							},
							hideLabelFromVision: true,
							label: __( 'General access', 'docs' ),
							__next40pxDefaultSize: true,
							__nextHasNoMarginBottom: true,
						} )
					)
				),

				// People with access.
				people.length > 0 && el( 'div', { className: 'docs-share-people' },
					people.map( function ( person ) {
						var user = users[ person.id ];
						var displayName = user ? user.name : ( '#' + person.id );
						var avatarUrl = user && user.avatar_urls ? user.avatar_urls[ '48' ] : null;

						return el( 'div', { className: 'docs-share-person-row', key: person.id },
							el( 'div', { className: 'docs-share-person-avatar' },
								avatarUrl
									? el( 'img', {
										src: avatarUrl,
										alt: '',
										className: 'docs-share-person-avatar-img',
									} )
									: displayName.charAt( 0 ).toUpperCase()
							),
							el( 'div', { className: 'docs-share-person-name' }, displayName ),
							el( SelectControl, {
								value: person.role,
								options: PERSON_ROLE_OPTIONS,
								onChange: function ( value ) {
									if ( value === 'remove' ) {
										removePerson( person.id );
									} else {
										updatePersonRole( person.id, person.role, value );
									}
								},
								hideLabelFromVision: true,
								label: __( 'Role', 'docs' ),
								__next40pxDefaultSize: true,
								__nextHasNoMarginBottom: true,
								className: 'docs-share-person-role',
							} )
						);
					} )
				),

				// Add people input with user autocomplete.
				el( 'div', { className: 'docs-share-add-person' },
					el( ComboboxControl, {
						label: __( 'Add people', 'docs' ),
						hideLabelFromVision: true,
						placeholder: __( 'Add people by email or name', 'docs' ),
						value: null,
						options: comboOptions,
						onChange: function ( value ) {
							if ( ! value ) return;
							if ( typeof value === 'string' && value.indexOf( 'email:' ) === 0 ) {
								addPerson( value.slice( 6 ) );
							} else {
								addPerson( value );
							}
						},
						onFilterValueChange: setFilterValue,
						__next40pxDefaultSize: true,
						__nextHasNoMarginBottom: true,
					} )
				),

				// Copy link button.
				( anyone || people.length > 0 ) && el(
					Button,
					{
						variant: 'secondary',
						ref: copyRef,
						className: 'docs-share-copy-link',
						icon: linkIcon,
					},
					isCopied ? __( 'Copied!', 'docs' ) : __( 'Copy link', 'docs' )
				)
			);
		},
	} );
} )();
