export interface Tap {
  id: string;
  plugin: "brew";
  kind: "tap";
}
export interface Formula {
  id: string;
  plugin: "brew";
  kind: "formula";
}
export interface Cask {
  id: string;
  plugin: "brew";
  kind: "cask";
}

export type BrewItem = Tap | Formula | Cask;
