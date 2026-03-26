const baseConfig = require( '@wordpress/scripts/config/playwright.config.js' );
const { defineConfig } = require( '@playwright/test' );

process.env.WP_BASE_URL = 'http://localhost:2026';

module.exports = defineConfig( {
	...baseConfig,
	testDir: './tests/e2e',
	globalSetup: './tests/e2e/global-setup.js',
	webServer: {
		command: 'npm run env:start',
		url: process.env.WP_BASE_URL,
		reuseExistingServer: true,
	},
} );
