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

	test( 'multiple users can add notes to a philosophy doc', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: {
				title: 'Philosophy',
				status: 'draft',
				content: [
					'<!-- wp:heading -->',
					'<h2 class="wp-block-heading">Out of the Box</h2>',
					'<!-- /wp:heading -->',
					'',
					'<!-- wp:paragraph -->',
					'<p>Great software should work with little configuration and setup. WordPress is designed to get you up and running and fully functional in no longer than five minutes.</p>',
					'<!-- /wp:paragraph -->',
					'',
					'<!-- wp:heading -->',
					'<h2 class="wp-block-heading">Design for the Majority</h2>',
					'<!-- /wp:heading -->',
					'',
					'<!-- wp:paragraph -->',
					'<p>Many end users of WordPress are non-technically minded. They don\'t know what AJAX is, nor do they care about which version of PHP they are using. The average WordPress user simply wants to be able to write without problems or interruption.</p>',
					'<!-- /wp:paragraph -->',
					'',
					'<!-- wp:heading -->',
					'<h2 class="wp-block-heading">Decisions, Not Options</h2>',
					'<!-- /wp:heading -->',
					'',
					'<!-- wp:paragraph -->',
					'<p>When making decisions these are the users we consider first. Every time you give a user an option, you are asking them to make a decision. It\'s our duty as developers to make smart design decisions.</p>',
					'<!-- /wp:paragraph -->',
					'',
					'<!-- wp:heading -->',
					'<h2 class="wp-block-heading">Striving for Simplicity</h2>',
					'<!-- /wp:heading -->',
					'',
					'<!-- wp:paragraph -->',
					'<p>We\'re never done with simplicity. We want to make WordPress easier to use with every single release.</p>',
					'<!-- /wp:paragraph -->',
				].join( '\n' ),
			},
		} );

		await requestUtils.rest( { path: '/docs-test/v1/emails' } );

		// Create two email users.
		const users = [];
		const userEmails = [
			'alice-' + Date.now() + '@example.com',
			'bob-' + Date.now() + '@example.com',
		];
		for ( const email of userEmails ) {
			const user = await requestUtils.rest( {
				path: '/docs/v1/get-or-create-user',
				method: 'POST',
				data: { email },
			} );
			users.push( user );
		}

		// Share the doc with all three.
		await requestUtils.rest( {
			path: '/wp/v2/docs/' + doc.id,
			method: 'POST',
			data: { meta: { 'docs-share-edit': users.map( ( u ) => u.id ) } },
		} );

		// Admin opens the doc and adds a note on the first paragraph.
		await admin.editPost( doc.id );
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		await canvas.getByText( 'Great software should work' ).click();
		await page.getByRole( 'toolbar', { name: 'Block tools' } )
			.getByRole( 'button', { name: 'Options' } ).click();
		await page.getByRole( 'menuitem', { name: /note/i } ).click();
		await page.locator( '.editor-collab-sidebar-panel__comment-form textarea' ).fill( 'Should we change this to 3 minutes?' );
		await page.getByRole( 'button', { name: /Add note/i } ).click();
		await expect( page.getByText( 'Should we change this to 3 minutes?' ) ).toBeVisible( { timeout: 15000 } );

		// Open all email user sessions simultaneously so CRDT state is shared.
		const emails = await requestUtils.rest( { path: '/docs-test/v1/emails' } );
		const notes = [
			{ block: 'non-technically minded', text: 'Love this paragraph, very well put!' },
			{ block: 'Striving for Simplicity', text: '+1, this is the core principle' },
		];

		const contexts = [];
		const userPages = [];

		// First two users add notes to different blocks.
		for ( let i = 0; i < 2; i++ ) {
			const email = emails.filter( ( e ) => e.to === users[ i ].email ).pop();
			if ( ! email ) continue;
			const magicLink = email.message.split( '\r\n\r\n' )[ 2 ];

			const ctx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
			const userPage = await ctx.newPage();
			await userPage.goto( magicLink );
			await expect( userPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );
			await userPage.getByRole( 'dialog', { name: 'Welcome to the editor' } )
				.getByRole( 'button', { name: 'Close' } ).click().catch( () => {} );
			contexts.push( ctx );
			userPages.push( userPage );
		}

		// Wait for CRDT sync to settle across all sessions.
		await page.waitForTimeout( 5000 );

		// Each user adds a note to a different block.
		for ( let i = 0; i < userPages.length; i++ ) {
			const userPage = userPages[ i ];

			await userPage.frameLocator( 'iframe[name="editor-canvas"]' )
				.getByText( notes[ i ].block )
				.click( { timeout: 5000 } )
				.catch( () =>
					userPage.getByText( notes[ i ].block ).click()
				);

			await userPage.getByRole( 'toolbar', { name: 'Block tools' } )
				.getByRole( 'button', { name: 'Options' } ).click();
			await userPage.getByRole( 'menuitem', { name: /note/i } ).click();
			await userPage.locator( '.editor-collab-sidebar-panel__comment-form textarea' ).fill( notes[ i ].text );
			await userPage.getByRole( 'button', { name: /Add note/i } ).click();
			await expect( userPage.getByText( notes[ i ].text ) ).toBeVisible( { timeout: 15000 } );
		}

		// Bob (second user) replies to the admin's note on a different block.
		const bobPage = userPages[ 1 ];

		// Click the block with the admin's note to show it in the sidebar.
		await bobPage.frameLocator( 'iframe[name="editor-canvas"]' )
			.getByText( 'Great software should work' )
			.click( { timeout: 5000 } )
			.catch( () =>
				bobPage.getByText( 'Great software should work' ).click()
			);

		// The admin's note should now appear in the sidebar.
		await expect( bobPage.getByText( 'Should we change this to 3 minutes?' ) ).toBeVisible( { timeout: 15000 } );

		// Reply to it.
		await bobPage.getByText( 'Should we change this to 3 minutes?' ).click();
		await bobPage.locator( '.editor-collab-sidebar-panel__comment-form textarea' ).last().fill( 'Yes, 3 minutes sounds right!' );
		await bobPage.getByRole( 'button', { name: 'Reply', exact: true } ).click();
		await expect( bobPage.getByText( 'Yes, 3 minutes sounds right!' ) ).toBeVisible( { timeout: 15000 } );

		// Close all user sessions.
		for ( const ctx of contexts ) {
			await ctx.close();
		}

		// Reload admin page to see all notes.
		await page.reload();
		await expect( canvas.getByText( 'Great software should work' ) ).toBeVisible();

		// Open the notes panel to verify all notes and reply.
		await page.getByRole( 'button', { name: /notes/i } )
			.or( page.getByRole( 'button', { name: /comments/i } ) )
			.first().click().catch( () => {} );

		await expect( page.getByText( 'Should we change this to 3 minutes?' ) ).toBeVisible( { timeout: 15000 } );
		await expect( page.getByText( 'Yes, 3 minutes sounds right!' ) ).toBeVisible();
		await expect( page.getByText( 'Love this paragraph' ) ).toBeVisible();
		await expect( page.getByText( 'core principle' ) ).toBeVisible();

		if ( process.env.SCREENSHOTS ) {
			// Remove snackbars.
			const snackbars = page.locator( '.components-snackbar-list .components-snackbar' );
			while ( await snackbars.count() > 0 ) {
				await snackbars.first().evaluate( ( el ) => el.remove() );
			}
			await page.screenshot( { path: 'assets/screenshot-2.png' } );
		}

		// Clean up users.
		for ( const user of users ) {
			await requestUtils.rest( {
				path: '/wp/v2/users/' + user.id,
				method: 'DELETE',
				params: { force: true, reassign: 1 },
			} ).catch( () => {} );
		}
	} );
} );
