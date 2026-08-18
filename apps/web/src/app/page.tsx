import { HeroChart } from '@/components/hero/HeroChart';
import styles from './page.module.css';

const FEATURES = [
  {
    title: 'Точная атрибуция без лимитов',
    text: 'Уникальная инвайт-ссылка на каждый креатив: видно, кто пришёл с какого размещения — детерминированно, а не «с точностью 95%». Работает на любых объёмах.',
  },
  {
    title: 'Веб-дашборд, а не Excel',
    text: 'Realtime-графики прироста, отписок и конверсии по каждому источнику. Отчёт можно расшарить клиенту одной ссылкой.',
  },
  {
    title: 'Платите за подписчиков, а не клики',
    text: 'Передаём оффлайн-конверсию «подписка» в Яндекс.Директ — кампании оптимизируются на подписку, а не на переход.',
  },
  {
    title: 'ROMI по источникам',
    text: 'Загрузите список покупателей или подключите GetCourse — увидите, какой канал закупа приносит деньги, а не только подписчиков.',
  },
  {
    title: 'Антифрод посевов',
    text: 'Детекция налива ботов с отчётом-пруфом: возвращайте деньги за накрученные интеграции.',
  },
  {
    title: 'Для команд и агентств',
    text: 'Воркспейсы, роли, сравнение подрядчиков и white-label отчёты для ваших клиентов.',
  },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header>
        <nav className={styles.nav} aria-label="Главная навигация">
          <a href="/" className={styles.logo}>
            TG<span className={styles.logoAccent}>Pulse</span>
          </a>
          <a href="/app" className={styles.navCta}>
            Войти
          </a>
        </nav>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div>
            <h1 id="hero-heading" className={styles.heroTitle}>
              Видите, откуда приходят <span className={styles.heroTitleAccent}>подписчики и деньги</span> в ваш канал
            </h1>
            <p className={styles.heroSubtitle}>
              Атрибуция каждого подписчика к креативу и площадке. Отписки, конверсии, ROMI — в реальном
              времени. Перекидывайте бюджет на связки, которые работают, и снижайте цену подписчика в 1,5–2 раза.
            </p>
            <div className={styles.heroActions}>
              <a href="/app" className={styles.primaryCta}>
                Подключить бесплатно
              </a>
              <a href="#features" className={styles.secondaryCta}>
                Как это работает
              </a>
            </div>
          </div>
          <HeroChart />
        </section>

        <section id="features" className={styles.section} aria-labelledby="features-heading">
          <h2 id="features-heading" className={styles.sectionTitle}>
            Всё, что нужно закупщику трафика — в одном сервисе
          </h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((f) => (
              <article key={f.title} className={styles.featureCard}>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>TGPulse · аналитика трафика Telegram-каналов</p>
      </footer>
    </div>
  );
}
