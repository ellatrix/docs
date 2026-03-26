const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const BASE_URL = process.env.WP_BASE_URL || 'http://localhost:2026';

async function dismissWelcomeModal( page ) {
	const dialog = page.getByRole( 'dialog', { name: 'Welcome to the editor' } );
	if ( await dialog.isVisible() ) {
		await dialog.getByRole( 'button', { name: 'Close' } ).click();
	}
}

test.describe( 'Anonymous link sharing flow', () => {

	test( 'anyone with the link can open the editor', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		// 1. Create a doc via REST API.
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Public Doc', status: 'draft' },
		} );

		// 2. Open the doc in the editor.
		await admin.editPost( doc.id );

		// 3. Open the Share panel and set "Anyone with the link" to Edit.
		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}
		await page.locator( '.docs-share-access-select select' ).selectOption( 'anyone' );

		// 4. Save.
		await editor.saveDraft();

		// 5. Get the doc permalink.
		const permalink = doc.link;
		expect( permalink ).toMatch( /\?doc=[a-f0-9]{60}$/ );

		// 6. Visit the link as a logged-out user.
		const anonContext = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const anonPage = await anonContext.newPage();

		try {
			await anonPage.goto( permalink );

			// 7. Should be redirected to the editor (via anon user creation).
			await expect( anonPage ).toHaveURL( /wp-admin\/post\.php.*action=edit/ );

			await dismissWelcomeModal( anonPage );

			// 8. Verify the editor loaded with the doc title.
			await expect(
				anonPage.frameLocator( 'iframe[name="editor-canvas"]' ).getByText( 'Public Doc' )
			).toBeVisible();

			// 9. Verify the user is an anonymous animal.
			const userName = await anonPage.evaluate( () =>
				wp.data.select( 'core' ).getCurrentUser()?.name
			);
			expect( userName ).toMatch( /^Anonymous \w+$/ );
		} finally {
			await anonContext.close();
		}
	} );
} );
