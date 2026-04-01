const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const BASE_URL = process.env.WP_BASE_URL || 'http://localhost:2026';

test.describe( 'Sharing permissions', () => {

	test( 'shared non-author cannot change sharing settings via API', async ( {
		admin,
		requestUtils,
	} ) => {
		// Create a doc as admin and share it with an email user.
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Perms Test', status: 'draft' },
		} );

		await requestUtils.rest( { path: '/docs-test/v1/emails' } );

		const user = await requestUtils.rest( {
			path: '/docs/v1/get-or-create-user',
			method: 'POST',
			data: { email: 'attacker@example.com' },
		} );

		await requestUtils.rest( {
			path: '/wp/v2/docs/' + doc.id,
			method: 'POST',
			data: { meta: { 'docs-share-edit': [ user.id ] } },
		} );

		// Get the magic link for the shared user.
		const emails = await requestUtils.rest( { path: '/docs-test/v1/emails' } );
		const email = emails.filter( ( e ) => e.to === 'attacker@example.com' ).pop();
		const magicLink = email.message.split( '\r\n\r\n' )[ 2 ];

		// Open the magic link to authenticate as the shared user.
		const ctx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const page = await ctx.newPage();
		await page.goto( magicLink );
		await expect( page ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );

		// Try to change sharing settings via API as the shared user.
		const response = await page.request.post(
			'/index.php?rest_route=/wp/v2/docs/' + doc.id,
			{
				data: { meta: { 'docs-share-anyone': 'anyone' } },
				headers: { 'X-WP-Nonce': await page.evaluate( () => window.wpApiSettings?.nonce ) },
			}
		);

		await ctx.close();

		// Verify the sharing setting was NOT changed.
		const updated = await requestUtils.rest( {
			path: '/wp/v2/docs/' + doc.id,
		} );
		expect( updated.meta[ 'docs-share-anyone' ] ).not.toBe( 'anyone' );

		// Clean up.
		await requestUtils.rest( {
			path: '/wp/v2/users/' + user.id,
			method: 'DELETE',
			params: { force: true, reassign: 1 },
		} ).catch( () => {} );
	} );
} );
