import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import { AlertCircle, Camera, CheckCircle2, ImagePlus, Loader2, RotateCcw, Trash2, User } from 'lucide-react';
import Button from './Button.jsx';
import { cx } from '../utils/cx.js';
import { useTranslation } from '../i18n/index.js';
import { AVATAR, COMPLETION, completionColor } from '../tokens.js';

/** Avatar diameter in pixels per size. */
const SIZES = { sm: 40, md: 64, lg: 96, xl: 128 };
/** Completion ring stroke width and gap between ring and photo, per size. */
const RING = { sm: { stroke: 3, gap: 2 }, md: { stroke: 4, gap: 3 }, lg: { stroke: 5, gap: 4 }, xl: { stroke: 6, gap: 4 } };
const INITIALS_TEXT = { sm: 'text-sm', md: 'text-xl', lg: 'text-3xl', xl: 'text-4xl' };
/** Camera badge diameter per size (no badge on `sm`). */
const BADGE = { md: 24, lg: 30, xl: 36 };
/** react-dropzone accept map built from the shared AVATAR rules. */
const ACCEPT = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] };
/** Honorifics skipped when building initials ("Dr. Ngo Biyong" → "NB"). */
const TITLES = /^(dr|pr|prof|mr|mrs|ms|mme|mlle)\.?$/i;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const clampPercent = value => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
const toMb = bytes => Math.round((bytes / (1024 * 1024)) * 10) / 10;
const extensionFor = type => (type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp');

/**
 * Builds up to two initials from a display name, skipping titles such as "Dr.".
 *
 * @param {string} name - Display name.
 * @returns {string} Upper-case initials, or '' when there is no usable name.
 */
export function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(part => part && !TITLES.test(part));
  if (!parts.length) return '';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/**
 * Maps a completion percentage to a tone: good (80–100, green), fair (50–79, amber), low (0–49, red).
 *
 * @param {number} percent - Profile completion percentage.
 * @returns {'good'|'fair'|'low'} The tone.
 */
export function completionTone(percent) {
  if (percent >= COMPLETION.good) return 'good';
  if (percent >= COMPLETION.fair) return 'fair';
  return 'low';
}

/**
 * Loads an image element from a URL.
 *
 * @param {string} url - Image URL (usually an object URL).
 * @returns {Promise<HTMLImageElement>} The loaded image.
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The image could not be read'));
    image.src = url;
  });
}

/**
 * Reads the pixel dimensions of an image file.
 *
 * @param {Blob} file - Image file.
 * @returns {Promise<{width: number, height: number}>} Natural width and height.
 */
export async function getImageDimensions(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    return { width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Client-side checks before cropping: type (JPG/PNG/WebP), size and minimum dimensions.
 * The server validates again; this only gives the user fast, clear feedback.
 *
 * @param {File} file - The chosen file.
 * @param {object} [options]
 * @param {number} [options.maxBytes=AVATAR.maxBytes] - Largest allowed file (2 MB for CHWs).
 * @param {number} [options.minDimension=AVATAR.minDimension] - Minimum width and height in pixels.
 * @param {(file: File) => Promise<{width: number, height: number}>} [options.readDimensions] - Dimension reader (replaceable in tests).
 * @returns {Promise<{ok: true, width: number, height: number} | {ok: false, error: {key: string, values?: object}}>} Result with an i18n error key.
 */
export async function validateAvatarFile(file, { maxBytes = AVATAR.maxBytes, minDimension = AVATAR.minDimension, readDimensions = getImageDimensions } = {}) {
  if (!file || !AVATAR.acceptedTypes.includes(file.type)) {
    return { ok: false, error: { key: 'avatar.errorWrongType' } };
  }
  if (file.size > maxBytes) {
    return { ok: false, error: { key: 'avatar.errorTooLarge', values: { maxMb: toMb(maxBytes) } } };
  }
  let dimensions;
  try {
    dimensions = await readDimensions(file);
  } catch {
    return { ok: false, error: { key: 'avatar.errorUnreadable' } };
  }
  if (dimensions.width < minDimension || dimensions.height < minDimension) {
    return { ok: false, error: { key: 'avatar.errorTooSmall', values: { min: minDimension } } };
  }
  return { ok: true, ...dimensions };
}

/**
 * Crops the selected area into a circle on a canvas (transparent corners).
 * Exports WebP; browsers that cannot encode WebP return PNG automatically.
 *
 * @param {string} imageSrc - Object URL of the source photo.
 * @param {{x: number, y: number, width: number, height: number}} area - Crop area in source pixels (from react-easy-crop).
 * @param {number} [outputSize=AVATAR.outputDimension] - Largest output edge in pixels.
 * @returns {Promise<Blob>} The circular image.
 */
export async function cropToCircle(imageSrc, area, outputSize = AVATAR.outputDimension) {
  const image = await loadImage(imageSrc);
  const size = Math.max(1, Math.min(outputSize, Math.round(area.width)));
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available');
  context.imageSmoothingQuality = 'high';
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  context.closePath();
  context.clip();
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('The photo could not be exported'))), 'image/webp', AVATAR.outputQuality);
  });
}

