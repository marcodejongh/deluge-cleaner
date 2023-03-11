import { Deluge } from "@ctrl/deluge";
import { differenceInCalendarWeeks } from "date-fns";
import { getAllDataResult } from "./mocks/getAllData.js";

const SONARR_IMPORTED_LABEL = "sonarr-imported";
const RADARR_IMPORTED_LABEL = "radarr-imported";

export interface DelugeConfig {
  baseUrl: string;
  password: string;
  timeout?: number;
}

export type CleaningOptions = {
  seedratio: number;
  minAge: number;
};

export type RemovableItemList = Array<RemovableItem>;
export type RemovableItemId = string;
export type RemovableItem = {
  id: RemovableItemId;
  name: string;
  // Size in bytes
  size: number;
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
  /*
        Marks all the torrents in Deluge with tarball or not tarball labels.
        When deciding what to remove in the clean action we use the tarball label only.

        Using a seperate scan command because the getAllData endpoint doesnt return the file contents of a torrent.
        So if we wanted to do this as part of the clean command it would be slow (and it's already quite slow)
    */
  async scan() {
    const client = this.client;

    const res = await client.getAllData();

    const removables = res.torrents.filter(
      (torrent) =>
        torrent.state === "seeding" &&
        (!torrent.label || (torrent.label.includes(SONARR_IMPORTED_LABEL) || !torrent.label.includes(RADARR_IMPORTED_LABEL)))
    );

    for (const removable of removables) {
      const files = await client.getTorrentFiles(removable.id);
      const fileList = (files.result as any).contents[removable.name] as any;
      try {
        const isTarball =
          fileList.type !== "file" && Object.keys(fileList.contents).some((file: any) => file.endsWith("rar"));

        console.log(`Adding label to ${removable.name}`);
      } catch (err) {
        console.error(err);
      }
    }
  }

  async getFilesReadyForCleaning({ seedratio = 2, minAge = 3 }: CleaningOptions): Promise<RemovableItemList> {
    const client = this.client;

    //TODO: Should probably change this to listTorrents and pass in the appropiate filter
    const res = await client.getAllData();

    return res.torrents
      .filter(
        (torrent) =>
          torrent.state === "seeding" &&
          (!torrent.label || (torrent.label.includes(SONARR_IMPORTED_LABEL) || torrent.label.includes(RADARR_IMPORTED_LABEL))) &&
          //TODO: DateAdded is not the same as seeding date, but for me it usually will be pretty close
          // Should figure out how to get the real seed date here.
          (differenceInCalendarWeeks(new Date(), new Date(torrent.dateAdded)) >= minAge || torrent.ratio >= seedratio)
      )
      .map(({ id, name, totalDownloaded }) => ({
        id,
        name,
        // totalSize returned by deluge is for whatever reason undefined
        size: totalDownloaded,
      }));
  }

  async cleanup(removableItems: RemovableItemList) {
    const client = this.client;

    for (const removableItem of removableItems) {
      console.log(`Removing ${removableItem.name}`);
      await client.removeTorrent(removableItem.id, true);
    }
  }
}
