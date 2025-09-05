import { createConsola } from "consola";

// Centralized logger (no timestamps, colorized, compact)
export const logger = createConsola({ formatOptions: { date: false, colors: true, compact: true } });

export default logger;
