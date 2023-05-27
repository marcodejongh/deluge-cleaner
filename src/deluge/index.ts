import { Deluge, Torrent, TorrentStatus } from "@ctrl/deluge";
import { differenceInCalendarWeeks } from "date-fns";
import { oraPromise } from "ora";
import chalk from "chalk";
import { AllClientData, NormalizedTorrent } from "./copied-internal-interfaces.js";
import { TrackerRule, TrackerRules } from "../ConfigInterface.js";

export const SONARR_IMPORTED_LABEL = "sonarr-imported";
export const RADARR_IMPORTED_LABEL = "radarr-imported";

export interface DelugeConfig {
  baseUrl: string;
  password: string;
  timeout?: number;
  trackerRules: TrackerRules;
}

export type CleaningOptions = {
  labels: string[];
};

export type RemovableItemList = Array<RemovableItem>;
export type RemovableItemId = string;
export type RemovableItem = NormalizedTorrent & {
  isRarFileTorrent: boolean | null;
  hasTorrentSatisifiedHnr: boolean | null;
  isStuck: boolean | null;
};

export type DelugeLabels = {
  id: string;
  name: string;
  count: number;
};

export class DelugeManager {
  client: Deluge;
  allDataRequestPromise: Promise<AllClientData>;
  trackerRules: TrackerRules;

  constructor({ baseUrl, password, timeout = 60000, trackerRules }: DelugeConfig) {
    //TODO: Should probably change this to listTorrents and pass in the appropiate filter
    this.client = new Deluge({
      baseUrl,
      password,
      timeout,
    });
    this.allDataRequestPromise = this.client.getAllData();
    this.trackerRules = trackerRules;
  }

  async getLabels(): Promise<DelugeLabels[]> {
    const allData = await this.allDataRequestPromise;
    return allData.labels;
  }

  async isRarFileTorrent(id: string, name: string, trackerRule: TrackerRule | undefined): Promise<boolean> {
    const client = this.client;

    if (trackerRule && !trackerRule.allowsRars) {
      return false;
    }

    const files = await client.getTorrentFiles(id);
    const resultContents = Object.values(files.result.contents);
    if (resultContents.length > 1) {
      throw new Error("Unexpected error, found more then 1 torrent contents result");
    }
    const fileList = resultContents[0];
    let isRarFileTorrent = false;
    try {
      isRarFileTorrent =
        fileList.type !== "file" && Object.keys(fileList.contents).some((file: any) => file.endsWith("rar"));
    } catch (err) {
      console.error(err);
    }

    return isRarFileTorrent;
  }

  _torrentHasMinimumAge(dateAdded: string, minAge: number): boolean {
    return differenceInCalendarWeeks(new Date(), new Date(dateAdded)) >= minAge;
  }

  _torrentHasRequiredLabels(label: string = "", labels: string[]) {
    return labels.length === 0 || labels.includes(label);
  }

  _torrentSeedratioAndAgeFilter(minAge: number, seedratio: number, torrent: NormalizedTorrent) {
    return this._torrentHasMinimumAge(torrent.dateAdded, minAge) || torrent.ratio >= seedratio;
  }

  async getFilesReadyForCleaning({ labels = [] }: CleaningOptions): Promise<RemovableItemList> {
    const allData = await this.allDataRequestPromise;

    const torrents: RemovableItemList = allData.torrents
      .filter((torrent) => this._torrentHasRequiredLabels(torrent.label, labels))
      .map((torrent) => ({
        ...torrent,
        isRarFileTorrent: null,
        hasTorrentSatisifiedHnr: null,
        isStuck: null,
      }));

    const promises = [];

    for (const torrent of torrents) {
      const trackerRule = this.trackerRules.find((trackerRule) => trackerRule.hosts.includes(torrent.raw.tracker_host));

      // Bit yucky, but this makes all the isRarFileTorrents requests run in parallel.
      // Haven't gotten rate limited yet, but it might at some point
      promises.push(
        this.isRarFileTorrent(torrent.id, torrent.name, trackerRule).then(
          (isRarFileTorrent) => (torrent.isRarFileTorrent = isRarFileTorrent)
        )
      );
      promises.push(
        this.client.getTorrentStatus(torrent.id).then((torrentStatus) => {
          torrent.isStuck = this.isTorrentStuck(torrentStatus, trackerRule);
          torrent.hasTorrentSatisifiedHnr = this.hasTorrentSatisifiedHnr(
            torrentStatus.result["seeding_time"],
            torrentStatus.result.ratio,
            trackerRule
          );
        })
      );
    }

    const allRarTorrentsPromise = Promise.all(promises);
    oraPromise(allRarTorrentsPromise, {
      text: `Fetching file information & torrent status for ${chalk.bold(torrents.length)} torrents`,
    });

    await allRarTorrentsPromise;

    return torrents;
  }

  isTorrentStuck(torrentStatus: TorrentStatus, trackerRule: TrackerRule | undefined): any {
    // TODO: Add more checks here
    return (
      torrentStatus.result.state === "Downloading" &&
      torrentStatus.result.total_done === 0 &&
      (torrentStatus.result.tracker_status.startsWith("Error: VIP Access Required") ||
        (torrentStatus.result.tracker_status.startsWith("Error: skipping tracker announce (unreachable)") &&
          torrentStatus.result.num_seeds === 0))
    );
  }

  async cleanup(removableItems: RemovableItemList) {
    const allPromises = Promise.all(removableItems.map((torrent) => this._cleanupInternal(torrent.id)));

    oraPromise(allPromises, { text: `Removing selected torrents` });
    await allPromises;
  }

  _cleanupInternal(id: string) {
    return this.client.removeTorrent(id, true);
  }

  hasTorrentSatisifiedHnr(
    torrentSeedTime: number,
    torrentRatio: number,
    trackerRule: TrackerRule | undefined
  ): boolean {
    const hnrRules = trackerRule?.hnrRules;

    if (!hnrRules) {
      return false;
    }

    const { ratio = Infinity, seedTimeInHours = Infinity } = hnrRules;

    if (seedTimeInHours === Infinity && ratio === Infinity) {
      throw new Error(`Tracker rule for ${trackerRule.name} has no defined rules`);
    }

    const torrentSeedTimeInHours = torrentSeedTime / 3600;

    if (hnrRules.condition === "OR") {
      return ratio < torrentRatio || seedTimeInHours < torrentSeedTimeInHours;
    } else {
      console.warn("Haven't tested the AND condition for HNR rules yet, use at own risk");
      if (ratio === Infinity) {
        return seedTimeInHours < torrentSeedTimeInHours;
      } else if (seedTimeInHours === Infinity) {
        return ratio < torrentRatio;
      } else {
        return ratio < torrentRatio && seedTimeInHours < torrentSeedTimeInHours;
      }
    }
  }
}
