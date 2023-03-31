# Deluge cleaner

Simple node script for removing torrents(+ data) in deluge based on age and seed ratio. 
Built with the assumption it's cleaning up torrents added by Sonarr & Radarr.
So it assumes "sonarr-imported" & "radarr-imported" flags are being added.
Shouldn't be hard to put that behind another prompt just havent felt the need to for myself personally. 
But happy to accept PR's.

# Starr apps / deluge setup
1. Setup Extractor+ in deluge to extract into the torrents directory and to delete extracted files after ~3 days.
2. Setup Starr apps to use hardlinks on import and add a "sonarr-imported" or "radarr-imported" label to deluge on import.
3. Setup Starr apps to stop monitoring when a delete is detected
4. Now you can let Starr apps and Deluge manage their respective parts. 
5. With this setup removing torrents from deluge should not result in the media library shrinking.
6. If disk space is required, start by cleaning up deluge torrents with high age and or ratio using this tool
7. If more is required run the tools in https://github.com/ngovil21/Plex-Cleaner to remove stuf
8. With this setup the remove controls in Plex can also be used for freeing up disk space. 

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
