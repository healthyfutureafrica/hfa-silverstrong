import { forwardRef } from 'react';
import { cx } from '../utils/cx.js';

const PADDING = { none: '', sm: 'p-3', md: 'p-4 sm:p-6', lg: 'p-6 sm:p-8' };

/**
 * HFA card container. Compose it with the Header, Body and Footer slots:
 *
 *   <Card>
 *     <Card.Header title="Vital Health Card" subtitle="Updated today" actions={<Button>Edit</Button>} />
 *     <Card.Body>…</Card.Body>
 *     <Card.Footer>…</Card.Footer>
 *   </Card>
 *
 * @param {object} props
 * @param {keyof JSX.IntrinsicElements} [props.as='section'] - Element to render (section, article, div, li…).
 * @param {boolean} [props.interactive=false] - Adds hover/focus styling for clickable cards.
 * @param {'default'|'highlight'|'danger'} [props.tone='default'] - Accent border on the left.
 * @param {string} [props.className] - Extra classes.
 * @param {import('react').ReactNode} props.children - Slots or content.
 * @returns {import('react').ReactElement} The card.
 */
const Card = forwardRef(function Card({ as: Element = 'section', interactive = false, tone = 'default', className, children, ...rest }, ref) {
  return (
    <Element
      ref={ref}
      className={cx(
        'flex flex-col overflow-hidden rounded-card border border-hfa-gray-200 bg-white text-hfa-dark shadow-card',
        'dark:border-hfa-gray-700 dark:bg-surface-dark-raised dark:text-hfa-gray-100',
        tone === 'highlight' && 'border-l-4 border-l-highlight',
        tone === 'danger' && 'border-l-4 border-l-danger',
        interactive && 'cursor-pointer transition-shadow hover:shadow-raised focus-within:shadow-raised focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
        className
      )}
      {...rest}
    >
      {children}
    </Element>
  );
});

/**
 * Card header with title, optional subtitle, optional icon and right-aligned actions.
 *
 * @param {object} props
 * @param {import('react').ReactNode} [props.title] - Heading text.
 * @param {import('react').ReactNode} [props.subtitle] - Secondary text under the title.
 * @param {import('react').ComponentType} [props.icon] - Lucide icon shown before the title.
 * @param {import('react').ReactNode} [props.actions] - Buttons or links on the right.
 * @param {2|3|4} [props.level=2] - Heading level for document structure.
 * @param {string} [props.className] - Extra classes.
 * @param {import('react').ReactNode} [props.children] - Custom header content (replaces title layout).
 * @returns {import('react').ReactElement} The header.
 */
function CardHeader({ title, subtitle, icon: Icon, actions, level = 2, className, children, ...rest }) {
  const Heading = `h${level}`;
  return (
    <header className={cx('flex flex-wrap items-start justify-between gap-3 border-b border-hfa-gray-100 px-4 py-4 sm:px-6 dark:border-hfa-gray-700', className)} {...rest}>
      {children || (
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary dark:bg-primary-900/50 dark:text-primary-300">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
          ) : null}
          <div className="min-w-0">
            {title ? <Heading className="text-base font-semibold leading-6 text-hfa-dark sm:text-lg dark:text-white">{title}</Heading> : null}
            {subtitle ? <p className="mt-0.5 text-sm text-hfa-gray-500 dark:text-hfa-gray-400">{subtitle}</p> : null}
          </div>
        </div>
      )}
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/**
 * Card body.
 *
 * @param {object} props
 * @param {'none'|'sm'|'md'|'lg'} [props.padding='md'] - Inner spacing.
 * @param {boolean} [props.clinical=false] - Uses the Merriweather serif font for long clinical text.
 * @param {string} [props.className] - Extra classes.
 * @param {import('react').ReactNode} props.children - Content.
 * @returns {import('react').ReactElement} The body.
 */
function CardBody({ padding = 'md', clinical = false, className, children, ...rest }) {
  return (
    <div className={cx('flex-1', PADDING[padding] ?? PADDING.md, clinical && 'font-clinical leading-relaxed', className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * Card footer, typically for actions. Stacks buttons on small phones.
 *
 * @param {object} props
 * @param {'start'|'end'|'between'} [props.align='end'] - Horizontal alignment.
 * @param {string} [props.className] - Extra classes.
 * @param {import('react').ReactNode} props.children - Content.
 * @returns {import('react').ReactElement} The footer.
 */
function CardFooter({ align = 'end', className, children, ...rest }) {
  const justify = { start: 'sm:justify-start', end: 'sm:justify-end', between: 'sm:justify-between' }[align] || 'sm:justify-end';
  return (
    <footer className={cx('flex flex-col-reverse gap-2 border-t border-hfa-gray-100 bg-hfa-light-bg px-4 py-3 sm:flex-row sm:items-center sm:px-6 dark:border-hfa-gray-700 dark:bg-white/5', justify, className)} {...rest}>
      {children}
    </footer>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export { CardHeader, CardBody, CardFooter };
export default Card;