/**
 * Compresses the cropped photo to at most 800×800 at quality 0.85 (WebP where supported).
 *
 * @param {Blob} blob - Cropped image.
 * @param {object} [options]
 * @param {number} [options.maxBytes=AVATAR.maxBytes] - Upper bound for the output size.
 * @returns {Promise<File>} The compressed file, named avatar.webp (or .png on old browsers).
 */
export async function compressAvatar(blob, { maxBytes = AVATAR.maxBytes } = {}) {
  const type = blob.type || 'image/webp';
  const input = blob instanceof File ? blob : new File([blob], `avatar.${extensionFor(type)}`, { type });
  const compressed = await imageCompression(input, {
    maxSizeMB: maxBytes / (1024 * 1024),
    maxWidthOrHeight: AVATAR.outputDimension,
    initialQuality: AVATAR.outputQuality,
    fileType: 'image/webp',
    useWebWorker: true
  });
  const outputType = compressed.type || 'image/webp';
  return new File([compressed], `avatar.${extensionFor(outputType)}`, { type: outputType });
}

/**
 * Creates an `onUpload` function for <Avatar> that POSTs the photo to the User Service:
 * POST {apiBaseUrl}/api/v1/users/{userId}/avatar (multipart field "avatar").
 * Uses XMLHttpRequest because fetch cannot report upload progress.
 * Expects the HFA envelope { success, data: { avatarUrl }, message } and resolves with avatarUrl.
 *
 * @param {object} options
 * @param {string} options.apiBaseUrl - API gateway origin, e.g. https://api.healthyfutureafrica.org.
 * @param {string} options.userId - User whose avatar is being changed.
 * @param {() => (string|null|Promise<string|null>)} [options.getAccessToken] - Returns the current access token.
 * @param {string} [options.fieldName='avatar'] - Multipart field name.
 * @returns {(file: File, opts: {onProgress?: (percent: number) => void, signal?: AbortSignal}) => Promise<string>} The uploader.
 */
export function createAvatarUploader({ apiBaseUrl, userId, getAccessToken, fieldName = 'avatar' }) {
  const url = `${String(apiBaseUrl || '').replace(/\/+$/, '')}/api/v1/users/${encodeURIComponent(userId)}/avatar`;
  return async function uploadAvatar(file, { onProgress, signal } = {}) {
    const token = getAccessToken ? await getAccessToken() : null;
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Upload cancelled', 'AbortError'));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.withCredentials = true;
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.upload.onprogress = event => {
        if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        let body = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          body = null;
        }
        if (xhr.status >= 200 && xhr.status < 300 && body?.success && body.data?.avatarUrl) {
          if (onProgress) onProgress(100);
          resolve(body.data.avatarUrl);
        } else {
          const error = new Error(body?.message || `Avatar upload failed (HTTP ${xhr.status})`);
          error.status = xhr.status;
          reject(error);
        }
      };
      xhr.onerror = () => reject(new Error('Network error while uploading the avatar'));
      xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
      signal?.addEventListener('abort', () => xhr.abort(), { once: true });
      const form = new FormData();
      form.append(fieldName, file, file.name || 'avatar.webp');
      xhr.send(form);
    });
  };
}

