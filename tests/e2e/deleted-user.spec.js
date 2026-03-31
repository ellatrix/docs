const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const BASE_URL = process.env.WP_BASE_URL || 'http://localhost:2026';

test.describe( 'Deleted email user handling', () => {

	test( 'deleted email user is redirected to login', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		// 1. Create a doc and share with an email user.
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Deleted User Test', status: 'draft' },
		} );

		// Consume stale emails.
		await requestUtils.rest( { path: '/docs-test/v1/emails' } );

		const emailUser = await requestUtils.rest( {
			path: '/docs/v1/get-or-create-user',
			method: 'POST',
			data: { email: 'deleteme-' + Date.now() + '@example.com' },
		} );

		await requestUtils.rest( {
			path: '/wp/v2/docs/' + doc.id,
			method: 'POST',
			data: { meta: {
				'docs-share-edit': [ emailUser.id ],
				'docs-share-anyone': 'anyone',
			} },
		} );

		// 2. Get the magic link.
		const emails = await requestUtils.rest( { path: '/docs-test/v1/emails' } );
		const email = emails.filter( ( e ) => e.to === emailUser.email ).pop();
		expect( email ).toBeTruthy();
		const magicLink = email.message.split( '\r\n\r\n' )[ 2 ];

		// 3. Log in as the email user via magic link.
		const ctx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const emailPage = await ctx.newPage();

		try {
			await emailPage.goto( magicLink );
			await expect( emailPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );

			// 4. Delete the user while they're logged in.
			await requestUtils.rest( {
				path: '/wp/v2/users/' + emailUser.id,
				method: 'DELETE',
				params: { force: true, reassign: 1 },
			} );

			// 5. Reload — cookie is invalid (user deleted). Since the doc
			// has "anyone with the link" enabled, the user gets a fresh
			// anon identity via login_init → redirect → anon handler.
			await emailPage.goto( BASE_URL + '/wp-admin/post.php?doc=' + doc.slug + '&action=edit' );
			await expect( emailPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );
		} finally {
			await ctx.close();
		}
	} );
} );
