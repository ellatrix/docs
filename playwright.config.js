const { defineConfig } = require( '@playwright/test' );

process.env.WP_BASE_URL = 'http://localhost:2026';

module.exports = defineConfig( {
	testDir: './tests/e2e',
	use: {
		baseURL: process.env.WP_BASE_URL,
	},
	webServer: {
		command: 'npm run env:start',
		url: process.env.WP_BASE_URL,
		reuseExistingServer: true,
	},
	workers: 1,
} );
