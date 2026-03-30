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

* **Anyone with the link** — anonymous users get a randomly generated animal name and emoji avatar (e.g. "Anonymous Fox"). They can edit text but cannot upload files.
* **Specific people** — invite collaborators by email. They receive a magic link to access the editor. Email-invited users can upload files.
* **Existing users** — add collaborators from the user autocomplete. They get full editing and upload access.
* **Restricted** — only the document author and invited people can access.

## Architecture

There are three types of collaborators, each handled differently:

* **Anonymous link visitors** are fake users — no database row is created. Identity is stored entirely in the WP auth cookie with a deterministic animal name derived from the session token. The user cache is primed on each request so WordPress treats them as logged-in users. No cleanup needed.
* **Email-invited people** are real WordPress users with no role. They receive a magic link (password reset key) to log in. These users persist so they can be re-invited to other docs and so revisions are attributed to them.
* **Existing WP users** are added directly by user ID from the autocomplete.

Shared user IDs are stored in `docs-share-edit` post meta (one row per user, `single: false, type: integer`). A `user_has_cap` filter grants doc editing capabilities dynamically based on this meta. Invitation emails are sent via an `added_post_meta` hook — WordPress diffs multi-value meta on save, so emails are only sent for newly added users.

The `edit_docs` capability is granted to all users dynamically — it serves as a gate cap for the sync server and REST API, while actual per-doc access is controlled by the sharing-based `user_has_cap` filter.

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
npm run test:e2e:7.0  # WP 7.0 without Gutenberg
```

## Changelog

### 0.0.2

* Real-time collaborative editing (requires Gutenberg plugin).
* Google Docs-style share panel with per-person and general access controls.
* Anonymous users as fake cookie-based users (no database rows).
* Magic link email invitations for sharing with specific people.
* File upload support for email-invited and existing users.
* Security: nonce verification, input sanitization, dynamic capabilities.
* E2E test suite with Playwright (WP 6.9 + Gutenberg and WP 7.0).

### 0.0.1

* Initial version.
