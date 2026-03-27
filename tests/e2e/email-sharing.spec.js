const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const BASE_URL = process.env.WP_BASE_URL || 'http://localhost:2026';

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
		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}
		const emailInput = page.getByPlaceholder( 'Add people by email or name' );
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

		// 6. Open the magic link as a logged-out user.
		const magicLink = lines[ 2 ];
		const ctx1 = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const page1 = await ctx1.newPage();

		try {
			await page1.goto( magicLink );
			await expect( page1 ).toHaveURL( /wp-admin\/post\.php.*action=edit/ );
			await dismissWelcomeModal( page1 );

			// 7. Verify the editor loaded with the doc title.
			await expect(
				page1.frameLocator( 'iframe[name="editor-canvas"]' ).getByText( 'Sharing Test' )
			).toBeVisible();
		} finally {
			await ctx1.close();
		}

		// 8. Visit the doc link again logged out — should show the email form.
		const ctx2 = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const page2 = await ctx2.newPage();

		try {
			await page2.goto( magicLink );

			await expect( page2.locator( '#user_login' ) ).toBeVisible();
			await expect( page2.locator( '#wp-submit' ) ).toBeVisible();

			// 9. Submit the email form to request a new magic link.
			await page2.fill( '#user_login', 'invited@example.com' );
			await page2.click( '#wp-submit' );
			await expect( page2 ).toHaveURL( /checkemail=confirm/ );
		} finally {
			await ctx2.close();
		}

		// 10. Check that a new magic link email was sent.
		const email2 = await getLastEmail( page );
		const lines2 = email2.message.split( '\r\n\r\n' );
		expect( email2.to ).toBe( 'invited@example.com' );
		expect( email2.subject ).toBe( 'Invitation to Edit "Sharing Test"' );
		expect( lines2[ 0 ] ).toBe( 'Hi invited@example.com' );
		expect( lines2[ 1 ] ).toBe( 'admin from "docs" invites you to edit "Sharing Test". Use the link below to open the editor.' );
		expect( lines2[ 2 ] ).toMatch( /^http:\/\/[^/]+\/\?doc=[a-f0-9]+&action=rp&key=[\w]+&login=\S+$/ );

		// 11. Use the new magic link to open the editor.
		const magicLink2 = lines2[ 2 ];
		const ctx3 = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const page3 = await ctx3.newPage();

		try {
			await page3.goto( magicLink2 );
			await expect( page3 ).toHaveURL( /wp-admin\/post\.php.*action=edit/ );
			await dismissWelcomeModal( page3 );

			await expect(
				page3.frameLocator( 'iframe[name="editor-canvas"]' ).getByText( 'Sharing Test' )
			).toBeVisible();
		} finally {
			await ctx3.close();
		}
	} );
} );
