import { DeviceMockup } from '@/components/hero/DeviceMockup';
import { SmoothScroll } from '@/components/providers/SmoothScroll';
import { Reveal } from '@/components/ui/Reveal';
import { FlowCurve } from '@/components/sections/FlowCurve';
import styles from './page.module.css';

const FEATURES = [
  {
    icon: '◎',
    title: 'Атрибуция без лимитов',
    text: 'Уникальная инвайт-ссылка на каждый креатив. Видно, кто пришёл с какого размещения — на любых объёмах.',
  },
  {
    icon: '▦',
    title: 'Дашборд, а не Excel',
    text: 'Realtime-графики прироста, отписок и конверсии. Отчёт можно расшарить клиенту одной ссылкой.',
  },
  {
    icon: '⇄',
    title: 'Конверсии в Я.Директ',
    text: 'Передаём «подписку» как оффлайн-конверсию — платите Яндексу за подписчиков, а не за клики.',
  },
  {
    icon: '₽',
    title: 'ROMI по источникам',
    text: 'Подключите GetCourse или загрузите покупателей — увидите, какой закуп приносит деньги.',
  },
  {
    icon: '⌗',
    title: 'Антифрод посевов',
    text: 'Детекция налива ботов с отчётом-пруфом — возвращайте деньги за накрученные интеграции.',
  },
  {
    icon: '◫',
    title: 'Режим агентства',
    text: 'Воркспейсы, роли, сравнение закупщиков и white-label отчёты для ваших клиентов.',
  },
];

export default function LandingPage() {
  return (
    <SmoothScroll>
      <div className={styles.page}>
        <header className={styles.header}>
          <nav className={styles.nav} aria-label="Главная навигация">
            <a href="/" className={styles.logo}>
              <span className={styles.logoMark} />
              TGPulse
            </a>
            <div className={styles.navLinks}>
              <a href="#features">Возможности</a>
              <a href="#how">Как работает</a>
              <a href="#cta">Тарифы</a>
            </div>
            <a href="/app" className={styles.navCta}>
              Войти
            </a>
          </nav>
        </header>

        <main>
          {/* ---------- hero ---------- */}
          <section className={styles.hero} aria-labelledby="hero-heading">
            <div className={styles.heroBackdrop} aria-hidden="true">
              PULSE
            </div>

            <Reveal>
              <p className={styles.badge}>
                <span className={styles.badgeDot} />
                Атрибуция для Telegram-каналов
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <h1 id="hero-heading" className={styles.heroTitle}>
                Видно, какая реклама приводит
                <br />
                подписчиков. И какая — сливает бюджет.
              </h1>
            </Reveal>
            <Reveal delay={0.2}>
              <p className={styles.heroSub}>
                TGPulse метит каждого подписчика источником, передаёт конверсии в рекламные
                кабинеты и показывает связки, которые приносят деньги.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <div className={styles.heroActions}>
                <a href="/app" className={styles.primaryCta}>
                  Подключить бесплатно
                </a>
                <a href="#how" className={styles.ghostCta}>
                  Как это работает
                </a>
              </div>
            </Reveal>

            <div className={styles.heroMockup}>
              <DeviceMockup />
            </div>
          </section>

          {/* ---------- features ---------- */}
          <section id="features" className={styles.section} aria-labelledby="features-heading">
            <Reveal>
              <h2 id="features-heading" className={styles.sectionTitle}>
                Один сервис вместо Excel,
                <br />
                догадок и споров с закупщиками
              </h2>
            </Reveal>
            <div className={styles.featureGrid}>
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={0.08 * i}>
                  <article className={styles.featureCard}>
                    <span className={styles.featureIcon}>{f.icon}</span>
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                  </article>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <div className={styles.gradientPanel}>
                <div>
                  <h3 className={styles.panelTitle}>Цена подписчика ниже в 1,5–2 раза</h3>
                  <p className={styles.panelText}>
                    Не магия — арифметика. Отключаете худшие связки, масштабируете лучшие,
                    и платите рекламным площадкам за подписку, а не за переход.
                  </p>
                </div>
                <div className={styles.panelStats}>
                  <div>
                    <p className={styles.panelStatValue}>84 ₽</p>
                    <p className={styles.panelStatLabel}>средний CPS после месяца</p>
                  </div>
                  <div>
                    <p className={styles.panelStatValue}>100%</p>
                    <p className={styles.panelStatLabel}>подписчиков с источником</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </section>

          {/* ---------- how it works ---------- */}
          <section id="how" className={styles.section} aria-labelledby="how-heading">
            <Reveal>
              <h2 id="how-heading" className={`${styles.sectionTitle} ${styles.centered}`}>
                От подключения до экономии — четыре шага
              </h2>
            </Reveal>
            <FlowCurve />
          </section>

          {/* ---------- CTA ---------- */}
          <section id="cta" className={styles.finalCta}>
            <Reveal>
              <h2 className={styles.finalTitle}>Хватит покупать трафик вслепую</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className={styles.finalSub}>
                Бесплатно для одного канала. Подключение за минуту, карта не нужна.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <a href="/app" className={styles.primaryCta}>
                Подключить бесплатно
              </a>
            </Reveal>
          </section>
        </main>

        <footer className={styles.footer}>
          <p>TGPulse · аналитика трафика Telegram-каналов</p>
        </footer>
      </div>
    </SmoothScroll>
  );
}
