const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

async function getLastEmail( page ) {
	const response = await page.request.get(
		'/index.php?rest_route=/docs-test/v1/last-email'
	);
	return response.json();
}

async function clearLastEmail( page ) {
	await page.request.post(
		'/index.php?rest_route=/docs-test/v1/clear-email'
	);
}

test.describe( 'Email sharing flow', () => {
	test( 'adding an email in the share panel sends an invite, and the recipient can open the editor', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		// 1. Create a doc via REST API.
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Sharing Test', status: 'draft' },
		} );

		// 2. Open the doc in the editor.
		await admin.editPost( doc.id );
		await clearLastEmail( page );

		// 3. Open the Share panel and add an email.
		await page.getByRole( 'button', { name: 'Share' } ).click();
		const emailInput = page.getByPlaceholder( 'Add people by email' );
		await emailInput.fill( 'invited@example.com' );
		await emailInput.press( 'Enter' );

		// 4. Save to trigger the invitation email.
		await page.screenshot( { path: 'test-results/before-save.png' } );
		await page.keyboard.press( 'Meta+s' );
		await page.waitForTimeout( 2000 );
		await page.screenshot( { path: 'test-results/after-save.png' } );

		// 5. Check that an invitation email was sent.
		const email = await getLastEmail( page );
		expect( email.to ).toBe( 'invited@example.com' );
		expect( email.subject ).toContain( 'Invitation to Edit' );
		expect( email.message ).toContain( 'action=rp' );
		expect( email.message ).toContain( 'key=' );

		// 6. Extract the magic link from the email.
		const urlMatch = email.message.match( /(http[^\s]+action=rp[^\s]+)/ );
		expect( urlMatch ).toBeTruthy();

		// 7. Open the magic link as a logged-out user.
		await page.context().clearCookies();
		await page.goto( urlMatch[ 1 ] );

		// The magic link sets a cookie and redirects to the permalink,
		// then the logged-in user gets redirected to the editor.
		await expect( page ).toHaveURL( /wp-admin\/post\.php.*action=edit/, {
			timeout: 15000,
		} );

		// Dismiss the welcome modal if it appears.
		await page
			.getByRole( 'button', { name: 'Close', exact: true } )
			.click( { timeout: 5000 } )
			.catch( () => {} );

		// 8. Verify the editor loaded with the doc title.
		await expect(
			page.frameLocator( 'iframe[name="editor-canvas"]' ).getByText( 'Sharing Test' )
		).toBeVisible( { timeout: 10000 } );

		// 9. Log out and visit the doc link again — should show the email form.
		await page.context().clearCookies();
		// Extract the doc permalink from the magic link URL (everything before &action=rp).
		const docPermalink = urlMatch[ 1 ].split( '&action=rp' )[ 0 ];
		await page.goto( docPermalink );

		await expect( page.locator( '#user_login' ) ).toBeVisible();
		await expect( page.locator( '#wp-submit' ) ).toBeVisible();
	} );
} );
