import type { Plan } from '@tgpulse/db';
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

/** Названия тарифов продуктовые: одинаковые во всех локалях. */
const planName: Record<Plan, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  AGENCY: 'Agency',
};

export const ru: Dict = {
  nav: {
    channels: 'Каналы',
    links: 'Ссылки',
    stats: 'Статистика',
    fraud: 'Проверка на фрод',
    alerts: 'Уведомления',
    language: 'Язык',
    billing: 'Оплата',
    plans: 'Тарифы',
  },

  buttons: {
    addToChannel: '➕ Добавить в канал',
    createLink: '🔗 Создать трекинг-ссылку',
    myStats: '📊 Моя статистика',
    openDashboard: '🌐 Открыть дашборд',
    createAnother: 'Создать ещё',
    viewStats: 'Статистика',
    cancel: 'Отмена',
    skip: 'Пропустить',
    modeInvite: 'Пригласительная (по умолчанию)',
    modeLandingPost: 'Пост в канале',
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
    upgrade: '⭐ Улучшить тариф',
    billing: '💳 Оплата',
    pay: '⭐ Оплатить звёздами',
  },

  commands: {
    start: 'Что умеет TGPulse и быстрые действия',
    newlink: 'Создать трекинг-ссылку',
    bulklinks: 'Создать много трекинг-ссылок сразу',
    stats: 'Подписки, отписки и источники за 7 дней',
    channels: 'Ваши каналы и ссылки',
    fraud: 'Проверить ссылку посева на ботов',
    notifications: 'Мгновенные уведомления о подписках',
    upgrade: 'Тарифы и оплата звёздами Telegram',
    billing: 'Ваш тариф, дата продления и платежи',
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
      '/bulklinks создаёт по ссылке на каждую строку медиаплана и присылает CSV для рекламного кабинета',
      '/stats показывает последние 7 дней по каналам',
      '/channels список каналов, их ссылок и статистики',
      '/fraud оценивает ссылку на ботов: всплески, мгновенные отписки, пустые профили',
      '/notifications включает мгновенные уведомления о подписках и отписках',
      '/upgrade показывает тарифы и оплату звёздами Telegram',
      '/billing показывает тариф, дату продления и платежи',
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
    expired: 'Диалог устарел. Начните заново с /newlink.',

    askMode: 'Куда должна вести эта ссылка?',
    modeFooter:
      'Пригласительная привязывает каждую подписку точно. Режим поста сначала ведёт человека на пост в канале.',
    askPostUrl:
      'Пришлите ссылку на пост, например https://t.me/yourchannel/123 или https://t.me/c/1234567890/123.',
    postUrlFooter: 'Пост должен принадлежать этому каналу, иначе ссылка не будет принята.',
    postUrlNotTelegram:
      'Это не адрес t.me. Пришлите ссылку на пост вида https://t.me/yourchannel/123.',
    postUrlNotAPost:
      'Эта ссылка ведёт не на пост. В конце адреса должен быть номер сообщения, например https://t.me/yourchannel/123.',
    postUrlOtherChannel: (title: string) =>
      `Этот пост принадлежит другому чату. Пришлите пост из «${title}», иначе трекинг-ссылка уводила бы людей в другое место.`,
    postUrlNoUsername: (title: string) =>
      `У канала «${title}» нет публичного юзернейма, поэтому проверить адрес вида t.me/<имя>/<id> не с чем. Используйте приватный формат https://t.me/c/<id>/<сообщение>.`,

    askBuyer: 'Кто байер этого размещения?',
    buyerFooter: 'Необязательно. Нажмите «Пропустить», если не сравниваете байеров.',
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

  links: {
    mode: 'Режим',
    modeInvite: 'Пригласительная',
    modeLandingPost: 'Пост в канале',
    landingPost: 'Ссылка на пост',
    buyer: 'Байер',
    landingPostWarning:
      'Для ссылок на пост привязка считается по временному окну и она менее точная, чем у пригласительных.',
    landingPostLegend: (mark: string) =>
      `${mark} отмечены ссылки на пост: привязка там считается по временному окну и менее точная, чем у пригласительных.`,
  },

  bulk: {
    title: 'Массовые ссылки',
    pickChannel: 'Выберите канал, на который ведут эти ссылки.',
    ask: (max: number) =>
      `Пришлите до ${max} названий размещений, по одному в строке. Каждая строка станет отдельной трекинг-ссылкой.`,
    askFooter: 'Строка используется как название ссылки, ровно в том виде, в каком вы её прислали.',
    empty: 'Названий не найдено. Пришлите хотя бы одно, по одному в строке.',
    working: (count: number) =>
      `Создаю ${count} ${plural(count, 'ссылку', 'ссылки', 'ссылок')}. Это займёт немного времени.`,
    resultTitle: 'Массовые ссылки',
    created: (count: number) =>
      `Создано ${count} ${plural(count, 'ссылка', 'ссылки', 'ссылок')}.`,
    skippedQuota: (count: number, plan: string, limit: number) =>
      `Пропущено ${count}: тариф ${plan} допускает ${limit} ${plural(limit, 'ссылку', 'ссылки', 'ссылок')} на канал.`,
    skippedBatch: (count: number, max: number) =>
      `Пропущено ${count}: за один раз принимается не больше ${max} названий.`,
    stopped: (reason: string) =>
      `Telegram прервал пачку: ${reason}. Всё, что перечислено здесь, создано и работает.`,
    saveFailedReason: 'ссылку не удалось сохранить',
    nothingCreated: 'Ни одной ссылки не создано.',
    resultFooter: 'В CSV ниже по строке на ссылку, можно сразу вставлять в рекламный кабинет.',
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

  billing: {
    planName,
    unlimited: '∞',

    plansTitle: 'Тарифы',
    plansIntro: 'Тариф общий на рабочее пространство. Оплата проходит звёздами Telegram, прямо в этом чате.',
    currentPlan: 'Текущий тариф',
    usageChannels: 'Каналы',
    usageLinks: 'Ссылок в канале',
    usageMembers: 'Участники команды',
    planOffer: (name: string, price: number) => `<b>${name}</b>, ${price} ⭐ / месяц`,
    planPerks: (channels: number, links: string, members: number) =>
      `${channels} ${plural(channels, 'канал', 'канала', 'каналов')}, ${links} ссылок в канале, ${members} ${plural(members, 'участник', 'участника', 'участников')} команды, постбеки, модуль выручки, полные отчёты по фроду`,
    buyButton: (name: string, price: number) => `${name} ${price} ⭐ / месяц`,
    plansFooter: (days: number) =>
      `Период длится ${days} ${plural(days, 'день', 'дня', 'дней')} и продлевается автоматически. Отменить можно в любой момент в Telegram.`,

    title: 'Оплата',
    renewsOn: (date: string) => `Продление ${date}`,
    activeUntil: (date: string) => `Действует до ${date}`,
    cancelScheduled: 'Запланирована отмена, тариф не продлится.',
    freeBody: 'У вас тариф Free. Списаний нет.',
    paymentsTitle: 'Последние платежи',
    paymentRow: (date: string, plan: string, amount: number) => `${date} · ${plan} · ${amount} ⭐`,
    noPayments: 'Платежей пока не было.',
    howToCancel: 'Как отменить: Telegram, затем «Настройки», «Мои звёзды», «Подписки».',

    invoiceTitle: (name: string) => `TGPulse ${name}`,
    invoiceDescription: (name: string, days: number) =>
      `Тариф ${name} на ${days} ${plural(days, 'день', 'дня', 'дней')}: больше каналов, безлимит трекинг-ссылок, постбеки, модуль выручки и полные отчёты по фроду.`,
    invoicePrompt: (name: string, price: number) =>
      `${name}, ${price} ⭐ за период. Нажмите кнопку ниже, чтобы оплатить звёздами Telegram.`,
    invoiceFailed: 'Не удалось открыть форму оплаты. Попробуйте ещё раз через минуту.',
    invalidPayload: 'Этот счёт больше не действителен. Откройте /upgrade и выберите тариф заново.',

    paidTitle: 'Платёж получен',
    paidBody: (name: string, date: string) => `<b>${name}</b> действует до ${date}.`,
    paidFooter: 'Всё, что открывает тариф, доступно сразу.',

    noWorkspace: 'Тариф считается на рабочее пространство, а оно появляется вместе с первым каналом.',

    upsell: {
      title: 'Достигнут лимит тарифа',
      channels: (plan: string, limit: number) =>
        `Тариф ${plan} покрывает ${limit} ${plural(limit, 'канал', 'канала', 'каналов')}. Этот канал продолжает отслеживаться, но новые ссылки в нём заблокированы.`,
      links: (plan: string, limit: number) =>
        `Тариф ${plan} допускает ${limit} трекинг-${plural(limit, 'ссылку', 'ссылки', 'ссылок')} на канал, и этот канал уже заполнен.`,
      fraud: (plan: string) =>
        `На тарифе ${plan} полный отчёт по фроду доступен только для самой свежей ссылки канала.`,
      footer: (name: string, price: number) =>
        `Перейдите на ${name} за ${price} ⭐ в месяц, чтобы снять ограничение.`,
      connectedTitle: 'Канал подключён сверх тарифа',
      connectedBody: (title: string, plan: string, limit: number) =>
        `«${title}» подключён и отслеживается. Тариф ${plan} покрывает ${limit} ${plural(limit, 'канал', 'канала', 'каналов')}, поэтому новые трекинг-ссылки в этом канале заблокированы до улучшения тарифа.`,
    },
  },
};
