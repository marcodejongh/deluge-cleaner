# SeedboxCleaner

Work in progress for cleaning up a seedbox.
Currently only cleans up deluge torrents (+ data) that are tarballs and therefore duplicate their data (since they are auto-extracted).
In the future might also add support for deleting content that has been watched in plex/whatever.

# Setup

For the above mentioned usecase this tool already works quite well.
To use it first check out this repo and install dependencies:

```sh
git clone https://github.com/marcodejongh/SeedboxCleaner.git
nvm use
yarn
```

then add a .seedboxcleanerrc file:

```json
{
  "fileManagers": {
    "deluge": {
      "baseUrl": "delugeEndpoint",
      "password": "password",
      "timeout": 60000
    }
  }
}
```

Now first mark all your deluge files with the appropiate meta data:

```
 NODE_OPTIONS="--loader ts-node/esm" node --inspect-brk src/cli.ts scan
```

This will take a wile but it will give every torrent in the setup deluge instance a label based on whether its a tarball or not.

Then to clean up run:

```
 NODE_OPTIONS="--loader ts-node/esm" node --inspect-brk src/cli.ts clean
```

The clean tool is interactive and asks for final confirmation at the end.
Once confirmed, the tool will use Deluge's rest api for removing torrents + data to perform the cleanup.

# TODO:

- Labelling
  - Add appropiate tarball label after filebot/rename/extraction script runs making "scan" mostly obselete
- Clean
  - Radarr support
  - Sonarr support
  - ^^ Using plex as datasource for deciding what can be cleaned up.
- Radarr/Sonarr - Follow symlinks on delete (since my box symlinks everything)
- clean-auto
  - just execute clean based on config
    - Seed ration
    - age
    - etc
