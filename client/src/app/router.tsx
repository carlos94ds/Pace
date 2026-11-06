import { createBrowserRouter } from 'react-router';
import { SettingsPage } from '../features/settings/SettingsPage';
import { StatusPage } from '../features/status/StatusPage';
import { AppShell } from './AppShell';
import { NotFoundPage } from './NotFoundPage';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <StatusPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
