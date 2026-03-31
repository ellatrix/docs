const { test, expect } = require( '@wordpress/e2e-test-utils-playwright' );
const path = require( 'path' );
const fs = require( 'fs' );

const BASE_URL = process.env.WP_BASE_URL || 'http://localhost:2026';

function dismissWelcomeModal( page ) {
	return page.getByRole( 'dialog', { name: 'Welcome to the editor' } )
		.getByRole( 'button', { name: 'Close' } )
		.click()
		.catch( () => {} );
}

test.describe( 'Email user file upload', () => {

	test.afterAll( async ( { requestUtils } ) => {
		const users = await requestUtils.rest( {
			path: '/wp/v2/users',
			params: { search: 'uploader@example.com' },
		} ).catch( () => [] );
		for ( const user of users ) {
			await requestUtils.rest( {
				path: '/wp/v2/users/' + user.id,
				method: 'DELETE',
				params: { force: true, reassign: 1 },
			} ).catch( () => {} );
		}
	} );

	test( 'email-invited user can upload an image', async ( {
		admin,
		editor,
		page,
		requestUtils,
	} ) => {
		// Create a test image file.
		const testImagePath = path.join( __dirname, 'test-image.png' );
		if ( ! fs.existsSync( testImagePath ) ) {
			// 1x1 red PNG.
			const png = Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
				'base64'
			);
			fs.writeFileSync( testImagePath, png );
		}

		// 1. Create a doc and share with an email user.
		const doc = await requestUtils.rest( {
			path: '/wp/v2/docs',
			method: 'POST',
			data: { title: 'Upload Test', status: 'draft' },
		} );

		await requestUtils.rest( { path: '/docs-test/v1/emails' } );

		const emailUser = await requestUtils.rest( {
			path: '/docs/v1/get-or-create-user',
			method: 'POST',
			data: { email: 'uploader@example.com' },
		} );

		await requestUtils.rest( {
			path: '/wp/v2/docs/' + doc.id,
			method: 'POST',
			data: { meta: { 'docs-share-edit': [ emailUser.id ] } },
		} );

		// 2. Get the magic link.
		const emails = await requestUtils.rest( { path: '/docs-test/v1/emails' } );
		const email = emails.filter( ( e ) => e.to === 'uploader@example.com' ).pop();
		expect( email ).toBeTruthy();
		const magicLink = email.message.split( '\r\n\r\n' )[ 2 ];

		// 3. Open as the email user.
		const ctx = await admin.browser.newContext( { baseURL: BASE_URL, storageState: undefined } );
		const emailPage = await ctx.newPage();

		try {
			await emailPage.goto( magicLink );
			await expect( emailPage ).toHaveURL( /wp-admin\/post\.php\?doc=.*action=edit/ );
			await dismissWelcomeModal( emailPage );

			// 4. Add an image block via the inserter.
			const canvas = emailPage.frameLocator( 'iframe[name="editor-canvas"]' );
			await canvas.locator( '.block-editor-default-block-appender, [data-type="core/paragraph"]' )
				.first().click();

			// Type /image to insert an image block.
			await emailPage.keyboard.type( '/image' );
			await emailPage.getByRole( 'option', { name: 'Image' } ).first().click();

			// 5. Upload a file via the form file upload input (inside the canvas iframe).
			const fileInput = canvas.locator( '[data-testid="form-file-upload-input"]' );
			await fileInput.setInputFiles( testImagePath );

			// 6. Wait for the image to appear in the editor.
			await expect(
				canvas.locator( 'img[src*="test-image"]' )
			).toBeVisible( { timeout: 15000 } );
		} finally {
			await ctx.close();
			// Clean up test image.
			fs.unlinkSync( testImagePath );
		}
	} );
} );
