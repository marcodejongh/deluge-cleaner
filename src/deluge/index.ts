import { Deluge } from "@ctrl/deluge";
import { differenceInCalendarWeeks } from "date-fns";
import { oraPromise } from "ora";
import chalk from "chalk";
import { NormalizedTorrent } from "./copied-internal-interfaces.js";

export const SONARR_IMPORTED_LABEL = "sonarr-imported";
export const RADARR_IMPORTED_LABEL = "radarr-imported";

export interface DelugeConfig {
  baseUrl: string;
  password: string;
  timeout?: number;
}

export type CleaningOptions = {
  hrPrevention: boolean;
  seedratio: number;
  minAge: number;
  onlyRarTorrents: boolean;
};

export type RemovableItemList = Array<RemovableItem>;
export type RemovableItemId = string;
export type RemovableItem = NormalizedTorrent & {
  isRarFileTorrent: boolean | null;
};

export class DelugeManager {
  client: Deluge;

  constructor({ baseUrl, password, timeout = 60000 }: DelugeConfig) {
    this.client = new Deluge({
      baseUrl,
      password,
      timeout,
    });
  }
  async isRarFileTorrent(id: string, name: string): Promise<boolean> {
    const client = this.client;

    const files = await client.getTorrentFiles(id);
    const fileList = (files.result as any).contents[name] as any;
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

  _torrentHasRequiredLabels(label: string = "") {
    return label.length > 0 && (label === SONARR_IMPORTED_LABEL || label === RADARR_IMPORTED_LABEL);
  }

  _torrentSeedratioAndAgeFilter(hrPrevention: boolean, minAge: number, seedratio: number, torrent: NormalizedTorrent) {
    if (hrPrevention) {
      return this._torrentHasMinimumAge(torrent.dateAdded, minAge) || torrent.ratio >= seedratio;
    } else {
      return this._torrentHasMinimumAge(torrent.dateAdded, minAge) && torrent.ratio >= seedratio;
    }
  }

  async getFilesReadyForCleaning({
    hrPrevention = true,
    seedratio = 2,
    minAge = 3,
    onlyRarTorrents = false,
  }: CleaningOptions): Promise<RemovableItemList> {
    const client = this.client;

    //TODO: Should probably change this to listTorrents and pass in the appropiate filter
    const allDataRequestPromise = client.getAllData();

    oraPromise(allDataRequestPromise, { text: "Fetching all torrents" });

    const allDataRequest = await allDataRequestPromise;

    const torrents: RemovableItemList = allDataRequest.torrents
      .filter(
        (torrent) =>
          torrent.state === "seeding" &&
          this._torrentHasRequiredLabels(torrent.label) &&
          //TODO: DateAdded is not the same as seeding date, but for me it usually will be pretty close
          // Should figure out how to get the real seed date here.
          this._torrentSeedratioAndAgeFilter(hrPrevention, minAge, seedratio, torrent)
      )
      .map((torrent) => ({
        ...torrent,
        isRarFileTorrent: null,
      }));

    const promises = [];
    for (const torrent of torrents) {
      // Bit yucky, but this makes all the isRarFileTorrents requests run in parallel.
      // Haven't gotten rate limited yet, but it might at some point
      promises.push(
        this.isRarFileTorrent(torrent.id, torrent.name).then(
          (isRarFileTorrent) => (torrent.isRarFileTorrent = isRarFileTorrent)
        )
      );
    }

    const allRarTorrentsPromise = Promise.all(promises);
    oraPromise(allRarTorrentsPromise, {
      text: `Fetching file information for ${chalk.bold(torrents.length)} torrents`,
    });
    await allRarTorrentsPromise;

    if (!onlyRarTorrents) {
      return torrents;
    }

    return torrents.filter((torrent) => torrent.isRarFileTorrent);
  }

  async cleanup(removableItems: RemovableItemList) {
    const allPromises = Promise.all(removableItems.map((torrent) => this._cleanupInternal(torrent.id)));

    oraPromise(allPromises, { text: `Removing selected torrents` });
    await allPromises;
  }

  _cleanupInternal(id: string) {
    return this.client.removeTorrent(id, true);
  }
}
