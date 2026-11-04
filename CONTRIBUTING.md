# Contributing

Thanks for helping out! This project is a single static page, so contributing is simple.

## Reporting a problem

Open an [issue](https://github.com/j0p3s/morphe-json-to-mpp/issues/new/choose) and include:

- the exact input you pasted (a link, `owner/repo`, or the JSON),
- what you expected and what happened,
- the error message shown under the input box, if any,
- your browser.

If a source doesn't convert, first check that the repository actually has a `patches-bundle.json` on `main` or `dev`, or a release with a `.mpp` attached.

## Making a change

1. Fork the repo and create a branch.
2. Edit `index.html`. Everything — markup, styles and script — lives there.
3. Serve the folder locally and test in a browser:
   ```bash
   python -m http.server 8000
   ```
4. Check at least these inputs still work:
   - `MorpheApp/morphe-patches`
   - `https://raw.githubusercontent.com/MorpheApp/morphe-patches/main/patches-bundle.json`
   - a release tag link and a direct `.mpp` link
   - a settings export: `https://github.com/rushiforai/morphe-archive/blob/main/morphe_archive_config_v94.json` (filter the list, then **Get .mpp** on a GitHub and a GitLab source)
   - pasted JSON, including invalid JSON, JSON without `download_url`, and a non-JSON link such as a README
5. Check the page at phone width (about 375 px) in both light and dark mode.
6. Open a pull request describing what changed and why.

## Guidelines

Run `node --test tests/links.test.cjs` to check link generation, filenames, partial failures, pending selection changes, and Desktop config generation (schema, source deduplication, channels, selection and Blob downloads). These tests require Node.js and no additional packages.

- Keep it a single, dependency-light static file with no build step.
- Don't add analytics, trackers or a backend. Input should only go to the hosts needed to resolve it.
- Match the links Morphe itself generates. If Morphe changes its add-source format, update the page and the README together.
