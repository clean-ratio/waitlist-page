import { useEffect } from 'react';
import styles from './Overlay.module.css';
import Signature from './Signature';
import { COVER } from '../lib/content';
import { trackOnce } from '../lib/analytics';
import { useStore } from '../lib/store';
import { Reveal, Words } from './motion';
import useLanded from './useLanded';

/**
 * The cover is HTML text over a CSS background, so it paints before WebGL
 * boots. That is what keeps LCP under 2.5 s on 4G — and it is the first thing
 * anybody sees, so it is the one place worth spending motion on.
 */
export default function CoverText({ active }: { active: boolean }) {
  const landed = useLanded(active);
  const { state } = useStore();
  const onTheList = state.lead.status === 'done';

  useEffect(() => {
    if (active) trackOnce('cover_view');
  }, [active]);

  return (
    <div className={styles.cover} inert={!active}>
      <Reveal as="p" className="u-label" delay={0.1} y={8}>
        {COVER.kicker}
      </Reveal>

      <div>
        <h1 className={`u-serif ${styles.coverLine}`}>
          <Words
            text={`${COVER.line} _${COVER.lineItalic}_`}
            delay={0.3}
            stagger={0.07}
          />
        </h1>
        <Reveal as="p" className={styles.coverDescription} delay={0.85}>
          {COVER.description}
        </Reveal>
        <Reveal delay={1.1} play={landed || active}>
          <Signature title="Clean Ratio signature" />
        </Reveal>

        {/* Says why the form is not here any more, so its absence reads as
            deliberate rather than as something that broke. */}
        {onTheList && (
          <Reveal
            as="p"
            className={`u-label ${styles.onList}`}
            delay={1.35}
            y={8}
          >
            Thank you — scroll on
          </Reveal>
        )}
      </div>
    </div>
  );
}
