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

	// Meta keys.
	var ANYONE_KEY = 'docs-share-anyone';
	var EMAIL_KEYS = {
		editor: 'docs-share-email-addresses',
		viewer: 'docs-share-email-addresses-view',
		commenter: 'docs-share-email-addresses-comment',
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

	function parseEmails( str ) {
		if ( ! str ) return [];
		return str.split( /[\s,]+/ ).filter( function ( e ) {
			return e.length > 0;
		} );
	}

	// Build a unified list of {email, role} from the three email meta fields.
	function getPeople( meta ) {
		var people = [];
		Object.keys( EMAIL_KEYS ).forEach( function ( role ) {
			parseEmails( meta[ EMAIL_KEYS[ role ] ] ).forEach( function ( email ) {
				people.push( { email: email, role: role } );
			} );
		} );
		return people;
	}

	// Write people back to the three email meta fields.
	function peopleToMeta( people ) {
		var lists = { editor: [], viewer: [], commenter: [] };
		people.forEach( function ( p ) {
			if ( lists[ p.role ] ) {
				lists[ p.role ].push( p.email );
			}
		} );
		var update = {};
		Object.keys( EMAIL_KEYS ).forEach( function ( role ) {
			update[ EMAIL_KEYS[ role ] ] = lists[ role ].join( ', ' );
		} );
		return update;
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

			// Map of email -> avatar URL, built from search results.
			var avatarsState = useState( {} );
			var avatars = avatarsState[ 0 ];
			var setAvatars = avatarsState[ 1 ];

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

			var authorId = selected.authorId;

			function fetchUsers( search ) {
				var path = '/wp/v2/users?per_page=5&context=edit';
				if ( authorId ) {
					path += '&exclude=' + authorId;
				}
				if ( search ) {
					path += '&search=' + encodeURIComponent( search );
				}
				apiFetch( { path: path } ).then( function ( users ) {
					var newAvatars = {};
					users.forEach( function ( u ) {
						if ( u.avatar_urls && u.avatar_urls[ '48' ] ) {
							newAvatars[ u.email ] = u.avatar_urls[ '48' ];
						}
					} );
					setAvatars( function ( prev ) {
						return Object.assign( {}, prev, newAvatars );
					} );
					setUserOptions( users.map( function ( u ) {
						return { label: u.name + ' (' + u.email + ')', value: u.email };
					} ) );
				} ).catch( function () { setUserOptions( [] ); } );
			}

			// Fetch users on mount and when author changes.
			useEffect( function () { fetchUsers(); }, [ authorId ] );

			// Debounced search when typing.
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
			var meta = selected.meta;
			var link = selected.link;

			var anyone = meta[ ANYONE_KEY ] || '';
			var people = getPeople( meta );

			var copyRef = useCopyToClipboard( function () {
				return link;
			}, function () {
				setCopied( true );
				setTimeout( function () {
					setCopied( false );
				}, 2000 );
			} );

			function addPerson( email ) {
				if ( ! email ) return;
				if ( people.some( function ( p ) { return p.email === email; } ) ) return;
				var updated = people.concat( { email: email, role: 'editor' } );
				editPost( { meta: Object.assign( {}, meta, peopleToMeta( updated ) ) } );
				setFilterValue( '' );
				setUserOptions( [] );
			}

			// Fetch avatars for people we don't have yet.
			useEffect( function () {
				people.forEach( function ( p ) {
					if ( avatars[ p.email ] ) return;
					apiFetch( {
						path: '/wp/v2/users?search=' + encodeURIComponent( p.email ) + '&per_page=1&context=edit',
					} ).then( function ( users ) {
						if ( users.length && users[ 0 ].avatar_urls ) {
							setAvatars( function ( prev ) {
								var next = Object.assign( {}, prev );
								next[ p.email ] = users[ 0 ].avatar_urls[ '48' ];
								return next;
							} );
						}
					} ).catch( function () {} );
				} );
			}, [ people.length ] );

			function removeEmail( email ) {
				var updated = people.filter( function ( p ) { return p.email !== email; } );
				editPost( { meta: Object.assign( {}, meta, peopleToMeta( updated ) ) } );
			}

			function updatePersonRole( email, newRole ) {
				var updated = people.map( function ( p ) {
					if ( p.email === email ) {
						return { email: email, role: newRole };
					}
					return p;
				} );
				editPost( { meta: Object.assign( {}, meta, peopleToMeta( updated ) ) } );
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
						return el( 'div', { className: 'docs-share-person-row', key: person.email },
							el( 'div', { className: 'docs-share-person-avatar' },
								avatars[ person.email ]
									? el( 'img', {
										src: avatars[ person.email ],
										alt: '',
										className: 'docs-share-person-avatar-img',
									} )
									: person.email.charAt( 0 ).toUpperCase()
							),
							el( 'div', { className: 'docs-share-person-email' }, person.email ),
							el( SelectControl, {
								value: person.role,
								options: PERSON_ROLE_OPTIONS,
								onChange: function ( value ) {
									if ( value === 'remove' ) {
										removeEmail( person.email );
									} else {
										updatePersonRole( person.email, value );
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
				el( 'div', {
					className: 'docs-share-add-person',
					onKeyDown: function ( e ) {
						if ( e.key === 'Enter' && filterValue.trim() && filterValue.includes( '@' ) ) {
							e.preventDefault();
							addPerson( filterValue.trim() );
						}
					},
				},
					el( ComboboxControl, {
						label: __( 'Add people', 'docs' ),
						hideLabelFromVision: true,
						placeholder: __( 'Add people by email or name', 'docs' ),
						value: null,
						options: userOptions,
						onChange: function ( email ) {
							if ( email ) {
								addPerson( email );
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
