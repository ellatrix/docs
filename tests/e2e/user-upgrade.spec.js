const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );

test.describe( 'User upgrade from docs_anon', () => {

	test( 'creating a WP user with an email that belongs to a docs_anon user upgrades it', async ( {
		requestUtils,
	} ) => {
		// 1. Create a docs_anon user via the plugin's endpoint.
		const anonUser = await requestUtils.rest( {
			path: '/docs/v1/get-or-create-user',
			method: 'POST',
			data: { email: 'upgrade-test@example.com' },
		} );
		expect( anonUser.id ).toBeGreaterThan( 0 );

		// 2. Create a new WP user with the same email.
		const newUser = await requestUtils.rest( {
			path: '/wp/v2/users',
			method: 'POST',
			data: {
				username: 'upgraded_user',
				email: 'upgrade-test@example.com',
				password: 'password123!',
				name: 'Upgraded User',
				roles: [ 'editor' ],
			},
		} );

		// 3. Should return the same user ID, upgraded.
		expect( newUser.id ).toBe( anonUser.id );
		expect( newUser.name ).toBe( 'Upgraded User' );
		expect( newUser.roles ).toContain( 'editor' );
	} );
} );
