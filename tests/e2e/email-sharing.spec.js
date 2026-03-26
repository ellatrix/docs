const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const LAST_EMAIL_ENDPOINT = '/index.php?rest_route=/docs-test/v1/last-email';

async function getLastEmail( page ) {
	const response = await page.request.get( LAST_EMAIL_ENDPOINT );
	return response.json();
}

test.describe( 'Email sharing flow', () => {
	let docId;
	let docPermalink;

	test.beforeAll( async ( { requestUtils } ) => {
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: {
				title: 'Email Share Test',
				status: 'draft',
				meta: {
					'docs-share-anyone': 'email',
					'docs-share-email-addresses': 'testuser@example.com',
				},
			},
		} );
		docId = doc.id;
		docPermalink = doc.link;
	} );

	test.afterAll( async ( { requestUtils } ) => {
		await requestUtils.rest( {
			path: '/wp/v2/docs/' + docId,
			method: 'DELETE',
			params: { force: true },
		} ).catch( () => {} );
	} );

	test( 'magic link form shows for unauthenticated visitors', async ( {
		page,
	} ) => {
		await page.context().clearCookies();
		await page.goto( docPermalink );

		await expect( page.locator( '#user_login' ) ).toBeVisible();
		await expect( page.locator( '#wp-submit' ) ).toBeVisible();
		await expect(
			page.locator( 'input[name="_wpnonce"]' )
		).toBeAttached();
	} );

	test( 'magic link form rejects submission without nonce', async ( {
		page,
	} ) => {
		await page.context().clearCookies();

		const response = await page.request.post( docPermalink, {
			form: {
				user_login: 'testuser@example.com',
			},
		} );

		const body = await response.text();
		expect( body ).toContain( 'Security check failed' );
	} );

	test( 'magic link form sends a login email on valid submission', async ( {
		page,
	} ) => {
		await page.context().clearCookies();
		await page.goto( docPermalink );

		await page.fill( '#user_login', 'testuser@example.com' );
		await page.click( '#wp-submit' );

		await expect( page ).toHaveURL( /checkemail=confirm/ );

		const email = await getLastEmail( page );
		expect( email.to ).toBe( 'testuser@example.com' );
		expect( email.subject ).toContain( 'Invitation to Edit' );
		expect( email.message ).toContain( 'action=rp' );
		expect( email.message ).toContain( 'key=' );
	} );

	test( 'clicking the magic link logs in and redirects to the editor', async ( {
		page,
	} ) => {
		const email = await getLastEmail( page );
		const urlMatch = email.message.match( /(http[^\s]+action=rp[^\s]+)/ );
		expect( urlMatch ).toBeTruthy();

		await page.context().clearCookies();
		await page.goto( urlMatch[ 1 ] );

		await expect( page ).toHaveURL( /wp-admin\/post\.php.*action=edit/, {
			timeout: 10000,
		} );

		// Dismiss the welcome modal if it appears.
		await page
			.getByRole( 'button', { name: 'Close', exact: true } )
			.click( { timeout: 5000 } )
			.catch( () => {} );

		// Verify the editor loaded with the doc title.
		await expect(
			page.frameLocator( 'iframe[name="editor-canvas"]' ).getByText( 'Email Share Test' )
		).toBeVisible( { timeout: 10000 } );
	} );
} );
