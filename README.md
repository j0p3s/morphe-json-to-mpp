# Morphe JSON → MPP

**Live:** https://j0p3s.github.io/morphe-json-to-mpp/

A single web page that turns a Morphe `patches-bundle.json` — or a link to one, a repository, or a whole Morphe Manager settings export — into:

- a direct **download of the `.mpp` patch bundle**,
- an **add-source link for Morphe Android** (Morphe Manager), with a QR code for scanning from a computer,
- a **source link and CLI command for Morphe Desktop**,
- a downloadable **Morphe Desktop `config.json`** populated with the input's patch sources,
- a **share link** that reproduces the same conversion for someone else,
- **checks** that the JSON is valid, the bundle's fields make sense, and the `.mpp` really exists.

It runs entirely in your browser. There is no backend, no build step and no tracking.

## Why

Morphe patch repositories publish their patches as a compiled `.mpp` file, and describe the latest release in a small `patches-bundle.json`:

```json
{
  "version": "2.0.0",
  "created_at": "2026-10-30T11:13:25",
  "description": "## Release notes…",
  "download_url": "https://github.com/MorpheApp/morphe-patches/releases/download/v2.0.0/patches-2.0.0.mpp",
  "signature_download_url": ""
}
```

When someone shares a patch source, you usually get one of these JSON files, a raw link, or a repository URL. This page takes any of those and gives you what you actually need: the `.mpp` itself, or a link that adds the source to Morphe so it keeps updating.

> A `.mpp` is a compiled bundle, so nothing is "built" here. The page reads `download_url` from the JSON and generates the links around it.

## How to use

