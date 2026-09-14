import { AttributionLog } from '@/components/hero/AttributionLog';
import { AttributionStream } from '@/components/hero/AttributionStream';
import { DeviceMockup } from '@/components/hero/DeviceMockup';
import { MobileHeroVisual } from '@/components/hero/MobileHeroVisual';
import { SmoothScroll } from '@/components/providers/SmoothScroll';
import { Reveal } from '@/components/ui/Reveal';
import { StickyCta } from '@/components/ui/StickyCta';
import { ComparisonSection } from '@/components/sections/ComparisonSection';
import { FaqSection } from '@/components/sections/FaqSection';
import { FlowCurve } from '@/components/sections/FlowCurve';
import { GlobalReachSection } from '@/components/sections/GlobalReachSection';
import { PainSection } from '@/components/sections/PainSection';
import { PricingSection } from '@/components/sections/PricingSection';
import styles from './page.module.css';

const FEATURES = [
  {
    title: 'Attribution without limits',
    text: 'A unique invite link for every creative. See who came from which placement, at any volume.',
  },
  {
    title: 'A dashboard, not a spreadsheet',
    text: 'Realtime growth, unsubscribe and conversion charts. Share a report with a client in one link.',
  },
  {
    title: 'Conversions back to your ad account',
    text: 'Every subscribe is uploaded to Meta and Yandex against the original click id, so the algorithm optimizes for subscribers instead of clicks.',
  },
  {
    title: 'ROMI per source',
    text: 'Upload your buyers or connect a CRM. See which placements actually bring money.',
  },
  {
    title: 'Seeding anti-fraud',
    text: 'Bot-pour detection with a proof report. Get refunds for faked placements.',
  },
  {
    title: 'Agency mode',
    text: 'Workspaces, roles, buyer comparison and white-label reports for your clients.',
  },
];

export default function LandingPage() {
  return (
    <SmoothScroll>
      <div className={styles.page}>
        <header className={styles.header}>
          <nav className={styles.nav} aria-label="Main navigation">
            <a href="/" className={styles.logo}>
              <span className={styles.logoMark} />
              TGPulse
            </a>
            <div className={styles.navLinks}>
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
            <a href="/app" className={styles.navCta}>
              Sign in
            </a>
          </nav>
        </header>

        <main>
          {/* ---------- hero ---------- */}
          <section className={styles.hero} aria-labelledby="hero-heading">
            <AttributionLog />

            <div className={styles.heroContent}>
              <Reveal immediate>
                <p className={styles.badge}>Subscriber attribution for Telegram channels</p>
              </Reveal>
              <Reveal immediate delay={0.1}>
                <h1 id="hero-heading" className={styles.heroTitle}>
                  You know what you spent on channel ads. TGPulse shows what they brought back.
                </h1>
              </Reveal>
              <Reveal immediate delay={0.2}>
                <p className={styles.heroSub}>
                  A unique link for every placement. Every subscriber tied to a creative.
                  Unsubscribes, conversions and ROMI in one dashboard.
                </p>
              </Reveal>
              <Reveal immediate delay={0.3}>
                <div className={styles.heroActions}>
                  <a href="/app" className={styles.primaryCta}>
                    Start free
                  </a>
                  <a href="#how" className={styles.ghostCta}>
                    How it works
                  </a>
                </div>
              </Reveal>
            </div>

            <div className={styles.heroMockup}>
              <AttributionStream />
              <DeviceMockup />
              <MobileHeroVisual />
            </div>
          </section>

          <PainSection />

          {/* ---------- how it works ---------- */}
          <section id="how" className={styles.section} aria-labelledby="how-heading">
            <Reveal>
              <h2 id="how-heading" className={`${styles.sectionTitle} ${styles.centered}`}>
                From bot to savings: 4 steps, 2 minutes
              </h2>
            </Reveal>
            <FlowCurve />
          </section>

          <ComparisonSection />

          {/* ---------- features ---------- */}
          <section id="features" className={styles.section} aria-labelledby="features-heading">
            <Reveal>
              <h2 id="features-heading" className={styles.sectionTitle}>
                One tool instead of spreadsheets,
                <br />
                guesswork and arguments with media buyers
              </h2>
            </Reveal>
            <div className={styles.featureGrid}>
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={0.08 * i}>
                  <article className={styles.featureCard}>
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                  </article>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <div className={styles.gradientPanel}>
                <div>
                  <h3 className={styles.panelTitle}>Cost per subscriber, 1.5-2x lower</h3>
                  <p className={styles.panelText}>
                    No magic, just arithmetic: pause the worst combos, scale the best,
                    and pay ad platforms per subscriber instead of per click.
                  </p>
                </div>
                <div className={styles.panelStats}>
                  <div>
                    <p className={styles.panelStatValue}>100%</p>
                    <p className={styles.panelStatLabel}>
                      of subscribers carry a source: Telegram mechanics, not an estimate
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </section>

          <GlobalReachSection />

          <div id="pricing">
            <PricingSection />
          </div>

          <div id="faq">
            <FaqSection />
          </div>

          {/* ---------- CTA ---------- */}
          <section id="cta" className={styles.finalCta}>
            <Reveal>
              <h2 className={styles.finalTitle}>Stop buying traffic blind</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className={styles.finalSub}>
                Free for one channel. The bot connects in 2 minutes and detaches with one button.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <a href="/app" className={styles.primaryCta}>
                Start free
              </a>
            </Reveal>
          </section>
        </main>

        <footer className={styles.footer}>
          <p>TGPulse. Traffic analytics for Telegram channels</p>
        </footer>

        <StickyCta />
      </div>
    </SmoothScroll>
  );
}
