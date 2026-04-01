const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const BASE_URL = process.env.WP_BASE_URL || 'http://localhost:2026';

// Only run when generating screenshots.
test.skip( ! process.env.SCREENSHOTS, 'Set SCREENSHOTS=1 to run' );

async function dismissWelcomeModal( page ) {
	await page.getByRole( 'dialog', { name: 'Welcome to the editor' } )
		.getByRole( 'button', { name: 'Close' } ).click().catch( () => {} );
}

test( 'generate plugin banner', async ( {
	admin,
	editor,
	page,
	requestUtils,
} ) => {
	const doc = await requestUtils.rest( {
		path: '/wp/v2/docs',
		method: 'POST',
		data: {
			title: 'Philosophy',
			status: 'draft',
			content: [
				'<!-- wp:heading -->',
				'<h2 class="wp-block-heading">Out of the Box</h2>',
				'<!-- /wp:heading -->',
				'',
				'<!-- wp:paragraph -->',
				'<p>Great software should work with little configuration and setup. WordPress is designed to get you up and running and fully functional in no longer than five minutes.</p>',
				'<!-- /wp:paragraph -->',
				'',
				'<!-- wp:heading -->',
				'<h2 class="wp-block-heading">Design for the Majority</h2>',
				'<!-- /wp:heading -->',
				'',
				'<!-- wp:paragraph -->',
				'<p>Many end users of WordPress are non-technically minded. They don\'t know what AJAX is, nor do they care about which version of PHP they are using. The average WordPress user simply wants to be able to write without problems or interruption.</p>',
				'<!-- /wp:paragraph -->',
				'',
				'<!-- wp:heading -->',
				'<h2 class="wp-block-heading">Decisions, Not Options</h2>',
				'<!-- /wp:heading -->',
				'',
				'<!-- wp:paragraph -->',
				'<p>When making decisions these are the users we consider first. Every time you give a user an option, you are asking them to make a decision. It\'s our duty as developers to make smart design decisions and avoid putting the weight of technical choices on our end users.</p>',
				'<!-- /wp:paragraph -->',
				'',
				'<!-- wp:heading -->',
				'<h2 class="wp-block-heading">Striving for Simplicity</h2>',
				'<!-- /wp:heading -->',
				'',
				'<!-- wp:paragraph -->',
				'<p>We\'re never done with simplicity. We want to make WordPress easier to use with every single release. Every version of WordPress should be easier and more enjoyable to use than the last.</p>',
				'<!-- /wp:paragraph -->',
			].join( '\n' ),
		},
	} );

	await admin.editPost( doc.id );

	// Share with anyone.
	const shareButton = page.getByRole( 'button', { name: 'Share' } );
	if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
		await shareButton.click();
	}
	await page.getByLabel( 'Anyone with the link can edit' ).click();
	await editor.saveDraft();

	// Open 4 anonymous collaborators.
	const animals = [ 'fox', 'bear', 'panda', 'koala' ];
	const contexts = [];
	const anonPages = [];

	try {
		for ( const animal of animals ) {
			const ctx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
			const anonPage = await ctx.newPage();
			await anonPage.goto( BASE_URL + '/wp-admin/post.php?doc=' + doc.slug + '&action=edit&animal=' + animal );
			await expect( anonPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );
			contexts.push( ctx );
			anonPages.push( anonPage );
		}

		// Enable cursors on all pages.
		await page.evaluate( () => {
			wp.data.dispatch( 'core/preferences' ).set( 'core', 'showCollaborationCursor', true );
		} );
		for ( const ap of anonPages ) {
			await ap.evaluate( () => {
				if ( window.wp ) {
					wp.data.dispatch( 'core/preferences' ).set( 'core', 'showCollaborationCursor', true );
				}
			} ).catch( () => {} );
		}

		for ( const ap of anonPages ) {
			await dismissWelcomeModal( ap );
		}

		const clickInCanvas = async ( anonPage, selector, position ) => {
			const iframe = anonPage.locator( 'iframe[name="editor-canvas"]' );
			const loc = ( await iframe.count() > 0 )
				? anonPage.frameLocator( 'iframe[name="editor-canvas"]' ).locator( selector )
				: anonPage.locator( selector );
			await loc.click( { timeout: 5000, position } ).catch( () => {} );
		};

		const dblClickInCanvas = async ( ap, text ) => {
			const iframe = ap.locator( 'iframe[name="editor-canvas"]' );
			const loc = ( await iframe.count() > 0 )
				? ap.frameLocator( 'iframe[name="editor-canvas"]' ).locator( 'text=' + text )
				: ap.locator( 'text=' + text );
			await loc.dblclick( { timeout: 5000 } ).catch( () => {} );
		};

		const tripleClickInCanvas = async ( ap, selector ) => {
			const iframe = ap.locator( 'iframe[name="editor-canvas"]' );
			const loc = ( await iframe.count() > 0 )
				? ap.frameLocator( 'iframe[name="editor-canvas"]' ).locator( selector )
				: ap.locator( selector );
			await loc.click( { clickCount: 3, timeout: 5000 } ).catch( () => {} );
		};

		// Position cursors and selections.
		// Fox: cursor in "Out of the Box" heading
		await clickInCanvas( anonPages[ 0 ], 'h2:has-text("Out of the Box")', { x: 200, y: 10 } );
		// Bear: select "WordPress" in the first paragraph
		await ( async () => {
			await clickInCanvas( anonPages[ 1 ], 'p:has-text("five minutes")', { x: 10, y: 10 } );
			const iframe = anonPages[ 1 ].locator( 'iframe[name="editor-canvas"]' );
			const frame = ( await iframe.count() > 0 )
				? anonPages[ 1 ].frameLocator( 'iframe[name="editor-canvas"]' )
				: anonPages[ 1 ];
			await frame.locator( 'p:has-text("five minutes")' ).evaluate( ( el ) => {
				const word = 'WordPress';
				const walker = document.createTreeWalker( el, NodeFilter.SHOW_TEXT );
				let node;
				while ( ( node = walker.nextNode() ) ) {
					const idx = node.textContent.indexOf( word );
					if ( idx !== -1 ) {
						const sel = window.getSelection();
						const range = document.createRange();
						range.setStart( node, idx );
						range.setEnd( node, idx + word.length );
						sel.removeAllRanges();
						sel.addRange( range );
						break;
					}
				}
			} ).catch( () => {} );
		} )();
		// Panda: select "Design for the Majority" heading
		await tripleClickInCanvas( anonPages[ 2 ], 'h2:has-text("Design for the Majority")' );
		// Koala: cursor at end of "non-technically minded."
		await ( async () => {
			// Click the paragraph first to focus it.
			await clickInCanvas( anonPages[ 3 ], 'p:has-text("non-technically minded")', { x: 10, y: 10 } );
			// Use Keyboard to go to end of "minded." via End key won't work cross-platform.
			// Instead, use the Selection API in the iframe to place cursor precisely.
			const iframe = anonPages[ 3 ].locator( 'iframe[name="editor-canvas"]' );
			const frame = ( await iframe.count() > 0 )
				? anonPages[ 3 ].frameLocator( 'iframe[name="editor-canvas"]' )
				: anonPages[ 3 ];
			await frame.locator( 'p:has-text("non-technically minded")' ).evaluate( ( el ) => {
				const text = 'non-technically minded.';
				const walker = document.createTreeWalker( el, NodeFilter.SHOW_TEXT );
				let node;
				while ( ( node = walker.nextNode() ) ) {
					const idx = node.textContent.indexOf( text );
					if ( idx !== -1 ) {
						const sel = window.getSelection();
						sel.collapse( node, idx + text.length );
						break;
					}
				}
			} ).catch( () => {} );
		} )();

		await page.waitForTimeout( 3000 );

		// Enable fullscreen mode, hide breadcrumbs, and clean up UI.
		await page.evaluate( () => {
			wp.data.dispatch( 'core/preferences' ).set( 'core/edit-post', 'fullscreenMode', true );
			wp.data.dispatch( 'core/preferences' ).set( 'core', 'showBlockBreadcrumbs', false );
			document.querySelectorAll(
				'.components-snackbar-list, .components-popover'
			).forEach( ( el ) => el.remove() );
		} );
		await page.waitForTimeout( 1000 );

		// Resize to banner dimensions and take screenshot.
		await page.setViewportSize( { width: 1544, height: 500 } );
		await page.waitForTimeout( 500 );
		await page.screenshot( { path: 'assets/banner-1544x500.png' } );
	} finally {
		for ( const ctx of contexts ) {
			await ctx.close();
		}
	}
} );
