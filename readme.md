# Docs

    Contributors:      ellatrix, wordpressdotorg
    Tags:              docs, documents, collaboration
    Requires at least: 7.0
    Tested up to:      7.0
    Stable tag:        0.0.2
    License:           GPL-2.0+

Create and share documents with WordPress!

## Description

This plugin allows you to create documents with WordPress, and to share them with others so they can also read and edit. Share the unique link to let anyone edit, or restrict access to specific email addresses.

With WordPress 7.0, Docs supports **real-time collaborative editing** — multiple users can edit the same document simultaneously, seeing each other's cursors and changes live.

### Sharing

The share panel (in the document sidebar) lets you control access:

* **Anyone with the link** — anonymous users get a randomly generated animal name and emoji avatar (e.g. "Anonymous Fox").
* **Specific people** — invite collaborators by email. They receive a magic link to access the editor without needing a WordPress account.
* **Restricted** — only the document author and invited people can access.

### Anonymous users

Anonymous collaborators are assigned a random animal identity (name + emoji avatar) so they're distinguishable during collaboration. They are automatically cleaned up when their sessions expire.

## Development

Requires [Docker](https://www.docker.com/) and [Node.js](https://nodejs.org/).

```bash
npm install
npx wp-env start
```

The dev site runs at http://localhost:2025 (admin/password).

### E2E tests

```bash
npm run test:e2e
```

## Changelog

### 0.0.2

* Real-time collaborative editing with WordPress 7.0.
* Google Docs-style share panel with per-person and general access controls.
* Anonymous users get random animal names and emoji avatars.
* Magic link email invitations for sharing with specific people.
* Daily cleanup of expired anonymous user sessions.
* Security: nonce verification, input sanitization, tightened capabilities.
* E2E test suite with Playwright.

### 0.0.1

* Initial version.
