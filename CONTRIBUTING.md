# Contributing

## Development

Requires [Docker](https://www.docker.com/) and [Node.js](https://nodejs.org/).

```bash
npm install
npx wp-env start
```

Dev site: http://localhost:2025 (admin/password). Test site: http://localhost:2026.

### Tests

```bash
npm run test:e2e                    # WP 6.9 + Gutenberg
npm run test:e2e:7.0                # WP 7.0 without Gutenberg
npm run test:e2e:screenshots        # Generate plugin assets
```

All tests must pass before committing.

## Releasing

The plugin is on wordpress.org via SVN. **Only update SVN for releases.**

SVN is checked out alongside git:
- `.` → `https://plugins.svn.wordpress.org/docs/trunk`
- `assets/` → `https://plugins.svn.wordpress.org/docs/assets`

```bash
# 1. Update version in index.php and readme.md
# 2. Commit and push to git
# 3. Push to SVN
svn ci -m "Release X.Y.Z"
# 4. Tag the release
svn cp https://plugins.svn.wordpress.org/docs/trunk https://plugins.svn.wordpress.org/docs/tags/X.Y.Z -m "Tag X.Y.Z"
```
