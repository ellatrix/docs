const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'User autocomplete in share panel', () => {

	test.beforeAll( async ( { requestUtils } ) => {
		// Create test user if it doesn't exist.
		await requestUtils.rest( {
			path: '/wp/v2/users',
			method: 'POST',
			data: {
				username: 'janedoe',
				email: 'jane@example.com',
				password: 'password123!',
				name: 'Jane Doe',
				roles: [ 'editor' ],
			},
		} ).catch( () => {} ); // Ignore if already exists.
	} );

	test( 'focusing the input shows recent users', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Focus Test', status: 'draft' },
		} );

		await admin.editPost( doc.id );

		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}

		const input = page.getByRole( 'combobox', { name: 'Add people' } );
		await input.focus();

		// Should show recent users, including our test user.
		await expect( page.getByRole( 'option', { name: /Jane Doe/ } ) ).toBeVisible();
	} );

	test( 'typing a name shows user suggestions and selecting one adds their email', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Autocomplete Test', status: 'draft' },
		} );

		await admin.editPost( doc.id );

		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}

		const input = page.getByRole( 'combobox', { name: 'Add people' } );
		await input.fill( 'jane' );

		const option = page.getByRole( 'option', { name: /Jane Doe/ } );
		await expect( option ).toBeVisible();

		await option.click();

		await expect(
			page.locator( '.docs-share-person-name' ).getByText( 'Jane Doe' )
		).toBeVisible();
	} );

	test( 'keyboard navigation works for suggestions', async ( {
		admin,
		page,
		requestUtils,
	} ) => {
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Keyboard Test', status: 'draft' },
		} );

		await admin.editPost( doc.id );

		const shareButton = page.getByRole( 'button', { name: 'Share' } );
		if ( await shareButton.getAttribute( 'aria-expanded' ) !== 'true' ) {
			await shareButton.click();
		}

		const input = page.getByRole( 'combobox', { name: 'Add people' } );
		await input.fill( 'jane' );

		await expect( page.getByRole( 'option', { name: /Jane Doe/ } ) ).toBeVisible();

		await input.press( 'ArrowDown' );
		await input.press( 'Enter' );

		await expect(
			page.locator( '.docs-share-person-name' ).getByText( 'Jane Doe' )
		).toBeVisible();
	} );
} );
