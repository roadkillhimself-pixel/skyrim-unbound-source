# skymp5-front

This repo contains GUI demo for Skyrim Multiplayer. Original chat interface by **davinchi59** has been ported.

* `yarn build` is used to build the project.
* `yarn watch` is used to rebuild the bundle on every change.

If `outputPath` points at your Skyrim Multiplayer UI folder, the rebuilt assets will land there automatically while `yarn watch` is running.

## How To Use This 

Create `config.js` and specify an output folder.
```js
module.exports = {
    /* TIP: Change to '<your_server_path>/data/ui' */
    outputPath: "./dist",
};
```
