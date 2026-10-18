/**
 * @hfa/ui — shared component library for all six HFA portals.
 *
 *   import { Avatar, Button, Card, Input, I18nProvider, useTranslation } from '@hfa/ui';
 */

// Components
export {
  default as Avatar,
  createAvatarUploader,
  validateAvatarFile,
  cropToCircle,
  compressAvatar,
  getImageDimensions,
  getInitials,
  completionTone
} from './components/Avatar.jsx';
export { default as Button } from './components/Button.jsx';
export { default as Input } from './components/Input.jsx';
export { default as Card, CardHeader, CardBody, CardFooter } from './components/Card.jsx';

// Design tokens
export { colors, semantic, spacing, radii, shadows, fonts, breakpoints, AVATAR, COMPLETION, completionColor } from './tokens.js';
export { default as tokens } from './tokens.js';

// Internationalisation
export { I18nProvider, useTranslation, createTranslator, messages, SUPPORTED_LANGUAGES } from './i18n/index.js';
export { default as en } from './i18n/en.js';
export { default as fr } from './i18n/fr.js';

// Utilities
export { cx } from './utils/cx.js';
