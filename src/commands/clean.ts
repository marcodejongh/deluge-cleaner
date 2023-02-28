import { ConfigInterface } from "../ConfigInterface.js";
import { DelugeManager } from "../filemanagers/deluge/index.js";
import inquirer from "inquirer";
import bytes from "bytes";

export const clean = async (config: ConfigInterface) => {
  const delugeManager = new DelugeManager(config.fileManagers.deluge);
  // delugeManager.scan();
  const prompt = inquirer.createPromptModule();

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
    // TODO: To be implemented
    //   {
    //     name: "torrentConditionsAndOrOr",
    //     type: "list",
    //     choices: [
    //         {
    //             name: 'OR',
    //             value: 'OR'
    //         },
    //         {
    //             name: 'AND',
    //             value: 'AND'
    //         }
    //     ],
    //     default: 'OR',
    //     message: "Are the 2 torrent conditions AND or OR?",
    //   },
  ]);

  const removables = await delugeManager.getFilesReadyForCleaning({
    seedratio: answers["seedratio"],
    minAge: answers["mineageinweeks"],
  });

  const totalCleaned = removables.reduce((a, { size: b }) => a + b, 0);
  console.table([
    ...removables.map((item) => ({ name: item.name, size: bytes.format(item.size, { unit: "GB" }) })),
    { name: "Total saved", size: bytes.format(totalCleaned, { unit: "GB" }) },
  ]);

  const finalConfirm = await prompt([
    {
      name: "confirm",
      type: "confirm",
      message: "Proceeding will delete the torrent files + data for the above printed torrents. Are you sure?",
    },
  ]);

  if (finalConfirm.confirm) {
    delugeManager.cleanup(removables);
  }
};
