/**
 * Path utilities for the application
 */

import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../../');

// Support environment variable for data directory in Docker
const DATA_DIR = process.env.DATA_DIR || path.join(projectRoot, 'data');

/**
 * Get the absolute path to the data directory
 */
export function getDataDirectory(subpath?: string): string {
  if (subpath) {
    return path.join(DATA_DIR, subpath);
  }
  return DATA_DIR;
}

/**
 * Get the absolute path to a file in the data directory
 */
export function getDataFilePath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

export { projectRoot };