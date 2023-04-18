/* 
This file has copied over type defitions from @ctrl/deluge.
TODO: submit a PR to expose them. Don't add anything here that isn't copy pasted
*/

export declare enum TorrentState {
    downloading = "downloading",
    seeding = "seeding",
    paused = "paused",
    queued = "queued",
    checking = "checking",
    warning = "warning",
    error = "error",
    unknown = "unknown"
}

export interface NormalizedTorrent {
    /**
     * torrent hash id
     */
    id: string;
    /**
     * torrent name
     */
    name: string;
    /**
     * progress percent out of 100
     */
    progress: number;
    isCompleted: boolean;
    /**
     * 1:1 is 1, half seeded is 0.5
     */
    ratio: number;
    /**
     * date as iso string
     */
    dateAdded: string;
    /**
     * date completed as iso string;
     */
    dateCompleted?: string;
    savePath: string;
    /**
     * Sometimes called "Category", other times called label
     */
    label?: string;
    /**
     * Note that this is different from label
     */
    tags?: string[];
    state: TorrentState;
    stateMessage: string;
    /**
     * bytes per second
     */
    uploadSpeed: number;
    /**
     * bytes per second
     */
    downloadSpeed: number;
    /**
     * seconds until finish
     */
    eta: number;
    queuePosition: number;
    connectedSeeds: number;
    connectedPeers: number;
    totalSeeds: number;
    totalPeers: number;
    /**
     * size of files to download in bytes
     */
    totalSelected: number;
    /**
     * total size of the torrent, in bytes
     */
    totalSize: number;
    /**
     * total upload in bytes
     */
    totalUploaded: number;
    /**
     * total download in bytes
     */
    totalDownloaded: number;
    /**
     * Raw data returned by client
     */
    raw: any;
}