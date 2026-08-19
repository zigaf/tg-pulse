import { percent } from '../format';
import type { FraudReport, FraudSignal, FraudVerdict, SignalKey } from '../fraud';
import type { Dict } from './index';

/**
 * Russian locale. Typed as `Dict`, so a missing or renamed key is a compile error.
 * Terminology: joins = подписки, leaves = отписки, tracking link = трекинг-ссылка,
 * source = источник.
 */

/** Russian count agreement: 1 подписка, 2 подписки, 5 подписок. */
function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

const verdict: Record<FraudVerdict, string> = {
  not_enough_data: 'Данных мало',
  clean: 'Чисто',
  suspicious: 'Подозрительно',
  likely_fraud: 'Похоже на фрод',
};

const signal: Record<SignalKey, string> = {
  burst: 'Приходили всплесками',
  churn24h: 'Отписались за 24 часа',
  churn7d: 'Отписались за 7 дней',
  noUsername: 'Аккаунты без юзернейма',
  noFirstName: 'Аккаунты без имени',
  lowPremium: 'Аккаунты с Telegram Premium',
  conversion: 'Клики, ставшие подписками',
};

const evidence: Record<SignalKey, (s: FraudSignal, r: FraudReport) => string> = {
  burst: (s, r) => `${percent(s.value)} подписок пришли всплесками (окон: ${r.bursts.length})`,
  churn24h: (s) => `${percent(s.value)} отписались за первые 24 часа`,
  churn7d: (s) => `${percent(s.value)} отписались за первую неделю`,
  noUsername: (s) => `у ${percent(s.value)} аккаунтов нет юзернейма`,
  noFirstName: (s) => `у ${percent(s.value)} аккаунтов нет имени`,
  lowPremium: (s) => `только ${percent(s.value)} из них с Telegram Premium`,
  conversion: (s) => `${percent(s.value)} кликов превратились в подписки, это заметно выше обычного посева`,
};

