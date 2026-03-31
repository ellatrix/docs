const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const BASE_URL = process.env.WP_BASE_URL || 'http://localhost:2026';

test.describe( 'Stale cookie handling', () => {

	test( 'stale anon cookie shows session expired message', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		// 1. Create a doc with link sharing.
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Stale Cookie Test', status: 'draft' },
		} );

		await admin.editPost( doc.id );

		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}
		await page.getByLabel( 'Anyone with the link can edit' ).click();
		await editor.saveDraft();

		// 2. Visit as anon to get a valid cookie.
		const shareLink = BASE_URL + '/wp-admin/post.php?doc=' + doc.slug + '&action=edit';
		const ctx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const anonPage = await ctx.newPage();

		try {
			await anonPage.goto( shareLink );
			await expect( anonPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );

			// 3. Get the logged-in cookie details.
			const cookies = await ctx.cookies();
			const loggedInCookie = cookies.find( ( c ) => c.name.startsWith( 'wordpress_logged_in_' ) );
			expect( loggedInCookie ).toBeTruthy();

			// 4. Replace with a stale cookie that has a different anon ID
			// but the same token (simulating the old PHP_INT_MAX scheme).
			const originalValue = decodeURIComponent( loggedInCookie.value );
			const parts = originalValue.split( '|' );
			parts[ 0 ] = 'docs_anon_9223372036854775807'; // old PHP_INT_MAX
			await ctx.clearCookies();
			await ctx.addCookies( [ {
				name: loggedInCookie.name,
				value: encodeURIComponent( parts.join( '|' ) ),
				domain: loggedInCookie.domain,
				path: '/',
				httpOnly: loggedInCookie.httpOnly,
				secure: loggedInCookie.secure,
			} ] );

			// 5. Reload — should show session expired.
			await anonPage.goto( shareLink );
			await expect( anonPage.getByText( 'session has expired' ) ).toBeVisible();

			// 6. Refresh — should work with a fresh cookie.
			await anonPage.getByRole( 'link', { name: 'refresh the page' } ).click();
			await expect( anonPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );
		} finally {
			await ctx.close();
		}
	} );
} );
