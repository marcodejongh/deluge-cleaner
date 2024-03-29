import { ConfigInterface } from "../ConfigInterface.js";
import { DelugeManager, RADARR_IMPORTED_LABEL, SONARR_IMPORTED_LABEL } from "../deluge/index.js";
import inquirer from "inquirer";
import bytes from "bytes";
import chalk from "chalk";

export interface CleanConfig {
  password: string;
  baseUrl: string;
  timeout: number;
}
export const clean = async (config: CleanConfig) => {
  const delugeManager = new DelugeManager(config);
  // delugeManager.scan();
  const prompt = inquirer.createPromptModule();

  console.info(
    chalk.green(
      `This tool will only cleanup torrents with labels: ${SONARR_IMPORTED_LABEL} or ${RADARR_IMPORTED_LABEL}`
    )
  );
  console.info(
    chalk.green(`Make sure to change config of Radarr and Sonarr respectively to add this labels after import`)
  );

  console.info(
    `\nBy default we assume we want to only delete torrents that satisfy minage & seed requirements for private trackers.`
  );

  console.info(
    `${chalk.bold(
      "This means that if either minimum age OR seed ratio are satisfied, the torrent is eligible for deletion."
    )}`
  );

  console.info(
    `If you wish to instead only delete torrents with the given seed ratio ${chalk.bold("AND")} minimum age`
  );
  console.info(`you have to answer "no" to the first question.\n `);

  interface Answers {
    hrPreventionLogic: boolean;
    seedRatio: string;
    minAgeInWeeks: string;
    onlyRarTorrents: boolean;
  }
  const filterPrompt: Answers = await prompt([
    {
      name: "hrPreventionLogic",
      type: "confirm",
      default: true,
      message: "Use filtering to prevent torrent Hit & Run warnings?",
    },
    {
      name: "seedRatio",
      type: "input",
      default: "1",
      // TODO: Fix my english in this message
      message: "Whats the minimum seed ratio before removal?",
    },
    {
      name: "minAgeInWeeks",
      type: "input",
      default: "3",
      message: "Minimum torrent age in weeks?",
    },
    {
      name: "onlyRarTorrents",
      type: "confirm",
      default: false,
      message:
        "Only look for RarTorrents? If using hardlinks with the *Arr apps deleting rar file torrents usually frees up space immediately",
    },
  ]);

  const removables = await delugeManager.getFilesReadyForCleaning({
    hrPrevention: filterPrompt["hrPreventionLogic"],
    seedratio: Number(filterPrompt["seedRatio"]),
    minAge: Number(filterPrompt["minAgeInWeeks"]),
    onlyRarTorrents: filterPrompt["onlyRarTorrents"],
  });

  const fileSelectionPrompt = await prompt([
    {
      name: "files",
      type: "checkbox",
      choices: removables.map((item) => {
        return {
          name: `${chalk.bold(item.name)} ${item.isRarFileTorrent ? chalk.bold("compressed ") : ""}size: ${chalk.bold(
            bytes.format(item.totalDownloaded, {
              unit: "GB",
            })
          )} ratio: ${chalk.bold(Math.round((item.ratio + Number.EPSILON) * 100) / 100)} tracker: ${chalk.bold(
            item.raw.tracker_host
          )}`,
          value: item.id,
          checked: true,
        };
      }),
    },
  ]);

  const removablesAfterUserFilter = removables.filter((item) => fileSelectionPrompt.files.includes(item.id));
  removablesAfterUserFilter.sort((a, b) => a.name.localeCompare(b.name));
  if (removables.length === 0) {
    console.log(chalk.red(`Nothing to cleanup based on the current criteria`));
    return;
  }

  const totalCleaned = removablesAfterUserFilter.reduce((a, { totalDownloaded: b }) => a + b, 0);
  console.table([
    ...removablesAfterUserFilter.map((item) => ({
      name: item.name,
      isRarFileTorrent: item.isRarFileTorrent,
      ratio: Math.round((item.ratio + Number.EPSILON) * 100) / 100,
      size: bytes.format(item.totalDownloaded, { unit: "GB" }),
      tracker: item.raw.tracker_host,
    })),
    { name: "Total saved", size: bytes.format(totalCleaned, { unit: "GB" }) },
  ]);

  const finalConfirm = await prompt([
    {
      name: "confirm",
      type: "confirm",
      message: chalk.red(
        "Proceeding will delete the torrent files + data for the above printed torrents. Are you sure?"
      ),
    },
  ]);

  if (finalConfirm.confirm) {
    await delugeManager.cleanup(removablesAfterUserFilter);
  }
};