export const ru: Dict = {
  nav: {
    channels: 'Каналы',
    links: 'Ссылки',
    stats: 'Статистика',
    fraud: 'Проверка на фрод',
    alerts: 'Уведомления',
    language: 'Язык',
  },

  buttons: {
    addToChannel: '➕ Добавить в канал',
    createLink: '🔗 Создать трекинг-ссылку',
    myStats: '📊 Моя статистика',
    openDashboard: '🌐 Открыть дашборд',
    createAnother: 'Создать ещё',
    viewStats: 'Статистика',
    cancel: 'Отмена',
    stats: 'Статистика',
    newLink: 'Новая ссылка',
    links: 'Ссылки',
    fraudCheck: 'Проверка на фрод',
    language: '🌐 Язык',
    back: '⟵ Назад',
    close: '✕ Закрыть',
    prevPage: '‹ Пред',
    nextPage: 'След ›',
    english: 'English',
    russian: 'Русский',
  },

  commands: {
    start: 'Что умеет TGPulse и быстрые действия',
    newlink: 'Создать трекинг-ссылку',
    stats: 'Подписки, отписки и источники за 7 дней',
    channels: 'Ваши каналы и ссылки',
    fraud: 'Проверить ссылку посева на ботов',
    notifications: 'Мгновенные уведомления о подписках',
    language: 'Сменить язык бота',
    help: 'Как это работает и частые вопросы',
  },

  common: {
    unknownInput: 'Не понял команду. Что я умею, показывает /help.',
    somethingWrong: 'Что-то пошло не так. Попробуйте ещё раз или загляните в /help.',
    channelUnavailable: 'Этот канал больше недоступен.',
  },

  empty: {
    channelsTitle: 'Каналов пока нет',
    channelsBody: 'Добавьте бота администратором в свой канал. Достаточно права «приглашать по ссылке», больше ничего не нужно.',
    channelsFooter: 'После подключения канала команда /newlink создаст первую трекинг-ссылку.',
  },

  start: {
    title: 'TGPulse',
    intro: 'TGPulse показывает, откуда именно приходят подписчики. Отдельная ссылка на каждое размещение, и каждая подписка привязана к своему источнику.',
    setup: 'Подключение',
    stepStart: 'Бот запущен',
    stepChannel: 'Канал подключён',
    stepLink: 'Первая трекинг-ссылка создана',
    nextChannel: 'Следующий шаг: добавьте бота администратором в канал.',
    nextLink: 'Следующий шаг: создайте трекинг-ссылку и поставьте её в рекламу.',
    ready: 'Всё готово. После следующего посева загляните в /stats.',
  },

  help: {
    title: 'Справка',
    intro: 'TGPulse создаёт отдельную пригласительную ссылку под каждое размещение. Когда человек подписывается через неё, подписка привязывается к этой ссылке, так что вы всегда знаете, какое размещение привело подписчика.',
    commandsTitle: 'Команды',
    commands: [
      '/newlink создаёт трекинг-ссылку',
      '/stats показывает последние 7 дней по каналам',
      '/channels список каналов, их ссылок и статистики',
      '/fraud оценивает ссылку на ботов: всплески, мгновенные отписки, пустые профили',
      '/notifications включает мгновенные уведомления о подписках и отписках',
      '/language переключает язык между английским и русским',
    ],
    faqTitle: 'Частые вопросы',
    faq: [
      'Какие права нужны боту? Администратор канала с правом «приглашать по ссылке». Больше ничего.',
      'Как отключить канал? Уберите бота из администраторов, отслеживание прекратится сразу.',
    ],
    dashboard: (url: string) => `Дашборд: ${url}`,
  },

  language: {
    title: 'Язык',
    intro: 'Выберите язык ответов бота, ежедневных отчётов и мгновенных уведомлений.',
    current: (name: string) => `Сейчас: ${name}`,
    changed: 'Язык переключён на русский. Всё, что присылает бот, теперь на нём.',
  },

  onboarding: {
    channelConnected: (title: string) => `Канал «${title}» подключён.`,
    createFirstLink: 'Создайте первую трекинг-ссылку командой /newlink.',
  },

  newlink: {
    title: 'Новая трекинг-ссылка',
    pickChannel: 'Выберите канал, на который ведёт ссылка.',
    askLabel: 'Пришлите название для ссылки, например «посев @channel, 20 июня».',
    labelFooter: 'Это название вы увидите в статистике и отчётах.',
    emptyLabel: 'Название не может быть пустым. Пришлите короткое имя для ссылки.',
    channelGone: 'Этот канал больше недоступен. Начните заново с /newlink.',
    cancelled: 'Отменено, ничего не создано.',
    createFailed: (description: string, title: string) =>
      `Не удалось создать пригласительную ссылку: ${description}. Проверьте, что бот всё ещё администратор в «${title}».`,
    saveFailed: 'Не удалось сохранить ссылку. Попробуйте /newlink ещё раз.',
    createdTitle: 'Ссылка создана',
    label: 'Название',
    trackingUrl: 'Трекинг-ссылка',
    inviteLink: 'Пригласительная',
    createdFooter: (sources: number) =>
      `В этом канале теперь ${sources} ${plural(sources, 'источник', 'источника', 'источников')}. Делитесь трекинг-ссылкой: каждый клик и каждая подписка через неё привязываются к этому названию.`,
  },

  stats: {
    title: (days: number) => `Последние ${days} ${plural(days, 'день', 'дня', 'дней')}`,
    joins: 'Подписки',
    leaves: 'Отписки',
    net: 'Итого',
    perDay: 'По дням',
    topSources: 'Топ источников',
    empty: 'За этот период активности не было.',
    hint: 'Создайте трекинг-ссылку через /newlink, чтобы видеть источники подписчиков.',
  },

  channels: {
    title: 'Ваши каналы',
    page: (page: number, total: number) => `страница ${page} из ${total}`,
    pickHint: 'Выберите канал, чтобы посмотреть статистику и ссылки.',
    menuFooter: 'Статистика, новая трекинг-ссылка или полный список ссылок.',
    linksTitle: 'Ссылки',
    linksEmpty: 'В этом канале пока нет ссылок.',
    linksEmptyFooter: 'Нажмите «Новая ссылка», чтобы создать первую.',
    clicks: (count: number) => `${count} ${plural(count, 'клик', 'клика', 'кликов')}`,
    joins: (count: number) => `${count} ${plural(count, 'подписка', 'подписки', 'подписок')}`,
    revoked: 'отозвана',
    linksFooter: 'Каждый клик и каждая подписка через эти ссылки привязываются автоматически.',
  },

  alerts: {
    title: 'Мгновенные уведомления',
    intro: 'Сообщение на каждую подписку и отписку. Включается отдельно для каждого канала, по умолчанию выключено.',
    footer: 'Нажмите на канал, чтобы включить или выключить уведомления.',
    toggled: (title: string, isOn: boolean) => `${title}: уведомления ${isOn ? 'включены' : 'выключены'}`,
    joined: (title: string, source: string) => `+1 подписчик в <b>${title}</b>, источник: ${source}`,
    left: (title: string, source: string) => `-1 подписчик в <b>${title}</b> (приходил из: ${source})`,
  },

  fraud: {
    verdict,
    signal,
    evidence,
    title: 'Проверка на фрод',
    pickChannel: 'Выберите канал, чтобы оценить качество трафика его ссылок.',
    linksFooter: 'Оценка от 0 до 100, чем выше, тем больше похоже на ботов. Нажмите на ссылку для полного отчёта.',
    noLinks: 'В этом канале пока нет ссылок.',
    noLinksFooter: 'Создайте ссылку через /newlink и проверьте её после посева.',
    linkUnavailable: 'Эта ссылка больше недоступна.',
    score: 'Оценка',
    joins: 'Подписки',
    clicks: 'Клики',
    notMeasured: (names: string) => `Пока не измерено, выборка мала: ${names}.`,
    evidenceJoiner: ', ',
    adviceNotEnough: (joins: number, min: number) =>
      `Пока только ${joins} ${plural(joins, 'подписка', 'подписки', 'подписок')}. Для надёжного вердикта нужно минимум ${min} через эту ссылку.`,
    adviceClean: 'Трафик ведёт себя как живая аудитория. Реагировать не на что.',
    adviceSuspicious: (why: string) => `Придержите следующий платёж и попросите админа канала объяснить: ${why}.`,
    adviceFraud: (why: string) => `Запросите у админа канала возврат: ${why}.`,
  },

  report: {
    title: (date: string) => `Ежедневный отчёт, ${date} (UTC)`,
    joins: 'Подписки',
    leaves: 'Отписки',
    net: 'Итого',
    topSources: 'Топ источников',
    leaversCame: 'Отписавшиеся пришли из',
    empty: 'Вчера не было ни подписок, ни отписок.',
    noChannels: 'Активных каналов пока нет. Сначала добавьте бота администратором в канал.',
  },

  sources: {
    organic: 'органика',
    deletedLink: 'удалённая ссылка',
  },
};
