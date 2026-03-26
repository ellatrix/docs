const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const EMAILS_ENDPOINT = '/index.php?rest_route=/docs-test/v1/emails';

test.describe( 'Email sharing flow', () => {
	let docId;
	let docPermalink;

	test.beforeAll( async ( { requestUtils } ) => {
		// Clear any captured emails.
		await requestUtils.rest( {
			path: '/docs-test/v1/emails',
			method: 'DELETE',
		} );

		// Create a doc shared via email.
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

	test( 'sends an invitation email when an email address is added', async ( {
		requestUtils,
	} ) => {
		// The email was added in beforeAll via REST. Check captured emails.
		const emails = await requestUtils.rest( {
			path: '/docs-test/v1/emails',
			method: 'GET',
		} );

		expect( emails.length ).toBeGreaterThanOrEqual( 1 );

		const invite = emails.find(
			( e ) => e.to === 'testuser@example.com'
		);
		expect( invite ).toBeTruthy();
		expect( invite.subject ).toContain( 'Invitation to Edit' );
		expect( invite.message ).toContain( docPermalink );
		// The magic link should contain action=rp and a key.
		expect( invite.message ).toContain( 'action=rp' );
		expect( invite.message ).toContain( 'key=' );
	} );

	test( 'magic link form shows for unauthenticated visitors', async ( {
		page,
	} ) => {
		await page.context().clearCookies();
		await page.goto( docPermalink );

		// Should see the magic link login form.
		await expect( page.locator( '#user_login' ) ).toBeVisible();
		await expect( page.locator( '#wp-submit' ) ).toBeVisible();

		// Should have a nonce field.
		await expect(
			page.locator( 'input[name="_wpnonce"]' )
		).toBeAttached();
	} );

	test( 'magic link form rejects submission without nonce', async ( {
		page,
	} ) => {
		await page.context().clearCookies();

		// POST directly without a nonce.
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
		requestUtils,
	} ) => {
		// Clear emails first.
		await requestUtils.rest( {
			path: '/docs-test/v1/emails',
			method: 'DELETE',
		} );

		await page.context().clearCookies();
		await page.goto( docPermalink );

		// Fill in the email and submit.
		await page.fill( '#user_login', 'testuser@example.com' );
		await page.click( '#wp-submit' );

		// Should redirect to the confirmation page.
		await expect( page ).toHaveURL( /checkemail=confirm/ );

		// Check that a magic link email was sent.
		const emails = await requestUtils.rest( {
			path: '/docs-test/v1/emails',
			method: 'GET',
		} );

		const magicLink = emails.find(
			( e ) => e.to === 'testuser@example.com'
		);
		expect( magicLink ).toBeTruthy();
		expect( magicLink.message ).toContain( 'action=rp' );
	} );

	test( 'clicking the magic link logs in and redirects to the editor', async ( {
		page,
		requestUtils,
	} ) => {
		// Get the magic link from the last captured email.
		const emails = await requestUtils.rest( {
			path: '/docs-test/v1/emails',
			method: 'GET',
		} );

		const magicLink = emails.find(
			( e ) =>
				e.to === 'testuser@example.com' &&
				e.message.includes( 'action=rp' )
		);
		expect( magicLink ).toBeTruthy();

		// Extract the magic link URL from the email body.
		const urlMatch = magicLink.message.match( /(http[^\s]+action=rp[^\s]+)/ );
		expect( urlMatch ).toBeTruthy();
		const magicUrl = urlMatch[ 1 ];

		// Visit the magic link as a logged-out user.
		await page.context().clearCookies();
		await page.goto( magicUrl );

		// Should be redirected to the editor.
		await expect( page ).toHaveURL( /wp-admin\/post\.php.*action=edit/, {
			timeout: 10000,
		} );

		// The block editor should load. Dismiss the welcome modal if it appears.
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
