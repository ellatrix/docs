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
	var TextControl = wp.components.TextControl;
	var Popover = wp.components.Popover;
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

			var inputState = useState( '' );
			var inputValue = inputState[ 0 ];
			var setInputValue = inputState[ 1 ];

			var suggestionsState = useState( [] );
			var suggestions = suggestionsState[ 0 ];
			var setSuggestions = suggestionsState[ 1 ];

			var selectedIndexState = useState( -1 );
			var selectedIndex = selectedIndexState[ 0 ];
			var setSelectedIndex = selectedIndexState[ 1 ];

			var searchTimer = useRef( null );
			var inputRef = useRef( null );

			useEffect( function () {
				clearTimeout( searchTimer.current );
				if ( inputValue.trim().length < 2 ) {
					setSuggestions( [] );
					return;
				}
				searchTimer.current = setTimeout( function () {
					apiFetch( {
						path: '/wp/v2/users?search=' + encodeURIComponent( inputValue.trim() ) + '&per_page=5&context=edit',
					} ).then( function ( users ) {
						setSuggestions( users );
						setSelectedIndex( -1 );
					} ).catch( function () { setSuggestions( [] ); } );
				}, 300 );
				return function () { clearTimeout( searchTimer.current ); };
			}, [ inputValue ] );

			var editPost = useDispatch( 'core/editor' ).editPost;

			var selected = useSelect( function ( select ) {
				var editor = select( 'core/editor' );
				return {
					meta: editor.getEditedPostAttribute( 'meta' ),
					link: editor.getCurrentPost().link,
				};
			} );
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
				setInputValue( '' );
				setSuggestions( [] );
				setSelectedIndex( -1 );
			}

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

				// Add people input with user autocomplete.
				el( 'form', {
					className: 'docs-share-add-person',
					ref: inputRef,
					onSubmit: function ( e ) {
						e.preventDefault();
						if ( selectedIndex >= 0 && suggestions[ selectedIndex ] ) {
							addPerson( suggestions[ selectedIndex ].email );
						} else {
							addPerson( inputValue.trim() );
						}
					},
				},
					el( TextControl, {
						placeholder: __( 'Add people by email or name', 'docs' ),
						value: inputValue,
						onChange: setInputValue,
						onKeyDown: function ( e ) {
							if ( ! suggestions.length ) return;
							if ( e.key === 'ArrowDown' ) {
								e.preventDefault();
								setSelectedIndex( Math.min( selectedIndex + 1, suggestions.length - 1 ) );
							} else if ( e.key === 'ArrowUp' ) {
								e.preventDefault();
								setSelectedIndex( Math.max( selectedIndex - 1, -1 ) );
							} else if ( e.key === 'Escape' ) {
								setSuggestions( [] );
							}
						},
						hideLabelFromVision: true,
						label: __( 'Add people', 'docs' ),
						autoComplete: 'off',
						__next40pxDefaultSize: true,
						__nextHasNoMarginBottom: true,
					} ),
					suggestions.length > 0 && el( Popover, {
						placement: 'bottom-start',
						focusOnMount: false,
						anchor: inputRef.current,
						onClose: function () { setSuggestions( [] ); },
						className: 'docs-share-suggestions-popover',
					},
						el( 'ul', { className: 'docs-share-suggestions', role: 'listbox' },
							suggestions.map( function ( user, i ) {
								return el( 'li', {
									key: user.email,
									role: 'option',
									'aria-selected': i === selectedIndex,
									className: 'docs-share-suggestion' + ( i === selectedIndex ? ' is-selected' : '' ),
									onMouseDown: function ( e ) {
										e.preventDefault();
										addPerson( user.email );
									},
								},
									el( 'div', { className: 'docs-share-suggestion-name' }, user.name ),
									el( 'div', { className: 'docs-share-suggestion-email' }, user.email )
								);
							} )
						)
					)
				),

				// People with access.
				people.length > 0 && el( 'div', { className: 'docs-share-people' },
					people.map( function ( person ) {
						return el( 'div', { className: 'docs-share-person-row', key: person.email },
							el( 'div', { className: 'docs-share-person-avatar' },
								person.email.charAt( 0 ).toUpperCase()
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
