/**
 * Joins CSS class names, skipping empty values, so components can write
 *   cx('base', isActive && 'active', className)
 * without stray "false" or "undefined" classes.
 *
 * @param {...(string|false|null|undefined)} classes - Class names or falsy values.
 * @returns {string} A single space-separated class string.
 */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default cx;
