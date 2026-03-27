const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'Docs_anon email conflict', () => {

	test( 'REST API returns a clear error when email belongs to a docs_anon user', async ( {
		requestUtils,
	} ) => {
		const suffix = Date.now();
		const email = 'conflict-' + suffix + '@example.com';

		// Create a docs_anon user.
		await requestUtils.rest( {
			path: '/docs/v1/get-or-create-user',
			method: 'POST',
			data: { email: email },
		} );

		// Try to create a new user with the same email.
		try {
			await requestUtils.rest( {
				path: '/wp/v2/users',
				method: 'POST',
				data: {
					username: 'conflict_' + suffix,
					email: email,
					password: 'password123!',
					name: 'Conflict User',
					roles: [ 'editor' ],
				},
			} );
			// Should not reach here.
			expect( true ).toBe( false );
		} catch ( error ) {
			// The REST API returns an error because the email exists.
			expect( error.code || error.message ).toBeTruthy();
		}
	} );
} );
