/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Theme = 'light' | 'dark' | 'system';

export type ActiveTab = 'html' | 'css' | 'javascript';

export interface ConsoleEntry {
  id: string;
  type: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
}
