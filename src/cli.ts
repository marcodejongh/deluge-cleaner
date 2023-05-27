#!/usr/bin/env node
import meow from "meow";
import { cosmiconfig } from "cosmiconfig";
import { ConfigInterface } from "./ConfigInterface.js";
import { clean, CleanConfig } from "./commands/clean.js";

enum Commands {
  scan = "scan",
  clean = "clean",
}

const main = async (command: string, flags: any) => {
  const explorer = cosmiconfig("delugecleaner");
  const config: ConfigInterface = (await explorer.search())?.config || { password: null, baseUrl: null };

  if (!config) {
    console.error("Couldn't find config");
    process.exit(1);
  }

  const cleanConfig: CleanConfig = {
    password: flags.delugePassword || config.deluge.password,
    baseUrl: flags.delugeUrl || config.deluge.baseUrl,
    timeout: flags.timeout,
    trackerRules: config.trackerrules || [],
  };

  switch (command) {
    case Commands.clean:
      clean(cleanConfig);
      break;
    default:
      console.error(`Command ${command} not supported`);
      process.exit(1);
  }
};

const cli = meow(
  `
	Usage
	  $ delugecleaner <command>
    Command
        clean   Wizard for cleaning up files, requires scan to have  beeen completed successfully before
	Options
    delugeUrl      The url for deluge to use, overrides .delugecleanerrc config file
    delugePassword The password to use for deluge, .delugecleanerrc config file
    timeout        The timeout to use for requests to deluge, default is 60000

	Examples
	  $ delugecleaner clean
	  🌈 unicorns 🌈
`,
  {
    importMeta: import.meta,
    flags: {
      delugeUrl: {
        type: "string",
        isRequired: false,
      },
      delugePassword: {
        type: "string",
        isRequired: false,
      },
      timeout: {
        type: "number",
        default: 60000,
      },
    },
  }
);

main(cli.input[0], cli.flags);
