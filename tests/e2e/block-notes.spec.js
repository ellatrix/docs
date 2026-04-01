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
			data: { email: 'noter@example.com' },
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

	test( 'anonymous user can add a note to a block', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: {
				title: 'Anon Notes Test',
				status: 'draft',
				content: '<!-- wp:paragraph -->\n<p>Paragraph for anon notes.</p>\n<!-- /wp:paragraph -->',
			},
		} );

		// Enable "Anyone with the link can edit".
		await admin.editPost( doc.id );
		await editor.openDocumentSettingsSidebar();
		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}
		await page.getByLabel( 'Anyone with the link can edit' ).click();
		await editor.saveDraft();

		// Open as anonymous user.
		const ctx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const anonPage = await ctx.newPage();

		try {
			await anonPage.goto( BASE_URL + '/wp-admin/post.php?doc=' + doc.slug + '&action=edit' );
			await expect( anonPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );

			await anonPage.getByRole( 'dialog', { name: 'Welcome to the editor' } )
				.getByRole( 'button', { name: 'Close' } )
				.click()
				.catch( () => {} );

			// Click the paragraph block.
			await anonPage.frameLocator( 'iframe[name="editor-canvas"]' )
				.getByText( 'Paragraph for anon notes.' )
				.click( { timeout: 5000 } )
				.catch( () =>
					anonPage.getByText( 'Paragraph for anon notes.' ).click()
				);

			// Add a note.
			await anonPage.getByRole( 'toolbar', { name: 'Block tools' } )
				.getByRole( 'button', { name: 'Options' } ).click();
			await anonPage.getByRole( 'menuitem', { name: /note/i } ).click();
			await anonPage.locator( '.editor-collab-sidebar-panel__comment-form textarea' ).fill( 'Anon note here!' );
			await anonPage.getByRole( 'button', { name: /Add note/i } ).click();

			await expect( anonPage.getByText( 'Anon note here!' ) ).toBeVisible( { timeout: 15000 } );
		} finally {
			await ctx.close();
		}
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

		// Create one email user.
		const saraUser = await requestUtils.rest( {
			path: '/docs/v1/get-or-create-user',
			method: 'POST',
			data: { email: 'sara@example.com' },
		} );

		// Share the doc with sara and enable link sharing.
		await requestUtils.rest( {
			path: '/wp/v2/docs/' + doc.id,
			method: 'POST',
			data: { meta: { 'docs-share-edit': [ saraUser.id ], 'docs-share-anyone': 'anyone' } },
		} );

		// Admin opens the doc and adds a note on the first paragraph.
		await admin.editPost( doc.id );
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		await canvas.getByText( 'Great software should work' ).click();
		await page.getByRole( 'toolbar', { name: 'Block tools' } )
			.getByRole( 'button', { name: 'Options' } ).click();
		await page.getByRole( 'menuitem', { name: /note/i } ).click();
		await page.locator( '.editor-collab-sidebar-panel__comment-form textarea' ).fill( 'Wow, only five minutes?' );
		await page.getByRole( 'button', { name: /Add note/i } ).click();
		await expect( page.getByText( 'Wow, only five minutes?' ) ).toBeVisible( { timeout: 15000 } );

		const contexts = [];

		// Anon user opens via link sharing and adds a note.
		const anonCtx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const anonPage = await anonCtx.newPage();
		await anonPage.goto( BASE_URL + '/wp-admin/post.php?doc=' + doc.slug + '&action=edit' );
		await expect( anonPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );
		await anonPage.getByRole( 'dialog', { name: 'Welcome to the editor' } )
			.getByRole( 'button', { name: 'Close' } ).click().catch( () => {} );
		contexts.push( anonCtx );

		// Sara opens via magic link.
		const emails = await requestUtils.rest( { path: '/docs-test/v1/emails' } );
		const saraEmail = emails.filter( ( e ) => e.to === 'sara@example.com' ).pop();
		const saraCtx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const saraPage = await saraCtx.newPage();
		await saraPage.goto( saraEmail.message.split( '\r\n\r\n' )[ 2 ] );
		await expect( saraPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );
		await saraPage.getByRole( 'dialog', { name: 'Welcome to the editor' } )
			.getByRole( 'button', { name: 'Close' } ).click().catch( () => {} );
		contexts.push( saraCtx );

		// Wait for CRDT sync to settle.
		await page.waitForTimeout( 5000 );

		// Anon adds a note on "non-technically minded" paragraph.
		const addNote = async ( userPage, block, text ) => {
			await userPage.frameLocator( 'iframe[name="editor-canvas"]' )
				.getByText( block ).click( { timeout: 5000 } )
				.catch( () => userPage.getByText( block ).click() );
			await userPage.getByRole( 'toolbar', { name: 'Block tools' } )
				.getByRole( 'button', { name: 'Options' } ).click();
			await userPage.getByRole( 'menuitem', { name: /note/i } ).click();
			await userPage.locator( '.editor-collab-sidebar-panel__comment-form textarea' ).fill( text );
			await userPage.getByRole( 'button', { name: /Add note/i } ).click();
			await expect( userPage.getByText( text ) ).toBeVisible( { timeout: 15000 } );
		};

		await addNote( anonPage, 'non-technically minded', 'Love this paragraph, very well put!' );
		await addNote( saraPage, 'Striving for Simplicity', '+1, this is a core principle' );

		// Sara replies to the admin's note.
		const bobPage = saraPage;

		// Click the block with the admin's note to show it in the sidebar.
		await bobPage.frameLocator( 'iframe[name="editor-canvas"]' )
			.getByText( 'Great software should work' )
			.click( { timeout: 5000 } )
			.catch( () =>
				bobPage.getByText( 'Great software should work' ).click()
			);

		// The admin's note should now appear in the sidebar.
		await expect( bobPage.getByText( 'Wow, only five minutes?' ) ).toBeVisible( { timeout: 15000 } );

		// Reply to it.
		await bobPage.getByText( 'Wow, only five minutes?' ).click();
		await bobPage.locator( '.editor-collab-sidebar-panel__comment-form textarea' ).last().fill( 'Yes, pretty famous!' );
		await bobPage.getByRole( 'button', { name: 'Reply', exact: true } ).click();
		await expect( bobPage.getByText( 'Yes, pretty famous!' ) ).toBeVisible( { timeout: 15000 } );

		// Admin adds a note on the last paragraph to trigger a refetch of all comments.
		await page.waitForTimeout( 2000 );
		await canvas.getByText( 'never done with simplicity' ).click();
		await page.waitForTimeout( 500 );
		await page.getByRole( 'toolbar', { name: 'Block tools' } )
			.getByRole( 'button', { name: 'Options' } ).click();
		await page.getByRole( 'menuitem', { name: /note/i } ).click();
		await page.locator( '.editor-collab-sidebar-panel__comment-form textarea' ).fill( 'Agreed!' );
		await page.getByRole( 'button', { name: /Add note/i } ).click();
		await expect( page.getByText( 'Agreed!' ) ).toBeVisible( { timeout: 15000 } );

		// The refetch should have pulled in all other users' notes.
		await expect( page.getByText( 'Love this paragraph' ) ).toBeVisible( { timeout: 15000 } );

		if ( process.env.SCREENSHOTS ) {
			// Deselect the block and scroll to top.
			await canvas.locator( 'body' ).click( { position: { x: 0, y: 0 } } );
			await canvas.locator( 'html' ).evaluate( ( el ) => el.scrollTop = 0 );
			await page.waitForTimeout( 500 );

			await page.evaluate( () => {
				document.querySelectorAll(
					'.components-snackbar-list, .block-editor-block-contextual-toolbar, .editor-collab-sidebar-panel__comment-form'
				).forEach( ( el ) => el.remove() );
			} );
			await page.screenshot( { path: 'assets/screenshot-2.png' } );
		}

		// Close all user sessions.
		for ( const ctx of contexts ) {
			await ctx.close();
		}

		// Clean up user.
		await requestUtils.rest( {
			path: '/wp/v2/users/' + saraUser.id,
			method: 'DELETE',
			params: { force: true, reassign: 1 },
		} ).catch( () => {} );
	} );
} );
