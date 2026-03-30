# Docs

    Contributors:      ellatrix, wordpressdotorg
    Tags:              docs, documents, collaboration
    Requires at least: 6.9
    Tested up to:      6.9
    Requires Plugins:  gutenberg
    Stable tag:        0.0.2
    License:           GPL-2.0+

Create and share documents with WordPress!

## Description

This plugin allows you to create documents with WordPress, and to share them with others so they can also read and edit. Share the unique link to let anyone edit, or restrict access to specific email addresses.

With the Gutenberg plugin, Docs supports **real-time collaborative editing** — multiple users can edit the same document simultaneously, seeing each other's cursors and changes live.

### Sharing

The share panel (in the document sidebar) lets you control access:

* **Anyone with the link** — anonymous users get a randomly generated animal name and emoji avatar (e.g. "Anonymous Fox").
* **Specific people** — invite collaborators by email. They receive a magic link to access the editor without needing a WordPress account.
* **Restricted** — only the document author and invited people can access.

## Architecture

All collaborators — anonymous link visitors, email-invited people, and existing WP users — are stored as WordPress users. This simplifies capability checks, avatar handling, and collaborative editing presence.

* **Anonymous link visitors** get a `docs_anon` user with a random animal name, no email, and a session cookie. A daily cron job (`docs_cleanup_anon_users`) deletes these users once all their sessions expire.
* **Email-invited people** get a `docs_anon` user with their email address. They receive a magic link (password reset key) to log in. These users persist so they can be re-invited to other docs. If a real WP account is later created with the same email, the `docs_anon` account is automatically upgraded.
* **Existing WP users** are added directly by user ID from the autocomplete.

Shared user IDs are stored in `docs-share-edit` post meta (one row per user, `single: false, type: integer`). A `user_has_cap` filter grants doc editing capabilities dynamically based on this meta. Invitation emails are sent via an `added_post_meta` hook — WordPress diffs multi-value meta on save, so emails are only sent for newly added users.

The `docs_anon` role is hidden from the admin users list and user search queries via a `pre_get_users` filter. To list these users with WP-CLI, pass the role explicitly:

```bash
wp user list --role=docs_anon
```

## Future

* **View-only and comment-only sharing** — `docs-share-view` and `docs-share-comment` meta keys. Blocked by WordPress core requiring `edit_posts` for the comments REST API, which prevents granting limited access without also granting full editing.
* **"Shared with me" view** — list docs shared with the current user by querying `docs-share-edit` meta.

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

* Real-time collaborative editing (requires Gutenberg plugin).
* Google Docs-style share panel with per-person and general access controls.
* Anonymous users get random animal names and emoji avatars.
* Magic link email invitations for sharing with specific people.
* Daily cleanup of expired anonymous user sessions.
* Security: nonce verification, input sanitization, tightened capabilities.
* E2E test suite with Playwright.

### 0.0.1

* Initial version.
