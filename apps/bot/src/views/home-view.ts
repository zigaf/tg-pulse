import { config } from '../config';
import { escapeHtml } from '../format';
import type { Dict, Lang } from '../i18n';
import { langName } from '../i18n';
import { MARK_DONE, MARK_TODO, type OnboardingProgress } from '../menus';
import { card } from '../ui';

const ICON_HOME = '📡';
const ICON_HELP = '❓';
const ICON_LANGUAGE = '🌐';

function step(isDone: boolean, label: string): string {
  return `${isDone ? MARK_DONE : MARK_TODO} ${label}`;
}

/**
 * /start doubles as the onboarding checklist: the three steps are derived from the
 * database, so a returning user sees how far they got instead of a generic pitch.
 */
export function startCard(dict: Dict, progress: OnboardingProgress): string {
  const footer = !progress.hasChannel
    ? dict.start.nextChannel
    : !progress.hasLink
      ? dict.start.nextLink
      : dict.start.ready;

  return card({
    icon: ICON_HOME,
    title: dict.start.title,
    body: [
      dict.start.intro,
      '',
      `<b>${dict.start.setup}</b>`,
      step(true, dict.start.stepStart),
      step(progress.hasChannel, dict.start.stepChannel),
      step(progress.hasLink, dict.start.stepLink),
    ],
    footer,
  });
}

export function helpCard(dict: Dict): string {
  return card({
    icon: ICON_HELP,
    title: dict.help.title,
    body: [
      dict.help.intro,
      '',
      `<b>${dict.help.commandsTitle}</b>`,
      ...dict.help.commands,
      '',
      `<b>${dict.help.faqTitle}</b>`,
      ...dict.help.faq,
    ],
    footer: dict.help.dashboard(config.dashboardUrl),
  });
}

export function languageCard(dict: Dict, current: Lang): string {
  return card({
    icon: ICON_LANGUAGE,
    title: dict.language.title,
    body: [dict.language.intro, dict.language.current(langName(dict, current))],
  });
}

export function languageChangedCard(dict: Dict, current: Lang): string {
  return card({
    icon: ICON_LANGUAGE,
    title: dict.language.title,
    body: [dict.language.changed, dict.language.current(langName(dict, current))],
  });
}

/** Sent in DM the moment the bot becomes an admin somewhere. */
export function channelConnectedCard(dict: Dict, channelTitle: string): string {
  return card({
    icon: ICON_HOME,
    title: dict.start.title,
    body: [dict.onboarding.channelConnected(escapeHtml(channelTitle))],
    footer: dict.onboarding.createFirstLink,
  });
}

/** Shown by every screen that needs a connected channel and does not have one. */
export function noChannelsCard(dict: Dict): string {
  return card({
    icon: ICON_HOME,
    title: dict.empty.channelsTitle,
    body: [dict.empty.channelsBody],
    footer: dict.empty.channelsFooter,
  });
}