/**
 * HFA avatar: circular profile picture with optional profile-completion ring and, when editable,
 * the full upload flow — drag & drop or click, camera capture on phones, client validation,
 * circular crop, compression to 800×800 WebP, upload progress, optimistic preview with rollback,
 * retry, and remove.
 *
 * @param {object} props
 * @param {string|null} [props.src] - Current avatar URL (signed CloudFront URL from the API).
 * @param {string} [props.name=''] - Person's name, used for alt text and initials.
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md'] - 40, 64, 96 or 128 pixels.
 * @param {number} [props.completion] - Profile completion (0–100). Shows the ring when provided.
 * @param {boolean} [props.editable=false] - Enables the upload flow.
 * @param {(file: File, opts: {onProgress: (percent: number) => void, signal: AbortSignal}) => Promise<string|void>} [props.onUpload] -
 *   Uploads the processed photo; reject to show the error and restore the previous photo.
 *   See createAvatarUploader(). Without it the photo is only previewed locally.
 * @param {() => Promise<void>} [props.onRemove] - Deletes the photo; shows "Remove photo" when provided.
 * @param {number} [props.maxSizeBytes=AVATAR.maxBytes] - 5 MB by default; pass AVATAR.chwMaxBytes (2 MB) in the CHW portal.
 * @param {number} [props.minDimension=AVATAR.minDimension] - Minimum width/height in pixels.
 * @param {boolean} [props.showActions] - Shows buttons, hints and status text (default: true for lg/xl).
 * @param {boolean} [props.showCompletionText] - Shows the "Profile 72% complete" text (default: same as showActions).
 * @param {string} [props.id] - Id for the clickable avatar.
 * @param {string} [props.className] - Extra classes for the wrapper.
 * @returns {import('react').ReactElement} The avatar.
 */
