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
  
  console.info(chalk.green(`This tool will only cleanup torrents with labels: ${SONARR_IMPORTED_LABEL} or ${RADARR_IMPORTED_LABEL}`));
  console.info(chalk.green(`Make sure to change config of Radarr and Sonarr respectively to add this labels after import`));
  
  const answers = await prompt([
    {
      name: "seedratio",
      type: "input",
      default: "1",
      // TODO: Fix my english in this message
      message: "Whats the minimum seed ratio before removal?",
    },
    {
      name: "minageinweeks",
      type: "input",
      default: "3",
      message: "Minimum torrent age in weeks?",
    },
  ]);

  const removables = await delugeManager.getFilesReadyForCleaning({
    seedratio: answers["seedratio"],
    minAge: answers["mineageinweeks"],
  });

  removables.sort((a, b) => a.name.localeCompare(b.name));
  if (removables.length === 0) {
    console.log(chalk.red(`Nothing to cleanup based on the current criteria`));
    return;
  }
  
  const totalCleaned = removables.reduce((a, { size: b }) => a + b, 0);
  console.table([
    ...removables.map((item) => ({ name: item.name, size: bytes.format(item.size, { unit: "GB" }) })),
    { name: "Total saved", size: bytes.format(totalCleaned, { unit: "GB" }) },
  ]);

  const finalConfirm = await prompt([
    {
      name: "confirm",
      type: "confirm",
      message: chalk.red("Proceeding will delete the torrent files + data for the above printed torrents. Are you sure?"),
    },
  ]);

  if (finalConfirm.confirm) {
    delugeManager.cleanup(removables);
  }
};
