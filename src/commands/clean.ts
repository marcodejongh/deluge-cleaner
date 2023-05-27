import { ConfigInterface, TrackerRule, TrackerRules } from "../ConfigInterface.js";
import { DelugeManager, RADARR_IMPORTED_LABEL, RemovableItem, SONARR_IMPORTED_LABEL } from "../deluge/index.js";
import inquirer from "inquirer";
import bytes from "bytes";
import chalk from "chalk";

export interface CleanConfig {
  password: string;
  baseUrl: string;
  timeout: number;
  trackerRules: TrackerRules;
}

export const clean = async (config: CleanConfig) => {
  /* 
  TODO: Make this whole CLI process non-interactive with flags, so it can be run automatically
  TODO: Add option to pause instead of delete for automated non-interactive mode
  TODO: Add some kind of first in first out logic for deciding what to clean up first
  TODO: Probably we want to clean up popular stuff first? Since that will have enough swarm
  */
  const delugeManager = new DelugeManager(config);
  const labels = await delugeManager.getLabels();
  const prompt = inquirer.createPromptModule();

  const labelSelectionPrompt = await prompt([
    {
      name: "labels",
      type: "checkbox",
      choices: labels.map(({ name, id, count }) => {
        // Deluge no label is ""
        const realName = name.length > 0 ? name : "no-label";

        return {
          name: `${chalk.bold(realName)} ${count}`,
          value: id,
          checked: false,
        };
      }),
    },
  ]);

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
    selectHnrFree: boolean;
    selectRar: boolean;
    selectStuck: boolean;
  }
  const filterPrompt: Answers = await prompt([
    {
      name: "selectHnrFree",
      type: "confirm",
      default: true,
      // TODO: Fix my english in this message
      message: "Preselect torrents that have satisfied the HNR rules for that tracker?",
    },
    {
      name: "selectStuck",
      type: "confirm",
      default: false,
      message: "Select stuck torrents?",
    },
    {
      name: "selectRar",
      type: "confirm",
      default: false,
      message: "Preselect rar file torrents?",
    },
  ]);

  const removables = await delugeManager.getFilesReadyForCleaning({
    labels: labelSelectionPrompt.labels,
  });

  const fileSelectionChoices = removables.map((item) => {
    const trackerRule = config.trackerRules.find((trackerRule) => trackerRule.hosts.includes(item.raw.tracker_host));
    const hasSatisfiedHnr = item.hasTorrentSatisifiedHnr;

    let hnrString = chalk.red("HNR Unsatisfied");
    if (trackerRule === undefined) {
      hnrString = chalk.red("no tracker rule found");
    } else if (hasSatisfiedHnr) {
      hnrString = chalk.green("HNR satisfied");
    }
    let checked = filterPrompt.selectRar
      ? (!filterPrompt.selectHnrFree || hasSatisfiedHnr) && item.isRarFileTorrent
      : filterPrompt.selectHnrFree && hasSatisfiedHnr;

    if (filterPrompt.selectStuck && item.isStuck) {
      checked = true;
    }

    return {
      name: `${chalk.bold(item.name)} ${item.isRarFileTorrent ? chalk.bold("compressed ") : ""}size: ${chalk.bold(
        bytes.format(item.totalDownloaded, {
          unit: "GB",
        })
      )} ratio: ${chalk.bold(Math.round((item.ratio + Number.EPSILON) * 100) / 100)} tracker: ${chalk.bold(
        trackerRule?.name
      )} ${chalk.bold(hnrString)}`,
      value: item.id,
      checked: checked,
    };
  });

  const fileSelectionPrompt = await prompt([
    {
      name: "files",
      type: "checkbox",
      choices: fileSelectionChoices,
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
      HNRSatisfied: item.hasTorrentSatisifiedHnr,
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
