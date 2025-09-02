export abstract class Plugin<_T = unknown> {
  // Unique plugin name (e.g. "brew", "shell")
  abstract readonly name: string;
  // Optional lifecycle hook
  prepare?(): Promise<void> | void;
}
