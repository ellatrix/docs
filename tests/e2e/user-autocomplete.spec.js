const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'User autocomplete in share panel', () => {

	let testUserId;

	test.beforeAll( async ( { requestUtils } ) => {
		const user = await requestUtils.rest( {
			path: '/wp/v2/users',
			method: 'POST',
			data: {
				username: 'janedoe',
				email: 'jane@example.com',
				password: 'password123!',
				name: 'Jane Doe',
				roles: [ 'editor' ],
			},
		} );
		testUserId = user.id;
	} );

	test.afterAll( async ( { requestUtils } ) => {
		if ( testUserId ) {
			await requestUtils.rest( {
				path: '/wp/v2/users/' + testUserId,
				method: 'DELETE',
				params: { force: true, reassign: 1 },
			} ).catch( () => {} );
		}
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

		const input = page.getByPlaceholder( 'Add people by email or name' );
		await input.fill( 'jane' );

		// Suggestions should appear in a popover.
		const suggestion = page.locator( '.docs-share-suggestion' ).first();
		await expect( suggestion ).toBeVisible();
		await expect( suggestion.locator( '.docs-share-suggestion-name' ) ).toHaveText( 'Jane Doe' );
		await expect( suggestion.locator( '.docs-share-suggestion-email' ) ).toHaveText( 'jane@example.com' );

		await suggestion.click();

		await expect( input ).toHaveValue( '' );
		await expect(
			page.locator( '.docs-share-person-email' ).getByText( 'jane@example.com' )
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

		const input = page.getByPlaceholder( 'Add people by email or name' );
		await input.fill( 'jane' );

		await expect( page.locator( '.docs-share-suggestion' ).first() ).toBeVisible();

		await input.press( 'ArrowDown' );
		await expect( page.locator( '.docs-share-suggestion.is-selected' ) ).toBeVisible();

		await input.press( 'Enter' );

		await expect(
			page.locator( '.docs-share-person-email' ).getByText( 'jane@example.com' )
		).toBeVisible();
	} );
} );
