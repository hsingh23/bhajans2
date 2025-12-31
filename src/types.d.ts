export {};

declare global {
  interface Window {
    ga: any;
    _urq: any[];
    setGAUid: boolean;
    fetchedBhajans: any[];
    searchableBhajans: string[];
    searchFilter: string;
    scrollTop: number;
    dbHistory: any;
    firebase: any;
  }
}
