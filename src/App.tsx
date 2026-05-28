/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import AppLayout from './components/layout/AppLayout';
import { useTheme } from './hooks/useTheme';

export default function App() {
  useTheme(); // Triggers modern theme bindings on root html element

  return <AppLayout />;
}
