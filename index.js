( function () {
	var el = wp.element.createElement;
	var useState = wp.element.useState;
	var __ = wp.i18n.__;
	var registerPlugin = wp.plugins.registerPlugin;
	var PluginDocumentSettingPanel = wp.editor.PluginDocumentSettingPanel;
	var useSelect = wp.data.useSelect;
	var useDispatch = wp.data.useDispatch;
	var RadioControl = wp.components.RadioControl;
	var TextareaControl = wp.components.TextareaControl;
	var TextControl = wp.components.TextControl;
	var Button = wp.components.Button;
	var useCopyToClipboard = wp.compose.useCopyToClipboard;

	var ANYONE_KEY = 'docs-share-anyone';
	var ADDRESSES_KEY = 'docs-share-email-addresses';

	registerPlugin( 'docs-share-settings', {
		render: function () {
			var copied = useState( false );
			var isCopied = copied[ 0 ];
			var setCopied = copied[ 1 ];

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

			var copyRef = useCopyToClipboard( function () {
				return link;
			}, function () {
				setCopied( true );
				setTimeout( function () {
					setCopied( false );
				}, 2000 );
			} );

			return el(
				PluginDocumentSettingPanel,
				{ name: 'docs-share', title: __( 'Share', 'docs' ), icon: 'admin-links' },
				el( RadioControl, {
					selected: anyone,
					options: [
						{ label: __( 'Only the author can edit.', 'docs' ), value: '' },
						{ label: __( 'Anyone with the link can edit.', 'docs' ), value: 'anyone' },
						{ label: __( 'Anyone with access to the following email addresses can edit.', 'docs' ), value: 'email' },
					],
					onChange: function ( value ) {
						var update = {};
						update[ ANYONE_KEY ] = value;
						editPost( { meta: Object.assign( {}, meta, update ) } );
					},
				} ),
				anyone === 'email' && el( TextareaControl, {
					label: __( 'Comma separated list of email addresses. An email will be sent once the document is saved.', 'docs' ),
					value: meta[ ADDRESSES_KEY ],
					onChange: function ( value ) {
						var update = {};
						update[ ADDRESSES_KEY ] = value;
						editPost( { meta: Object.assign( {}, meta, update ) } );
					},
				} ),
				anyone && el( TextControl, {
					readOnly: true,
					value: link,
					__next40pxDefaultSize: true,
				} ),
				anyone && el(
					Button,
					{
						variant: 'secondary',
						ref: copyRef,
					},
					isCopied ? __( 'Copied!', 'docs' ) : __( 'Copy Link', 'docs' )
				)
			);
		},
	} );
} )();
