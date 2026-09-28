import { useEffect } from 'react';
import styles from './Thanks.module.css';
import Signature from './Signature';
import { WORDMARK } from '../lib/content';
import { trackOnce } from '../lib/analytics';
import { Reveal, Words } from './motion';

export default function Thanks({ active }: { active: boolean }) {
  useEffect(() => {
    if (active) trackOnce('thanks_view');
  }, [active]);

  return (
    <section
      className={`${styles.section} ${active ? styles.visible : ''}`}
      aria-label="Thank you"
      inert={!active}
    >
      <div className={styles.inner}>
        <h2 className={`u-serif ${styles.line}`}>
          <Words
            text="Thank you. _That's all._"
            delay={0.45}
            stagger={0.08}
            play={active}
          />
        </h2>
        <Reveal delay={1.3} play={active}>
          <Signature title={`${WORDMARK} signature`} />
        </Reveal>
      </div>
    </section>
  );
}
