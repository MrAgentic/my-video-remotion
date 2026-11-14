# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i --loglevel=error
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

## Browser video editor

```console
npm run editor
```

Opens a single server on `http://localhost:5173` (Vite in middleware mode plus a
small `/api/*` layer in `server/index.mjs`). Edit video clips, background audio,
text overlays and `.srt`/`.vtt` captions, preview them through
`@remotion/player`, and export an MP4.

Preview and export use the **same** composition (`src/render/EditorComposition.tsx`,
registered as `Editor`), so what you see is what renders. The project is a plain
JSON object (`src/editor/types.ts`) — autosaved to `localStorage` and
importable/exportable as a `.json` file.

- `GET /api/media` – lists video/audio in `public/` (durations probed with ffprobe)
- `POST /api/upload?name=<file>` – raw binary body, saved into `public/`
- `POST /api/render` – project JSON in the body, returns `{ jobId }`
- `GET /api/render/:id` – `{ status, progress, outputName, error, downloadUrl }`
- `GET /api/out/:name` – download the finished file

Manual render without the UI:

```console
npx remotion render src/index.ts Editor out/clip.mp4 --props=/absolute/path/to/project.json
```

`public/sample.srt` and `public/sample-audio.m4a` are test fixtures.
`?project=<urlencoded JSON>` seeds the editor on load, which is handy for
automated checks.

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
