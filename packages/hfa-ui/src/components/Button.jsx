import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from '../utils/cx.js';

/** Visual style per variant (light and dark mode). */
const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-700 active:bg-primary-800 focus-visible:ring-primary/40 dark:bg-primary-500 dark:hover:bg-primary-400',
  secondary: 'border border-primary text-primary bg-white hover:bg-primary-50 active:bg-primary-100 focus-visible:ring-primary/30 dark:bg-transparent dark:text-primary-300 dark:border-primary-300 dark:hover:bg-primary-900/40',
  danger: 'bg-danger text-white hover:bg-danger-700 active:bg-danger-800 focus-visible:ring-danger/40',
  ghost: 'bg-transparent text-hfa-gray-700 hover:bg-hfa-gray-100 active:bg-hfa-gray-200 focus-visible:ring-primary/30 dark:text-hfa-gray-200 dark:hover:bg-white/10'
};

/** Size presets. Every size keeps at least a 44px touch target on phones except `sm`. */
const SIZES = {
  sm: 'min-h-[36px] px-3 text-sm gap-1.5',
  md: 'min-h-touch px-5 text-sm gap-2',
  lg: 'min-h-[52px] px-6 text-base gap-2.5'
};

/**
 * HFA button.
 *
 * @param {object} props
 * @param {'primary'|'secondary'|'danger'|'ghost'} [props.variant='primary'] - Visual style.
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Size.
 * @param {boolean} [props.loading=false] - Shows a spinner, disables the button and sets aria-busy.
 * @param {string} [props.loadingText] - Text shown while loading (defaults to the children).
 * @param {import('react').ComponentType} [props.leftIcon] - Lucide icon shown before the label.
 * @param {import('react').ComponentType} [props.rightIcon] - Lucide icon shown after the label.
 * @param {boolean} [props.fullWidth=false] - Stretch to the container width.
 * @param {'button'|'submit'|'reset'} [props.type='button'] - Native type (defaults to "button" so it never submits a form by accident).
 * @param {string} [props.className] - Extra classes.
 * @param {import('react').ReactNode} props.children - Label.
 * @returns {import('react').ReactElement} The button.
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, loadingText, leftIcon: LeftIcon, rightIcon: RightIcon, fullWidth = false, type = 'button', disabled, className, children, ...rest },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center rounded-button font-semibold transition-colors duration-150 select-none',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : LeftIcon ? <LeftIcon aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && RightIcon ? <RightIcon aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
    </button>
  );
});

export default Button;
