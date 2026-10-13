import { Outlet } from 'react-router'
import { NotificationInterestProvider } from '../public-housing/interest/NotificationInterest'
import { NotificationInboxProvider } from './NotificationInboxProvider'
export function PublicNotificationLayout() {
  return <NotificationInterestProvider><NotificationInboxProvider><Outlet /></NotificationInboxProvider></NotificationInterestProvider>
}
