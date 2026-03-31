const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

const BASE_URL = process.env.WP_BASE_URL || 'http://localhost:2026';

test.describe( 'Block notes', () => {

	test( 'author can add a note to a block', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: {
				title: 'Notes Test',
				status: 'draft',
				content: '<!-- wp:paragraph -->\n<p>Some content to comment on.</p>\n<!-- /wp:paragraph -->',
			},
		} );

		await admin.editPost( doc.id );

		// Click the paragraph block.
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		await canvas.getByText( 'Some content to comment on.' ).click();

		// Open the block toolbar options menu.
		await page.getByRole( 'toolbar', { name: 'Block tools' } )
			.getByRole( 'button', { name: 'Options' } ).click();

		// Click "Add note", type, and submit.
		await page.getByRole( 'menuitem', { name: /note/i } ).click();
		await page.locator( '.editor-collab-sidebar-panel__comment-form textarea' ).fill( 'This needs revision' );
		await page.getByRole( 'button', { name: /Add note/i } ).click();

		// The note should appear.
		await expect( page.getByText( 'This needs revision' ) ).toBeVisible( { timeout: 15000 } );
	} );

	test( 'email-invited user can add a note to a block', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: {
				title: 'Email Notes Test',
				status: 'draft',
				content: '<!-- wp:paragraph -->\n<p>Paragraph for notes.</p>\n<!-- /wp:paragraph -->',
			},
		} );

		await requestUtils.rest( { path: '/docs-test/v1/emails' } );

		const emailUser = await requestUtils.rest( {
			path: '/docs/v1/get-or-create-user',
			method: 'POST',
			data: { email: 'noter-' + Date.now() + '@example.com' },
		} );

		await requestUtils.rest( {
			path: '/wp/v2/docs/' + doc.id,
			method: 'POST',
			data: { meta: { 'docs-share-edit': [ emailUser.id ] } },
		} );

		const emails = await requestUtils.rest( { path: '/docs-test/v1/emails' } );
		const email = emails.filter( ( e ) => e.to === emailUser.email ).pop();
		expect( email ).toBeTruthy();
		const magicLink = email.message.split( '\r\n\r\n' )[ 2 ];

		const ctx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const emailPage = await ctx.newPage();

		try {
			await emailPage.goto( magicLink );
			await expect( emailPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );

			// Dismiss welcome modal if present.
			await emailPage.getByRole( 'dialog', { name: 'Welcome to the editor' } )
				.getByRole( 'button', { name: 'Close' } )
				.click()
				.catch( () => {} );

			// Click the paragraph block.
			await emailPage.frameLocator( 'iframe[name="editor-canvas"]' )
				.getByText( 'Paragraph for notes.' )
				.click( { timeout: 5000 } )
				.catch( () =>
					emailPage.getByText( 'Paragraph for notes.' ).click()
				);

			// Open the block toolbar options menu.
			await emailPage.getByRole( 'toolbar', { name: 'Block tools' } )
				.getByRole( 'button', { name: 'Options' } ).click();

			// Click "Add note", type, and submit.
			await emailPage.getByRole( 'menuitem', { name: /note/i } ).click();
			await emailPage.locator( '.editor-collab-sidebar-panel__comment-form textarea' ).fill( 'Looks good to me' );
			await emailPage.getByRole( 'button', { name: /Add note/i } ).click();

			// The note should appear.
			await expect( emailPage.getByText( 'Looks good to me' ) ).toBeVisible( { timeout: 15000 } );
		} finally {
			await ctx.close();
		}

		// Clean up.
		await requestUtils.rest( {
			path: '/wp/v2/users/' + emailUser.id,
			method: 'DELETE',
			params: { force: true, reassign: 1 },
		} ).catch( () => {} );
	} );
} );
