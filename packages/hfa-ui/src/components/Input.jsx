import { forwardRef, useId, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { cx } from '../utils/cx.js';
import { useTranslation } from '../i18n/index.js';

/**
 * HFA text input with label, hint, error and icon support.
 *
 * Accessibility: the label is always linked to the input; hint and error text are announced via
 * aria-describedby; errors set aria-invalid. Password inputs get a show/hide toggle.
 *
 * @param {object} props
 * @param {string} props.label - Visible label (required for accessibility).
 * @param {string} [props.hint] - Help text shown under the input.
 * @param {string} [props.error] - Error message; shows the error state when present.
 * @param {import('react').ComponentType} [props.icon] - Lucide icon shown inside the input on the left.
 * @param {import('react').ReactNode} [props.rightAddon] - Element shown inside the input on the right (e.g. "XAF").
 * @param {boolean} [props.required=false] - Marks the field as required.
 * @param {boolean} [props.hideLabel=false] - Keeps the label for screen readers only.
 * @param {string} [props.type='text'] - Input type.
 * @param {string} [props.id] - Id; generated when omitted.
 * @param {string} [props.className] - Extra classes for the outer wrapper.
 * @param {string} [props.inputClassName] - Extra classes for the <input>.
 * @returns {import('react').ReactElement} The labelled input.
 */
const Input = forwardRef(function Input(
  { label, hint, error, icon: Icon, rightAddon, required = false, hideLabel = false, type = 'text', id, className, inputClassName, disabled, ...rest },
  ref
) {
  const { t } = useTranslation();
  const generatedId = useId();
  const inputId = id || `hfa-input-${generatedId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && showPassword ? 'text' : type;
  const hasRightElement = isPassword || Boolean(rightAddon);

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className={cx('text-sm font-medium text-hfa-dark dark:text-hfa-gray-100', hideLabel && 'sr-only')}>
        {label}
        {required ? <span aria-hidden="true" className="ml-0.5 text-danger">*</span> : null}
      </label>

      <div className="relative">
        {Icon ? (
          <Icon aria-hidden="true" className={cx('pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2', error ? 'text-danger' : 'text-hfa-gray-500')} />
        ) : null}
        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          required={required}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          aria-required={required || undefined}
          className={cx(
            'block w-full min-h-touch rounded-input border bg-white px-3 py-2.5 text-base text-hfa-dark placeholder:text-hfa-gray-400',
            'transition-colors focus:outline-none focus:ring-4',
            'disabled:cursor-not-allowed disabled:bg-hfa-gray-100 disabled:text-hfa-gray-500',
            'dark:bg-surface-dark-raised dark:text-hfa-gray-100 dark:placeholder:text-hfa-gray-500',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/20'
              : 'border-hfa-gray-300 focus:border-primary focus:ring-primary/20 dark:border-hfa-gray-600',
            Icon && 'pl-10',
            hasRightElement && 'pr-12',
            inputClassName
          )}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword(value => !value)}
            disabled={disabled}
            aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
            aria-pressed={showPassword}
            aria-controls={inputId}
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-hfa-gray-500 hover:text-hfa-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:text-white"
          >
            {showPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
          </button>
        ) : rightAddon ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-hfa-gray-500">{rightAddon}</span>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? <p id={hintId} className="text-sm text-hfa-gray-500 dark:text-hfa-gray-400">{hint}</p> : null}
    </div>
  );
});

export default Input;