export default function Avatar({
  src,
  name = '',
  size = 'md',
  completion,
  editable = false,
  onUpload,
  onRemove,
  maxSizeBytes = AVATAR.maxBytes,
  minDimension = AVATAR.minDimension,
  showActions,
  showCompletionText,
  id,
  className
}) {
  const { t } = useTranslation();
  const baseId = useId();
  const avatarId = id || `hfa-avatar-${baseId}`;
  const requirementsId = `${avatarId}-requirements`;
  const titleId = `${avatarId}-crop-title`;
  const helpId = `${avatarId}-crop-help`;
  const zoomId = `${avatarId}-zoom`;

  const [localPreview, setLocalPreview] = useState(null); // optimistic object URL
  const [hidden, setHidden] = useState(false); // optimistic removal
  const [imageFailed, setImageFailed] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | processing | uploading | removing | success | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null); // { key, values, retry: 'upload' | 'remove' | null }
  const [announcement, setAnnouncement] = useState('');
  const [cropSource, setCropSource] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropArea, setCropArea] = useState(null);
  const [isTouchDevice] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  );

  const mountedRef = useRef(true);
  const abortRef = useRef(null);
  const pendingFileRef = useRef(null);
  const localPreviewRef = useRef(null);
  const cameraInputRef = useRef(null);
  const dialogRef = useRef(null);

  const px = SIZES[size] || SIZES.md;
  const ring = RING[size] || RING.md;
  const actionsVisible = showActions ?? (size === 'lg' || size === 'xl');
  const hasRing = typeof completion === 'number' && !Number.isNaN(completion);
  const percent = hasRing ? clampPercent(completion) : 0;
  const tone = completionTone(percent);
  const completionTextVisible = hasRing && (showCompletionText ?? actionsVisible);
  const busy = status === 'processing' || status === 'uploading' || status === 'removing';
  const maxMb = toMb(maxSizeBytes);
  const initials = getInitials(name);
  const displaySrc = hidden ? null : localPreview || src || null;
  const showImage = Boolean(displaySrc) && !imageFailed;

  /** Swaps the optimistic preview, revoking the previous object URL. */
  function replaceLocalPreview(url) {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = url;
    setLocalPreview(url);
  }

  // Cleanup on unmount: cancel any upload and free object URLs.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    };
  }, []);

  // When the parent passes a new src (e.g. the saved CloudFront URL), it replaces the optimistic state.
  useEffect(() => {
    replaceLocalPreview(null);
    setHidden(false);
  }, [src]);

  useEffect(() => {
    setImageFailed(false);
  }, [displaySrc]);

  // Crop dialog: lock page scroll, move focus into the dialog, restore focus on close.
  useEffect(() => {
    if (!cropSource) return undefined;
    const returnFocusTo = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      if (returnFocusTo && typeof returnFocusTo.focus === 'function') returnFocusTo.focus();
    };
  }, [cropSource]);

  function showError(key, values, retry = null) {
    setError({ key, values, retry });
    setStatus('error');
  }

  async function handleFile(file) {
    setError(null);
    setStatus('processing');
    const result = await validateAvatarFile(file, { maxBytes: maxSizeBytes, minDimension });
    if (!mountedRef.current) return;
    if (!result.ok) {
      showError(result.error.key, result.error.values);
      return;
    }
    setStatus('idle');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropArea(null);
    setCropSource(URL.createObjectURL(file));
  }

  function onDrop(accepted, rejections) {
    if (accepted.length) {
      handleFile(accepted[0]);
      return;
    }
    if (!rejections.length) return;
    const codes = rejections[0].errors.map(item => item.code);
    if (codes.includes('file-invalid-type')) showError('avatar.errorWrongType');
    else if (codes.includes('file-too-large')) showError('avatar.errorTooLarge', { maxMb });
    else handleFile(rejections[0].file); // several files dropped: use the first one
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: maxSizeBytes,
    multiple: false,
    disabled: !editable || busy || Boolean(cropSource),
    useFsAccessApi: false
  });

  function onCameraChange(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow picking the same file again
    if (file) handleFile(file);
  }

  function closeCrop() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
    setCropArea(null);
  }

  async function upload(file) {
    abortRef.current?.abort();
    replaceLocalPreview(URL.createObjectURL(file)); // optimistic: show the new photo immediately
    setHidden(false);
    setError(null);
    if (!onUpload) {
      setStatus('success');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    setStatus('uploading');
    setAnnouncement(t('avatar.uploading', { percent: 0 }));
    try {
      await onUpload(file, {
        onProgress: value => {
          if (mountedRef.current && !controller.signal.aborted) setProgress(clampPercent(value));
        },
        signal: controller.signal
      });
      if (!mountedRef.current || controller.signal.aborted) return;
      pendingFileRef.current = null;
      setProgress(100);
      setStatus('success');
      setAnnouncement(t('avatar.uploaded'));
    } catch {
      if (!mountedRef.current || controller.signal.aborted) return;
      replaceLocalPreview(null); // roll back to the previous photo
      showError('avatar.errorUploadFailed', undefined, 'upload');
    }
  }

  async function confirmCrop() {
    if (!cropSource || !cropArea) return;
    setError(null);
    setStatus('processing');
    setAnnouncement(t('avatar.processing'));
    let file;
    try {
      const circle = await cropToCircle(cropSource, cropArea);
      file = await compressAvatar(circle, { maxBytes: maxSizeBytes });
    } catch {
      if (!mountedRef.current) return;
      closeCrop();
      showError('avatar.errorUnreadable');
      return;
    }
    if (!mountedRef.current) return;
    closeCrop();
    pendingFileRef.current = file; // kept so "Retry" does not need the user to crop again
    upload(file);
  }

  async function remove() {
    if (!onRemove) return;
    abortRef.current?.abort();
    setError(null);
    setStatus('removing');
    setHidden(true); // optimistic
    try {
      await onRemove();
      if (!mountedRef.current) return;
      replaceLocalPreview(null);
      pendingFileRef.current = null;
      setStatus('success');
      setAnnouncement(t('avatar.removed'));
    } catch {
      if (!mountedRef.current) return;
      setHidden(false);
      showError('avatar.errorRemoveFailed', undefined, 'remove');
    }
  }

  function retry() {
    if (error?.retry === 'upload' && pendingFileRef.current) upload(pendingFileRef.current);
    else if (error?.retry === 'remove') remove();
  }

  function onDialogKeyDown(event) {
    if (event.key === 'Escape' && status !== 'processing') {
      event.stopPropagation();
      closeCrop();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    // Keep keyboard focus inside the dialog.
    const focusable = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // Ring geometry: the ring sits outside the photo with a small gap.
  const outer = hasRing ? px + 2 * (ring.stroke + ring.gap) : px;
  const radius = (outer - ring.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = (outer - px) / 2;
  const badge = BADGE[size];

  const imageLabel = name ? t('avatar.altFor', { name }) : t('avatar.label');
  const placeholderLabel = name ? t('avatar.placeholderFor', { name }) : t('avatar.label');
  const rootProps = editable
    ? getRootProps({
        role: 'button',
        'aria-label': `${displaySrc ? t('avatar.changePhoto') : t('avatar.choosePhoto')} — ${showImage ? imageLabel : placeholderLabel}`,
        'aria-describedby': actionsVisible ? requirementsId : undefined,
        'aria-disabled': busy || undefined
      })
    : {};

  return (
    <div className={cx('inline-flex flex-col items-center gap-3 text-center', className)}>
      <div className="relative shrink-0" style={{ width: outer, height: outer }}>
        {hasRing ? (
          <svg
            aria-hidden="true"
            data-testid="hfa-avatar-ring"
            data-tone={tone}
            width={outer}
            height={outer}
            viewBox={`0 0 ${outer} ${outer}`}
            className="absolute inset-0 -rotate-90"
          >
            <circle cx={outer / 2} cy={outer / 2} r={radius} fill="none" strokeWidth={ring.stroke} className="stroke-hfa-gray-200 dark:stroke-hfa-gray-700" />
            <circle
              cx={outer / 2}
              cy={outer / 2}
              r={radius}
              fill="none"
              stroke={completionColor(percent)}
              strokeWidth={ring.stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - percent / 100)}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>
        ) : null}

        <div
          id={avatarId}
          {...rootProps}
          className={cx(
            'absolute overflow-hidden rounded-full bg-hfa-gray-100 dark:bg-hfa-gray-800',
            editable && 'cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
            editable && busy && 'cursor-wait',
            isDragActive && 'ring-4 ring-highlight'
          )}
          style={{ width: px, height: px, top: offset, left: offset }}
        >
          {editable ? <input {...getInputProps()} data-testid="hfa-avatar-file-input" /> : null}

          {showImage ? (
            <img src={displaySrc} alt={editable ? '' : imageLabel} draggable={false} onError={() => setImageFailed(true)} className="h-full w-full object-cover" />
          ) : (
            <div
              role={editable ? undefined : 'img'}
              aria-label={editable ? undefined : placeholderLabel}
              className="flex h-full w-full select-none items-center justify-center bg-primary font-semibold text-white dark:bg-primary-500"
            >
              {initials ? (
                <span aria-hidden="true" className={INITIALS_TEXT[size] || INITIALS_TEXT.md}>{initials}</span>
              ) : (
                <User aria-hidden="true" className="h-1/2 w-1/2" />
              )}
            </div>
          )}

          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-hfa-dark/50">
              <Loader2 aria-hidden="true" className="h-1/3 w-1/3 animate-spin text-white" />
            </div>
          ) : null}

          {isDragActive ? (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/70 animate-hfa-fade-in">
              <ImagePlus aria-hidden="true" className="h-1/3 w-1/3 text-white" />
            </div>
          ) : null}
        </div>

        {editable && badge ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute flex items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-card dark:border-surface-dark-raised"
            style={{ width: badge, height: badge, right: offset - 2, bottom: offset - 2 }}
          >
            <Camera className="h-1/2 w-1/2" />
          </span>
        ) : null}
      </div>

      {isDragActive ? <p className="text-sm font-medium text-primary dark:text-primary-300">{t('avatar.dropActive')}</p> : null}

      {completionTextVisible ? (
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-sm font-semibold" style={{ color: completionColor(percent) }}>{t('profile.completion', { percent })}</p>
          <p className="text-xs text-hfa-gray-500 dark:text-hfa-gray-400">
            {tone === 'good' ? t('profile.completionGood') : tone === 'fair' ? t('profile.completionFair') : t('profile.completionLow')}
          </p>
        </div>
      ) : null}

      {status === 'processing' && !cropSource ? (
        <p className="flex items-center gap-1.5 text-sm text-hfa-gray-500 dark:text-hfa-gray-400">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {t('avatar.processing')}
        </p>
      ) : null}

      {status === 'uploading' ? (
        <div className="w-full min-w-[160px] max-w-[240px]">
          <div
            role="progressbar"
            aria-label={t('avatar.label')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 w-full overflow-hidden rounded-full bg-hfa-gray-200 dark:bg-hfa-gray-700"
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-hfa-gray-500 dark:text-hfa-gray-400">{t('avatar.uploading', { percent: progress })}</p>
        </div>
      ) : null}

      {status === 'success' && actionsVisible && announcement ? (
        <p className="flex items-center gap-1.5 text-sm text-primary dark:text-primary-300">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
          {announcement}
        </p>
      ) : null}

      {error ? (
        <div role="alert" className="flex max-w-xs flex-col items-center gap-2 rounded-input border border-danger/30 bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:bg-danger-900/30 dark:text-danger-200">
          <p className="flex items-start gap-1.5 text-left">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t(error.key, error.values)}</span>
          </p>
          {error.retry ? (
            <Button variant="ghost" size="sm" leftIcon={RotateCcw} onClick={retry}>
              {t('common.retry')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {editable && actionsVisible ? (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {isTouchDevice ? (
              <Button variant="secondary" size="sm" leftIcon={Camera} onClick={() => cameraInputRef.current?.click()} disabled={busy}>
                {t('avatar.takePhoto')}
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" leftIcon={ImagePlus} onClick={open} disabled={busy}>
              {displaySrc ? t('avatar.changePhoto') : t('avatar.choosePhoto')}
            </Button>
            {onRemove && displaySrc ? (
              <Button variant="ghost" size="sm" leftIcon={Trash2} onClick={remove} disabled={busy} className="text-danger hover:bg-danger-50 dark:text-danger-300 dark:hover:bg-danger-900/30">
                {t('avatar.removePhoto')}
              </Button>
            ) : null}
          </div>
          <p id={requirementsId} className="max-w-xs text-xs text-hfa-gray-500 dark:text-hfa-gray-400">
            <span className="hidden sm:inline">{t('avatar.dropHint')} · </span>
            {t('avatar.requirements', { maxMb })}
          </p>
        </>
      ) : null}

      {editable ? (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={onCameraChange}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="hfa-avatar-camera-input"
        />
      ) : null}

      <p aria-live="polite" className="sr-only">{announcement}</p>

      {cropSource && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-hfa-fade-in sm:items-center sm:p-4" onKeyDown={onDialogKeyDown}>
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={helpId}
                tabIndex={-1}
                className="w-full overflow-hidden rounded-t-card bg-white shadow-raised animate-hfa-slide-up focus:outline-none sm:max-w-md sm:rounded-card dark:bg-surface-dark-raised"
              >
                <div className="px-4 pt-4 sm:px-6">
                  <h2 id={titleId} className="text-lg font-semibold text-hfa-dark dark:text-white">{t('avatar.cropTitle')}</h2>
                  <p id={helpId} className="mt-1 text-sm text-hfa-gray-500 dark:text-hfa-gray-400">{t('avatar.cropHelp')}</p>
                </div>
                <div className="relative mt-4 h-72 w-full bg-hfa-dark sm:h-80">
                  <Cropper
                    image={cropSource}
                    crop={crop}
                    zoom={zoom}
                    minZoom={1}
                    maxZoom={3}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(_, pixels) => setCropArea(pixels)}
                  />
                </div>
                <div className="px-4 py-4 sm:px-6">
                  <label htmlFor={zoomId} className="text-sm font-medium text-hfa-dark dark:text-hfa-gray-100">{t('avatar.zoom')}</label>
                  <input
                    id={zoomId}
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={event => setZoom(Number(event.target.value))}
                    disabled={status === 'processing'}
                    className="mt-2 h-11 w-full cursor-pointer accent-primary"
                  />
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-hfa-gray-100 bg-hfa-light-bg px-4 py-3 sm:flex-row sm:justify-end sm:px-6 dark:border-hfa-gray-700 dark:bg-white/5">
                  <Button variant="secondary" onClick={closeCrop} disabled={status === 'processing'}>{t('common.cancel')}</Button>
                  <Button onClick={confirmCrop} loading={status === 'processing'} loadingText={t('avatar.processing')} disabled={!cropArea}>
                    {t('avatar.usePhoto')}
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
