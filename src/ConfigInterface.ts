import { DelugeConfig } from "./deluge/index.js";

/*
"trackerrules": [
    {
      "IPTorrents": {
        "hosts": [
          "bgp.technology",
          "empirehost.me",
          "stackoverflow.tech"
        ],
        "hnr-rules": {
          "condition": "OR",
          "seedTimeInHours": "336",
          "ratio": "1"
        }
      }
    },
*/

export type HnrRules = {
  condition: "OR" | "AND";
  seedTimeInHours?: number;
  ratio?: number;
};

export interface TrackerRule {
  name: string;
  hosts: string[];
  hnrRules: HnrRules;
  allowsRars: boolean;
}

export type TrackerRules = TrackerRule[];

export interface ConfigInterface {
  deluge: DelugeConfig;
  trackerrules: TrackerRules;
}
