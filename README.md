# Deluge cleaner

Simple node script for removing torrents in deluge based on age and seed ratio. 
Built with the assumption it's cleaning up torrents added by Sonarr & Radarr.
So it assumes "sonarr-imported" & "radarr-imported" flags are being added.
Shouldn't be hard to put that behind another prompt just havent felt the need to for myself personally. 
But happy to accept PR's.

# Setup

For the above mentioned usecase this tool already works quite well.
To use it first check out this repo and install dependencies:

```sh
git clone https://github.com/marcodejongh/deluge-cleaner.git
nvm use
yarn
```

then add a .delugecleanerrc file:

```json
{
  "deluge": {
    "baseUrl": "delugeEndpoint",
    "password": "password",
  }
}
```

OR just pass that config in as flags:

```
 NODE_OPTIONS="--loader ts-node/esm" node src/cli.ts clean --delugeUrl delugeEndpoint --delugePassword password
```

OR if you've recently gotten obsessed with not littering api keys everywhere and you use 1Password. Use 1password CLI to store the secrets and run: 

```
node --loader ts-node/esm src/cli.ts clean --delugeUrl $(op read op://dev/deluge/website) --delugePassword $( op read op://dev/deluge/password)
```

Where the dev vault is where the deluge secrets are stored.

Then to clean up run:

```
 NODE_OPTIONS="--loader ts-node/esm" node src/cli.ts clean
```

The clean tool is interactive and asks for final confirmation at the end.
Once confirmed, the tool will use Deluge's rest api for removing torrents + data to perform the cleanup.

## Library cleanup

For media library cleanup use: https://github.com/ngovil21/Plex-Cleaner
