# Docs

    Contributors:      ellatrix
    Tags:              docs, documents, collaboration, real-time, sharing
    Requires at least: 6.9
    Tested up to:      6.9
    Requires Plugins:  gutenberg
    Stable tag:        1.0.2
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

### How it works

Documents live entirely in wp-admin — there's no public frontend. Each doc gets a unique and secret shareable URL that opens the editor directly.

**Anonymous visitors** don't create any database entries. Their identity exists only in a browser cookie and disappears when it expires.

**Email-invited people** are created as real WordPress users (without a role) so their edits show up in revision history. They log in via magic links sent to their email.

## Screenshots

1. Real-time collaborative editing with multiple anonymous users.
2. Block notes from multiple collaborators aligned to blocks.

## Changelog

### 1.0.2

* Anonymous users can add block notes on docs with link sharing enabled.
* Hide status and author fields from the doc sidebar.
* Fix early translation loading notice with WP_DEBUG enabled.
* Override note name capitalisation from Gutenberg CSS.

### 1.0.1

* Security: only doc authors and admins can modify sharing settings.
* Security: restrict user creation endpoint to doc authors.
* Block notes (comments) support for docs.
* Email-invited users can see and reply to other users' notes.

### 1.0.0

* Real-time collaborative editing (requires Gutenberg plugin or WordPress 7.0).
* Anonymous visitors no longer create database users — identity is cookie-based.
* Animal emoji avatars for anonymous collaborators.
* User autocomplete in the share panel.
* File upload support for email-invited users.
* All capabilities are now dynamic — no stored roles or caps.
* URLs are admin based instead of front-end redirects.

### 0.0.1

* Initial version.
