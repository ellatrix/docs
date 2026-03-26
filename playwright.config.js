const { defineConfig } = require( '@playwright/test' );

process.env.WP_BASE_URL = 'http://localhost:2026';

module.exports = defineConfig( {
	testDir: './tests/e2e',
	globalSetup: './tests/e2e/global-setup.js',
	use: {
		baseURL: process.env.WP_BASE_URL,
		storageState: './tests/e2e/storage-state.json',
	},
	webServer: {
		command: 'npm run env:start',
		url: process.env.WP_BASE_URL,
		reuseExistingServer: true,
	},
	workers: 1,
} );
