# Deluge cleaner

Work in progress for cleaning up deluge torrents.
# Setup

For the above mentioned usecase this tool already works quite well.
To use it first check out this repo and install dependencies:

```sh
git clone https://github.com/marcodejongh/deluge-cleaner.git
nvm use
yarn
```

then add a .seedboxcleanerrc file:

```json
{
  "deluge": {
    "baseUrl": "delugeEndpoint",
    "password": "password",
    "timeout": 60000
  }
}
```

Then to clean up run:

```
 NODE_OPTIONS="--loader ts-node/esm" node --inspect-brk src/cli.ts clean
```

The clean tool is interactive and asks for final confirmation at the end.
Once confirmed, the tool will use Deluge's rest api for removing torrents + data to perform the cleanup.

## Library cleanup

For media library cleanup use: https://github.com/ngovil21/Plex-Cleaner