import { ConfigInterface } from "../ConfigInterface.js";
import { DelugeManager } from "../filemanagers/deluge/index.js";

export const scan = async (config: ConfigInterface) => {
  const delugeManager = new DelugeManager(config.fileManagers.deluge);
  delugeManager.scan();
};
