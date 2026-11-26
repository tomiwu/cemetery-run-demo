# Third-party assets

All third-party files come from the GitHub release `asset-sources-v1` of this repo:
https://github.com/tomiwu/cemetery-run-demo/releases/tag/asset-sources-v1

The owner bot downloaded the original files on 2026-11-26 and uploaded them unchanged (fonts: Latin WOFF2 subsets of the original files). `SHA256SUMS` in the release lists the checksums. `scripts/fetch-assets.sh` downloads, checks and extracts them.

| Release file                                | Original source                                                    | Author                          | Licence     |
| ------------------------------------------- | ------------------------------------------------------------------ | ------------------------------- | ----------- |
| kenney_graveyard-kit.zip                    | https://kenney.nl/assets/graveyard-kit (version 5.0)               | Kenney                          | CC0 1.0     |
| kenney_impact-sounds.zip                    | https://kenney.nl/assets/impact-sounds                             | Kenney                          | CC0 1.0     |
| void_estate.mp3                             | https://opengameart.org/content/haunting-chiptune-loop-void-estate | Zane Little Music               | CC0         |
| void_estate_haunted_arcade.mp3              | https://opengameart.org/content/haunting-chiptune-loop-void-estate | Zane Little Music               | CC0         |
| Fraunces-latin.woff2 + OFL-Fraunces.txt     | https://github.com/undercasetype/Fraunces                          | The Fraunces Project Authors    | SIL OFL 1.1 |
| NunitoSans-latin.woff2 + OFL-NunitoSans.txt | https://github.com/Fonthausen/NunitoSans                           | The Nunito Sans Project Authors | SIL OFL 1.1 |

## Files in `public/assets/`

Each issue that adds a file adds one line here: path, release file, original name.

| Path                                                 | From                           | Original name                                                        |
| ---------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| `public/assets/audio/void_estate.mp3`                | void_estate.mp3                | Haunting Chiptune Loop [Void Estate]: void_estate.mp3                |
| `public/assets/audio/void_estate_haunted_arcade.mp3` | void_estate_haunted_arcade.mp3 | Haunting Chiptune Loop [Void Estate]: void_estate_haunted_arcade.mp3 |
| `public/assets/fonts/Fraunces-latin.woff2`           | Fraunces-latin.woff2           | Fraunces (Latin subset)                                              |
| `public/assets/fonts/NunitoSans-latin.woff2`         | NunitoSans-latin.woff2         | NunitoSans (Latin subset)                                            |
| `public/assets/fonts/OFL-Fraunces.txt`               | OFL-Fraunces.txt               | OFL.txt (licence file)                                               |
| `public/assets/fonts/OFL-NunitoSans.txt`             | OFL-NunitoSans.txt             | OFL.txt (licence file)                                               |
| `public/assets/models/License-Kenney.txt`            | kenney_graveyard-kit.zip       | License.txt                                                          |
| `public/assets/models/Textures/colormap.png`         | kenney_graveyard-kit.zip       | Models/GLB format/Textures/colormap.png                              |
| `public/assets/models/bench.glb`                     | kenney_graveyard-kit.zip       | Models/GLB format/bench.glb                                          |
| `public/assets/models/candle-multiple.glb`           | kenney_graveyard-kit.zip       | Models/GLB format/candle-multiple.glb                                |
| `public/assets/models/candle.glb`                    | kenney_graveyard-kit.zip       | Models/GLB format/candle.glb                                         |
| `public/assets/models/character-zombie.glb`          | kenney_graveyard-kit.zip       | Models/GLB format/character-zombie.glb                               |
| `public/assets/models/cross.glb`                     | kenney_graveyard-kit.zip       | Models/GLB format/cross.glb                                          |
| `public/assets/models/crypt-large-door.glb`          | kenney_graveyard-kit.zip       | Models/GLB format/crypt-large-door.glb                               |
| `public/assets/models/crypt-large-roof.glb`          | kenney_graveyard-kit.zip       | Models/GLB format/crypt-large-roof.glb                               |
| `public/assets/models/crypt-large.glb`               | kenney_graveyard-kit.zip       | Models/GLB format/crypt-large.glb                                    |
| `public/assets/models/fence.glb`                     | kenney_graveyard-kit.zip       | Models/GLB format/fence.glb                                          |
| `public/assets/models/grave-border.glb`              | kenney_graveyard-kit.zip       | Models/GLB format/grave-border.glb                                   |
| `public/assets/models/grave.glb`                     | kenney_graveyard-kit.zip       | Models/GLB format/grave.glb                                          |
| `public/assets/models/gravestone-bevel.glb`          | kenney_graveyard-kit.zip       | Models/GLB format/gravestone-bevel.glb                               |
| `public/assets/models/gravestone-broken.glb`         | kenney_graveyard-kit.zip       | Models/GLB format/gravestone-broken.glb                              |
| `public/assets/models/gravestone-cross.glb`          | kenney_graveyard-kit.zip       | Models/GLB format/gravestone-cross.glb                               |
| `public/assets/models/gravestone-decorative.glb`     | kenney_graveyard-kit.zip       | Models/GLB format/gravestone-decorative.glb                          |
| `public/assets/models/gravestone-round.glb`          | kenney_graveyard-kit.zip       | Models/GLB format/gravestone-round.glb                               |
| `public/assets/models/gravestone-wide.glb`           | kenney_graveyard-kit.zip       | Models/GLB format/gravestone-wide.glb                                |
| `public/assets/models/iron-fence-border-column.glb`  | kenney_graveyard-kit.zip       | Models/GLB format/iron-fence-border-column.glb                       |
| `public/assets/models/iron-fence-border-gate.glb`    | kenney_graveyard-kit.zip       | Models/GLB format/iron-fence-border-gate.glb                         |
| `public/assets/models/iron-fence.glb`                | kenney_graveyard-kit.zip       | Models/GLB format/iron-fence.glb                                     |
| `public/assets/models/lantern-candle.glb`            | kenney_graveyard-kit.zip       | Models/GLB format/lantern-candle.glb                                 |
| `public/assets/models/lightpost-single.glb`          | kenney_graveyard-kit.zip       | Models/GLB format/lightpost-single.glb                               |
| `public/assets/models/pine-crooked.glb`              | kenney_graveyard-kit.zip       | Models/GLB format/pine-crooked.glb                                   |
| `public/assets/models/pine-fall.glb`                 | kenney_graveyard-kit.zip       | Models/GLB format/pine-fall.glb                                      |
| `public/assets/models/pine.glb`                      | kenney_graveyard-kit.zip       | Models/GLB format/pine.glb                                           |
| `public/assets/models/pumpkin-carved.glb`            | kenney_graveyard-kit.zip       | Models/GLB format/pumpkin-carved.glb                                 |
| `public/assets/models/rocks.glb`                     | kenney_graveyard-kit.zip       | Models/GLB format/rocks.glb                                          |
| `public/assets/models/stone-wall-column.glb`         | kenney_graveyard-kit.zip       | Models/GLB format/stone-wall-column.glb                              |
| `public/assets/models/stone-wall.glb`                | kenney_graveyard-kit.zip       | Models/GLB format/stone-wall.glb                                     |
| `public/assets/models/trunk.glb`                     | kenney_graveyard-kit.zip       | Models/GLB format/trunk.glb                                          |
