import { DelugeConfig } from "./filemanagers/deluge/index.js";

export interface ConfigInterface {
  fileManagers: {
    deluge: DelugeConfig;
  };
}