1. Open the [live page](https://j0p3s.github.io/morphe-json-to-mpp/).
2. Paste something into the box, drop a `.json` file on it, or click **Open file…**. It converts automatically.
3. Read the **Checks** panel, which flags invalid JSON, odd fields and broken `.mpp` links.
4. Pick what you need:
   - **Download** the `.mpp`.
   - **Open in Morphe** on your Android phone, or scan the QR code from a computer.
   - **Copy** the source link into **Add source** in Morphe Desktop, or use the command line:
     ```bash
     java -jar morphe-desktop-*-all.jar patch -p patches-2.0.0.mpp your_app.apk
     ```

### Accepted input

| You paste | Example | What happens |
| --- | --- | --- |
| JSON contents | `{ "download_url": "…/patches-1.0.0.mpp", … }` | Read directly |
| Raw JSON link | `https://raw.githubusercontent.com/owner/repo/main/patches-bundle.json` (also `refs/heads/main/…`) | Fetched |
| GitHub file link | `https://github.com/owner/repo/blob/main/patches-bundle.json` | Converted to raw and fetched |
| Repository | `https://github.com/owner/repo` or just `owner/repo` | `patches-bundle.json` on `main`, then `dev`, then the latest GitHub release with a `.mpp` asset |
| GitLab repository or file | `https://gitlab.com/owner/repo` | Same as GitHub, through the GitLab API |
| Codeberg file | `https://codeberg.org/owner/repo/src/branch/main/patches-bundle.json` | Fetched through the Codeberg API |
| GitHub Gist | `https://gist.github.com/user/<id>` | Its `patches-bundle.json`, or its first `.json` file |
| jsDelivr | `https://cdn.jsdelivr.net/gh/owner/repo@main/patches-bundle.json` | Fetched |
| Release tag | `https://github.com/owner/repo/releases/tag/v1.2.3` | The `.mpp` attached to that release |
| Direct `.mpp` link | `https://github.com/owner/repo/releases/download/v1.2.3/patches-1.2.3.mpp` | Used as-is |
| Morphe add-source link | `https://morphe.software/add-source?github=owner/repo` | Resolved to the repository |
| Morphe Manager settings export | [`morphe_archive_config_v94.json`](https://github.com/rushiforai/morphe-archive/blob/main/morphe_archive_config_v94.json), pasted or linked | Lists every patch source in `settings.customBundles` (see below) |
| Any other JSON URL | `https://example.com/patches-bundle.json` | Fetched, if that server allows cross-origin requests |

### Settings exports and source lists

A Morphe Manager settings export holds your list of patch sources (`settings.customBundles`). Paste one, or link to it, and the page shows a searchable list of every source. For each one you can:

- **Get .mpp**: fetch that source's `patches-bundle.json` and show its download, links and checks below the list.
- **Open in Morphe**: add it to Morphe Android straight away (only for sources on the `main` or `dev` branch, which is what add-source links support).

#### Download links for several sources

Tick sources in the list and press **Get selected .mpp links**. This fetches the sources' metadata without downloading any `.mpp` files. The first text box contains only direct `.mpp` download URLs, separated by commas; **Copy all** copies these plain URLs. Repository URLs and suggested filenames are shown beside the individual download links below the boxes. Changing the selection clears the old links.

For JDownloader, use **Copy for JDownloader** and paste into **Add New Links**. The second text box prefixes each download URL with `directhttp://` and puts one link per line. This tells JDownloader to handle the URL as a file, including uncommon extensions such as `.mpp`, instead of crawling pages. Do not copy repository URLs into LinkGrabber: they can cause it to collect GitHub scripts and images. This format is specific to JDownloader; use the plain URLs in a browser. Broken or removed release assets will still be unavailable.

Suggested filenames use `author-repo-version-XX.mpp`, with XX taken from the JSON's `version`: for example, `author-repo-version-1.2.3.mpp`. The same naming applies to individual conversions. When the JSON has no version, the version in the original filename is used, or `unknown` if neither is available. Without a repository, the original filename is kept. Cross-site downloads may ignore the suggested filename and keep the server's name; rename the saved file to the name shown in the list if needed.

#### Generate Morphe Desktop config.json

The **Morphe Desktop config.json** section uses all supported patch sources from the JSON or link in the first input field. It also works with a single patch bundle whose GitHub/GitLab repository can be identified, or a Desktop config's `patchSource` list. Tick **Use only the sources ticked in the list above** to limit the config to your selection. Filtering alone does not change which sources are included.

The downloaded file follows Morphe Desktop's config schema. It keeps the official `morphe-default` source once, deduplicates repositories, creates enabled `GITHUB`/`GITLAB` entries with unique IDs, and reports sources Desktop cannot use. **Include pre-release patches** starts enabled, matching the reference config; turn it off to follow stable releases. Source version preferences are generated to match that choice. A preview shows the exact file before downloading.

Click **Download config.json**, close Morphe Desktop, and back up your current config. Replace `config.json` in `morphe-data` beside the application JAR. Installations using the Windows user-home fallback should put it in `%USERPROFILE%\morphe` instead. For custom storage, use the folder containing the current config (the `MORPHE_DATA_DIR` setting takes precedence). Reopen Morphe Desktop. These locations follow [Morphe Desktop's storage-path resolver](https://github.com/MorpheApp/morphe-desktop/blob/main/src/main/kotlin/app/morphe/engine/MorpheData.kt).

This is a starter config based on the supplied schema, not an edit of the visitor's installed settings. Signing paths, passwords and the GitHub token are blank; reconfigure signing if needed. No MPP files are merged or fetched to generate the config.

#### Several sources in one Morphe Desktop run

Morphe Desktop can load several sources side by side. The list lets you **tick sources** (or **Select shown** after filtering) and builds one command:

```bash
java -jar morphe-desktop-*-all.jar patch -p https://github.com/owner/one -p https://gitlab.com/owner/two your_app.apk
```

Desktop downloads each source's latest `.mpp` itself, so this also works for sources whose bundle isn't on `main`/`dev`. The page warns when the command gets too long for Windows (about 8,000 characters). Pick only the sources meant for the app you're patching, since bundles for the same app can conflict.

Duplicates and entries without a valid link are skipped and counted in the checks. A plain JSON array of source URLs, or of `{ "name", "source" }` objects, works the same way.

Only the source list is used: the app settings in the file are ignored. Exports can contain your keystore password and, if you enabled it, a GitHub token, so **don't post your own export publicly**. The page warns you when it sees a token, and never puts a pasted export into a share link.

### Checks

Every conversion shows a **Checks** panel:

- **JSON:** whether it parses. On an error you get the line, the column and the spot in the text. HTML pages (a common mistake when linking a GitHub page instead of the raw file) are detected.
- **Bundle fields:** `download_url` must be an http(s) link and should end in `.mpp`; `version` should match the file name; `created_at` must be a real date; `signature_download_url` and `public_key` are checked when present. Unknown fields are listed. A `patches-list.json` gets a hint to use `patches-bundle.json` instead.
- **The `.mpp` itself:** for GitHub releases, the page confirms the release exists and the file is attached, and shows its size. Other hosts are checked when they allow it.

## The links it makes

**Morphe Android:** `https://morphe.software/add-source?github=owner/repo` (or `gitlab=`). This is the same format Morphe Manager uses when you share a source. On Android it opens Morphe Manager and asks to add the source. On a computer it opens Morphe's website, which shows a QR code. If no GitHub or GitLab repository can be worked out, the page tells you to download the `.mpp` and open it with Morphe Manager instead.

**Morphe Desktop:** Desktop has no clickable link scheme, so you paste the same add-source link (or the repository URL) into its **Add source** dialog. You can also load the downloaded `.mpp` as a local file, or pass it to the CLI.

**Share link:** opens this page and converts the same input automatically.

| Parameter | Example | Notes |
| --- | --- | --- |
| `?src=` | `?src=crimera/piko` | Any accepted input except JSON contents (alias: `?url=`) |
| `#json=` | `#json=eyJkb3dubG9hZF91cmwi…` | Base64url-encoded JSON. Release notes are dropped to keep the link short. |

## Limitations

- **Add-source links name only the repository.** Morphe then reads `patches-bundle.json` from the repository root on `main` or `dev`. A bundle from another branch or path may point to a different release; the page warns you when that's the case.
- **Cross-origin rules.** Browsers can only read JSON from servers that allow it. GitHub, GitLab, Codeberg, Gists and jsDelivr work. Others, such as Pastebin, don't: the page then offers an **Open the link** button so you can copy the JSON and paste it in.
- **The `.mpp` is downloaded straight from where it is hosted.** The page doesn't proxy or modify it. It shows a **Signature** button when the bundle lists a `signature_download_url`.
- **GitHub API rate limit.** Checking that a `.mpp` exists, resolving release tags or Gists, and repositories without a `patches-bundle.json` all use the GitHub API, which allows 60 requests per hour per IP without signing in. When the limit is hit, anything read from a `patches-bundle.json` still converts and only the existence check is skipped.

## Run it yourself

It's one static file. Clone the repo and serve the folder with anything, for example:

```bash
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk also works, but some browsers block clipboard access on `file://` pages.

The only external resource is [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) from jsDelivr. Without it everything works except the QR code.

## Privacy

Everything happens in your browser. Your input is sent only to the hosts needed to resolve it (GitHub, GitLab, or the URL you entered). Nothing is stored or collected by this page.

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Disclaimer

This is an independent community tool. It is **not affiliated with or endorsed by Morphe**. Only add patch sources you trust: a patch bundle is code that runs inside the apps you patch.

## License

[MIT](LICENSE) © 2026 j0p3s
