const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

async function getLastEmail( page ) {
	const response = await page.request.get(
		'/index.php?rest_route=/docs-test/v1/last-email'
	);
	return response.json();
}

async function dismissWelcomeModal( page ) {
	const dialog = page.getByRole( 'dialog', { name: 'Welcome to the editor' } );
	if ( await dialog.isVisible() ) {
		await dialog.getByRole( 'button', { name: 'Close' } ).click();
	}
}

test.describe( 'Email sharing flow', () => {

	test( 'adding an email in the share panel sends an invite, and the recipient can open the editor', async ( {
		admin,
		editor,
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

		// 3. Open the Share panel and add an email.
		await page.getByRole( 'button', { name: 'Share' } ).click();
		const emailInput = page.getByPlaceholder( 'Add people by email' );
		await emailInput.fill( 'invited@example.com' );
		await emailInput.press( 'Enter' );

		// 4. Save to trigger the invitation email.
		await editor.saveDraft();

		// 5. Check that an invitation email was sent.
		const email = await getLastEmail( page );
		const lines = email.message.split( '\r\n\r\n' );
		expect( email.to ).toBe( 'invited@example.com' );
		expect( email.subject ).toBe( 'Invitation to Edit "Sharing Test"' );
		expect( lines[ 0 ] ).toBe( 'Hi invited@example.com' );
		expect( lines[ 1 ] ).toBe( 'admin from "docs" invites you to edit "Sharing Test". Use the link below to open the editor.' );
		expect( lines[ 2 ] ).toMatch( /^http:\/\/[^/]+\/\?doc=[a-f0-9]+&action=rp&key=[\w]+&login=\S+$/ );

		// 6. Extract the magic link from the email.
		const magicLink = lines[ 2 ];

		// 7. Open the magic link as a logged-out user.
		await page.context().clearCookies();
		await page.goto( magicLink );

		// The magic link sets a cookie and redirects to the permalink,
		// then the logged-in user gets redirected to the editor.
		await expect( page ).toHaveURL( /wp-admin\/post\.php.*action=edit/ );

		// Dismiss the welcome modal if it appears.
		await dismissWelcomeModal( page );

		// 8. Verify the editor loaded with the doc title.
		await expect(
			editor.canvas.getByText( 'Sharing Test' )
		).toBeVisible();

		// 9. Log out and visit the doc link again — should show the email form.
		await page.context().clearCookies();
		await page.goto( magicLink );

		await expect( page.locator( '#user_login' ) ).toBeVisible();
		await expect( page.locator( '#wp-submit' ) ).toBeVisible();

		// 10. Submit the email form to request a new magic link.
		await page.fill( '#user_login', 'invited@example.com' );
		await page.click( '#wp-submit' );
		await expect( page ).toHaveURL( /checkemail=confirm/ );

		// 11. Check that a new magic link email was sent.
		const email2 = await getLastEmail( page );
		const lines2 = email2.message.split( '\r\n\r\n' );
		expect( email2.to ).toBe( 'invited@example.com' );
		expect( email2.subject ).toBe( 'Invitation to Edit "Sharing Test"' );
		expect( lines2[ 0 ] ).toBe( 'Hi invited@example.com' );
		expect( lines2[ 1 ] ).toBe( 'admin from "docs" invites you to edit "Sharing Test". Use the link below to open the editor.' );
		expect( lines2[ 2 ] ).toMatch( /^http:\/\/[^/]+\/\?doc=[a-f0-9]+&action=rp&key=[\w]+&login=\S+$/ );

		// 12. Use the new magic link to open the editor.
		const magicLink2 = lines2[ 2 ];

		await page.context().clearCookies();
		await page.goto( magicLink2 );

		await expect( page ).toHaveURL( /wp-admin\/post\.php.*action=edit/ );

		await dismissWelcomeModal( page );

		await expect(
			editor.canvas.getByText( 'Sharing Test' )
		).toBeVisible();
	} );
} );
