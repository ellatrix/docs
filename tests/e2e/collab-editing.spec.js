const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const BASE_URL = process.env.WP_BASE_URL || 'http://localhost:2026';

async function dismissWelcomeModal( page ) {
	const dialog = page.getByRole( 'dialog', { name: 'Welcome to the editor' } );
	if ( await dialog.isVisible() ) {
		await dialog.getByRole( 'button', { name: 'Close' } ).click();
	}
}

test.describe( 'Collaborative editing', () => {

	test( 'admin and anonymous user can edit the same doc simultaneously', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		// 1. Create a doc.
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Collab Test', status: 'draft' },
		} );

		// 2. Open the doc as admin.
		await admin.editPost( doc.id );
		await dismissWelcomeModal( page );

		await expect(
			editor.canvas.getByText( 'Collab Test' )
		).toBeVisible();

		// 3. Set "Anyone with the link" to Edit via the Share panel.
		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}
		await page.getByLabel( 'Anyone with the link can edit' ).click();
		await editor.saveDraft();

		// 4. Open the doc in a fresh browser context (no cookies) as anonymous.
		const anonContext = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const anonPage = await anonContext.newPage();

		try {
			await anonPage.goto( BASE_URL + '/wp-admin/post.php?doc=' + doc.slug + '&action=edit' );
			await expect( anonPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );
			await dismissWelcomeModal( anonPage );

			await expect(
				anonPage.getByRole( 'button', { name: /Collab Test/ } )
			).toBeVisible();

			// 5. Wait for collab sync to exchange awareness.
			const adminPresence = page.locator( '.editor-collaborators-presence' );
			await expect( adminPresence ).toBeVisible( { timeout: 15000 } );

			const anonPresence = anonPage.locator( '.editor-collaborators-presence' );
			await expect( anonPresence ).toBeVisible( { timeout: 15000 } );

			// 6. Click the presence button on the admin page and verify collaborator names.
			await adminPresence.locator( 'button' ).click();
			const adminCollabList = page.locator( '.editor-collaborators-presence__list' );
			await expect( adminCollabList ).toBeVisible();
			// Admin sees themselves as "You" and the anon user by animal name.
			await expect( adminCollabList ).toContainText( 'You' );
			await expect( adminCollabList ).toContainText( /Anonymous \w+/ );

			// 7. Click the presence button on the anon page and verify collaborator names.
			await anonPresence.locator( 'button' ).click();
			const anonCollabList = anonPage.locator( '.editor-collaborators-presence__list' );
			await expect( anonCollabList ).toBeVisible();
			// Anon sees themselves as "You" and the admin by name.
			await expect( anonCollabList ).toContainText( 'You' );
			await expect( anonCollabList ).toContainText( 'admin' );
		} finally {
			await anonContext.close();
		}
	} );

	test( 'more than 3 anonymous users can collaborate simultaneously', async ( {
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

		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}
		await page.getByLabel( 'Anyone with the link can edit' ).click();
		await editor.saveDraft();

		const animals = [ 'fox', 'bear', 'panda', 'koala' ];
		const contexts = [];
		const anonPages = [];

		try {
			for ( let i = 0; i < animals.length; i++ ) {
				const ctx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
				const anonPage = await ctx.newPage();
				await anonPage.goto( BASE_URL + '/wp-admin/post.php?doc=' + doc.slug + '&action=edit&animal=' + animals[ i ] );
				await expect( anonPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );
				contexts.push( ctx );
				anonPages.push( anonPage );
			}

			// Enable cursor visibility on all pages.
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

			// Position each anon user's cursor at a specific place.
			for ( let i = 0; i < anonPages.length; i++ ) {
				await dismissWelcomeModal( anonPages[ i ] );
			}

			const clickInCanvas = async ( anonPage, selector, position ) => {
				const iframe = anonPage.locator( 'iframe[name="editor-canvas"]' );
				const loc = ( await iframe.count() > 0 )
					? anonPage.frameLocator( 'iframe[name="editor-canvas"]' ).locator( selector )
					: anonPage.locator( selector );
				await loc.click( { timeout: 5000, position } ).catch( () => {} );
			};

			// 1: end of "Decisions, Not Options" heading
			await clickInCanvas( anonPages[ 0 ], 'h2:has-text("Decisions, Not Options")', { x: 400, y: 10 } );
			// 2: after "PHP they are using." in Design for the Majority
			await clickInCanvas( anonPages[ 1 ], 'p:has-text("non-technically minded")', { x: 350, y: 30 } );
			// 3: end of "end users." in Decisions paragraph
			await clickInCanvas( anonPages[ 2 ], 'p:has-text("smart design decisions")', { x: 600, y: 40 } );
			// 4: in "Striving for Simplicity" section
			await clickInCanvas( anonPages[ 3 ], 'p:has-text("never done with simplicity")', { x: 200, y: 10 } );

			// Give time for cursor positions to sync.
			await page.waitForTimeout( 3000 );

			// Wait for presence to show all collaborators.
			const presence = page.locator( '.editor-collaborators-presence' );
			await expect( presence ).toBeVisible( { timeout: 15000 } );

			// Verify count via the presence popup.
			await presence.locator( 'button' ).click();
			const items = page.locator( '.editor-collaborators-presence__list-item' );
			// 4 anon + 1 admin = 5.
			await expect( items ).toHaveCount( 5, { timeout: 15000 } );

			if ( process.env.SCREENSHOTS ) {
				// Wait for snackbars to auto-dismiss.
				await expect(
					page.locator( '.components-snackbar' )
				).toHaveCount( 0, { timeout: 15000 } ).catch( () => {} );
				await page.screenshot( { path: 'assets/screenshot-1.png' } );
			}

			// Verify the specific animals are present.
			const names = await page.locator( '.editor-collaborators-presence__list-item-name' ).allTextContents();
			for ( const animal of animals ) {
				const expected = 'Anonymous ' + animal.charAt( 0 ).toUpperCase() + animal.slice( 1 );
				expect( names ).toContain( expected );
			}
		} finally {
			for ( const ctx of contexts ) {
				await ctx.close();
			}
		}
	} );

} );
