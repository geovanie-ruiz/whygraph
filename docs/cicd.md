# CI/CD Plan

## Overview

Two GitHub Actions workflows gate the project:

- **`ci.yml`** — runs on every push and every PR. Builds, tests, enforces coverage. No publishing.
- **`publish.yml`** — runs when you publish a GitHub Release. Runs the full gate, then `npm publish`.

Deployment is triggered by creating a GitHub Release tied to a version tag (e.g. `v0.3.0`). The `/release` skill automates the version bump, commit, tag, and push — you then go to GitHub and click "Publish Release."

---

## Upfront Setup (one-time)

### 1. Get an npm automation token

1. Log in to [npmjs.com](https://www.npmjs.com)
2. Avatar → **Access Tokens** → **Generate New Token** → **Automation**
3. Copy the token

### 2. Add `NPM_TOKEN` to GitHub Secrets

1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `NPM_TOKEN`, value: the token from step 1

### 3. Get frontend to 100% coverage

The backend is already at 100%. The frontend is currently at ~88% branch coverage. Before enabling the frontend coverage gate, bring it to 100%:

```bash
cd frontend && npx vitest run --coverage
```

Look at the "Uncovered Line #s" column and write tests for the missing branches. Then enforce it by adding thresholds (see step 4).

### 4. Add coverage thresholds to vitest configs

**Backend** (`vitest.config.ts` at project root — add under `coverage`):

```ts
thresholds: {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
},
```

**Frontend** (`frontend/vitest.config.ts` — add once frontend hits 100%):

```ts
thresholds: {
  statements: 100,
  branches: 100,
  functions: 100,
  lines: 100,
},
```

With thresholds in place, `vitest run --coverage` exits with code 1 if coverage drops below 100%. CI will fail automatically.

### 5. Create the workflow files

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install backend deps
        run: npm ci

      - name: Build
        run: npm run build

      - name: Backend tests (100% coverage enforced)
        run: npx vitest run --coverage

      - name: Install frontend deps
        working-directory: frontend
        run: npm ci

      - name: Frontend tests (100% coverage enforced)
        working-directory: frontend
        run: npx vitest run --coverage
```

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"
          cache: "npm"

      - name: Verify tag matches package.json version
        run: |
          PKG_VERSION="v$(node -p "require('./package.json').version")"
          TAG_VERSION="${GITHUB_REF_NAME}"
          if [ "$PKG_VERSION" != "$TAG_VERSION" ]; then
            echo "Tag $TAG_VERSION does not match package.json version $PKG_VERSION"
            exit 1
          fi

      - name: Install backend deps
        run: npm ci

      - name: Build
        run: npm run build

      - name: Backend tests (100% coverage enforced)
        run: npx vitest run --coverage

      - name: Install frontend deps
        working-directory: frontend
        run: npm ci

      - name: Frontend tests (100% coverage enforced)
        working-directory: frontend
        run: npx vitest run --coverage

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 6. Commit and push the workflows

```bash
git add .github/
git commit -m "ci: add CI and npm publish workflows"
git push
```

GitHub Actions will start running `ci.yml` on your next push.

---

## During Deployments

When you're ready to release a new version:

### 1. Run the `/release` skill

In Claude Code, type:

```
/release
```

The skill will ask whether the change is a **patch**, **minor**, or **major** bump, then:
- Updates `package.json` version
- Creates a git commit and tag
- Pushes both to GitHub

Semver guide:
| Type | When to use | Example |
|------|-------------|---------|
| `patch` | Bug fixes, no new features | `0.2.0` → `0.2.1` |
| `minor` | New backwards-compatible features | `0.2.0` → `0.3.0` |
| `major` | Breaking changes | `0.2.0` → `1.0.0` |

### 2. Create a GitHub Release

1. Go to your repo → **Releases** → **Draft a new release**
2. Click **Choose a tag** → select the tag the skill just pushed (e.g. `v0.3.0`)
3. Write a title and changelog
4. Click **Publish release**

### 3. Watch the workflow

GitHub Actions runs `publish.yml` automatically:
- Verifies tag matches `package.json` version
- Builds and runs the full test suite (coverage enforced)
- Publishes to npm if all gates pass

If any step fails, nothing is published. Fix the issue, re-run the `/release` skill with the same version type, and publish a new release.

---

## What "releases" are

A GitHub Release is a named, tagged snapshot of your repository. It shows up at `github.com/<you>/whygraph/releases` with a changelog and download links. The release is also what `publish.yml` listens for — publishing a release is what fires the workflow that pushes to npm.

npm and GitHub are otherwise unconnected. The link is: **git tag → GitHub Release → workflow → `npm publish`**.
