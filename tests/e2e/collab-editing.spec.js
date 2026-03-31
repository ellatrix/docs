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
			data: { title: 'Limit Test', status: 'draft' },
		} );

		await admin.editPost( doc.id );

		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}
		await page.getByLabel( 'Anyone with the link can edit' ).click();
		await editor.saveDraft();

		const shareLink = BASE_URL + '/wp-admin/post.php?doc=' + doc.slug + '&action=edit';
		const contexts = [];

		try {
			for ( let i = 0; i < 4; i++ ) {
				const ctx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
				const anonPage = await ctx.newPage();
				await anonPage.goto( shareLink );
				await expect( anonPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );
				contexts.push( ctx );
			}

			// Wait for presence to show all collaborators.
			const presence = page.locator( '.editor-collaborators-presence' );
			await expect( presence ).toBeVisible( { timeout: 15000 } );
			await presence.locator( 'button' ).click();

			const items = page.locator( '.editor-collaborators-presence__list-item' );
			// 4 anon + 1 admin = 5.
			await expect( items ).toHaveCount( 5, { timeout: 15000 } );

			// Verify the anonymous animals are not all the same.
			const names = await page.locator( '.editor-collaborators-presence__list-item-name' ).allTextContents();
			const anonNames = names.filter( function( n ) { return n.startsWith( 'Anonymous' ); } );
			const uniqueNames = [ ...new Set( anonNames ) ];
			expect( uniqueNames.length ).toBeGreaterThan( 1 );
		} finally {
			for ( const ctx of contexts ) {
				await ctx.close();
			}
		}
	} );

} );
