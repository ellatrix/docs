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

		// 2. Open the doc in the editor (via post ID — should redirect to slug URL).
		await admin.editPost( doc.id );
		await expect( page ).toHaveURL( /wp-admin\/post\.php\?doc=[a-f0-9]+&action=edit/ );

		// 3. Open the Share panel and set "Anyone with the link" to Edit.
		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}
		await page.getByLabel( 'Anyone with the link can edit' ).click();

		// 4. Save.
		await editor.saveDraft();

		// 5. Build the shareable admin URL.
		const slug = doc.slug;
		const shareLink = BASE_URL + '/wp-admin/post.php?doc=' + slug + '&action=edit';

		// 6. Visit the link as a logged-out user.
		const anonContext = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const anonPage = await anonContext.newPage();

		try {
			await anonPage.goto( shareLink );

			// 7. Should stay on the admin slug URL (no redirect to frontend).
			await expect( anonPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );

			await dismissWelcomeModal( anonPage );

			// 8. Verify the editor loaded with the doc title.
			await expect(
				anonPage.getByRole( 'button', { name: /Public Doc/ } )
			).toBeVisible();

			// 9. Verify the user is an anonymous animal.
			const userName = await anonPage.evaluate( () =>
				wp.data.select( 'core' ).getCurrentUser()?.name
			);
			expect( userName ).toMatch( /^Anonymous \w+$/ );

			// 10. Type content and save as the anonymous user.
			const canvas = anonPage.frameLocator( 'iframe[name="editor-canvas"]' );
			await canvas.locator( '[data-type="core/paragraph"], .block-editor-default-block-appender' )
				.first().click();
			await anonPage.keyboard.type( 'Hello from anon' );
			await anonPage.getByRole( 'button', { name: 'Save draft' } ).click();
			await expect(
				anonPage.getByRole( 'button', { name: 'Dismiss this notice' } )
					.filter( { hasText: 'Draft saved' } )
			).toBeVisible();
		} finally {
			await anonContext.close();
		}

		// 11. Verify the content was saved.
		const savedDoc = await requestUtils.rest( {
			path: '/wp/v2/docs/' + doc.id,
			params: { context: 'edit' },
		} );
		expect( savedDoc.content.raw ).toContain( 'Hello from anon' );

		// 12. Check that the original author is preserved.
		expect( savedDoc.author ).toBe( 1 );
	} );

	test( 'docs are not accessible on the frontend', async ( {
		page,
		requestUtils,
	} ) => {
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Private Doc', status: 'draft' },
		} );

		await page.goto( doc.link );
		await expect( page.getByText( 'Private Doc' ) ).not.toBeVisible();
	} );
} );
