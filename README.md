# Video Web Saver

A simple website you can run in any modern browser to keep:

- links to videos you are allowed to save
- video files from your own computer

Everything stays on your device. Links are stored in `localStorage`. Uploaded video files and their pictures are stored in IndexedDB.

Each card shows a picture of the video:
- uploaded files use a frame from the video
- YouTube links use the public thumbnail picture
- other links can use an optional picture URL you paste

## What this is not

This is not a YouTube / TikTok / Instagram downloader.

Only save videos you made yourself, videos you have permission to keep, or videos that are clearly free to use.

## How to use

1. Open `index.html` in a browser, or host the folder on GitHub Pages.
2. Choose **Save a link** or **Save a file from this device**.
3. Add a title and optional notes.
4. Click **Save to library**.
5. Play saved files, open links, search, export, or delete items.

## GitHub Pages

In the repository settings, turn on Pages from the `main` branch root. Then visit:

`https://glitchplays1.github.io/video-web-saver/`

## Files

- `index.html` — page structure
- `styles.css` — look and layout
- `app.js` — save, search, play, import/export

## License

MIT
