import type { Dict } from '../i18n';
import { card } from '../ui';

const ICON_ALERTS = '🔔';

export function alertsCard(dict: Dict): string {
  return card({
    icon: ICON_ALERTS,
    title: dict.alerts.title,
    body: [dict.alerts.intro],
    footer: dict.alerts.footer,
  });
}
