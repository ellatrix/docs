const { request } = require( '@playwright/test' );
const { RequestUtils } = require( '@wordpress/e2e-test-utils-playwright' );

module.exports = async function globalSetup( config ) {
	const storageStatePath =
		process.env.STORAGE_STATE_PATH ||
		config.projects[ 0 ]?.use?.storageState;
	const baseURL = process.env.WP_BASE_URL || 'http://localhost:2026';

	const requestContext = await request.newContext( { baseURL } );
	const requestUtils = new RequestUtils( requestContext, {
		storageStatePath,
	} );
	await requestUtils.setupRest();

	// Enable collaborative editing on the test site.
	await requestUtils.rest( {
		path: '/wp/v2/settings',
		method: 'PUT',
		data: { wp_collaboration_enabled: true },
	} );

	await requestContext.dispose();
};
