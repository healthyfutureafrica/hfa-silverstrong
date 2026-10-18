import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Mail } from 'lucide-react';
import {
  Avatar,
  Button,
  Card,
  Input,
  I18nProvider,
  createTranslator,
  completionColor,
  completionTone,
  getInitials,
  validateAvatarFile,
  colors,
  en,
  fr
} from '../index.js';

/** Collects every dotted key in a nested catalogue. */
function keysOf(catalogue, prefix = '') {
  return Object.entries(catalogue).flatMap(([key, value]) =>
    value && typeof value === 'object' ? keysOf(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  );
}

describe('i18n', () => {
  it('has exactly the same keys in English and French', () => {
    expect(keysOf(fr).sort()).toEqual(keysOf(en).sort());
  });

  it('interpolates values and falls back to the key', () => {
    const t = createTranslator('fr');
    expect(t('avatar.errorTooSmall', { min: 200 })).toBe('Cette photo est trop petite. Elle doit faire au moins 200×200 pixels.');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('deep-merges portal strings without losing shared ones', () => {
    const t = createTranslator('en', { en: { common: { bookNow: 'Book now' } } });
    expect(t('common.bookNow')).toBe('Book now');
    expect(t('common.save')).toBe('Save');
  });
});

describe('Button', () => {
  it('renders each variant and defaults to type="button"', () => {
    for (const variant of ['primary', 'secondary', 'danger', 'ghost']) {
      render(<Button variant={variant}>{variant}</Button>);
      const button = screen.getByRole('button', { name: variant });
      expect(button).toHaveAttribute('type', 'button');
      expect(button.className).toContain('rounded-button');
    }
  });

  it('is disabled and busy while loading', async () => {
    const onClick = vi.fn();
    render(<Button loading loadingText="Saving…" onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Input', () => {
  it('links the label, hint and error for screen readers', () => {
    render(<Input label="Email" icon={Mail} hint="We never share it" error="Enter a valid email address" required />);
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    const describedBy = input.getAttribute('aria-describedby').split(' ');
    expect(describedBy).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
    expect(document.getElementById(describedBy[1])).toHaveTextContent('We never share it');
  });

  it('toggles password visibility in the current language', async () => {
    render(
      <I18nProvider language="fr">
        <Input label="Mot de passe" type="password" />
      </I18nProvider>
    );
    const input = screen.getByLabelText('Mot de passe');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Masquer le mot de passe' })).toBeInTheDocument();
  });
});

describe('Card', () => {
  it('renders header, body and footer slots', () => {
    render(
      <Card>
        <Card.Header title="Vital Health Card" subtitle="Updated today" actions={<Button>Edit</Button>} />
        <Card.Body>Blood group O+</Card.Body>
        <Card.Footer>
          <Button variant="secondary">Share</Button>
        </Card.Footer>
      </Card>
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Vital Health Card' })).toBeInTheDocument();
    expect(screen.getByText('Updated today')).toBeInTheDocument();
    expect(screen.getByText('Blood group O+')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' }).closest('footer')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' }).closest('header')).not.toBeNull();
  });
});

describe('Avatar helpers', () => {
  it('builds initials and skips titles', () => {
    expect(getInitials('Dr. Ngo Biyong Marie')).toBe('NM');
    expect(getInitials('amina')).toBe('A');
    expect(getInitials('   ')).toBe('');
  });

  it('colours the completion ring green, amber and red', () => {
    expect([completionTone(100), completionTone(80), completionTone(79), completionTone(50), completionTone(49), completionTone(0)])
      .toEqual(['good', 'good', 'fair', 'fair', 'low', 'low']);
    expect(completionColor(85)).toBe(colors.green[600]);
    expect(completionColor(60)).toBe(colors.amber[600]);
    expect(completionColor(20)).toBe(colors.red[600]);
  });

  it('validates type, size and minimum dimensions', async () => {
    const jpeg = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
    const gif = new File(['x'], 'me.gif', { type: 'image/gif' });
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 3 * 1024 * 1024 });

    expect(await validateAvatarFile(gif)).toEqual({ ok: false, error: { key: 'avatar.errorWrongType' } });
    expect(await validateAvatarFile(big, { maxBytes: 2 * 1024 * 1024 })).toEqual({ ok: false, error: { key: 'avatar.errorTooLarge', values: { maxMb: 2 } } });
    expect(await validateAvatarFile(jpeg, { readDimensions: async () => ({ width: 199, height: 400 }) }))
      .toEqual({ ok: false, error: { key: 'avatar.errorTooSmall', values: { min: 200 } } });
    expect(await validateAvatarFile(jpeg, { readDimensions: async () => { throw new Error('bad'); } }))
      .toEqual({ ok: false, error: { key: 'avatar.errorUnreadable' } });
    expect(await validateAvatarFile(jpeg, { readDimensions: async () => ({ width: 640, height: 480 }) }))
      .toEqual({ ok: true, width: 640, height: 480 });
  });
});

describe('Avatar', () => {
  it('shows initials when there is no photo', () => {
    render(<Avatar name="Amina Njoya" />);
    expect(screen.getByRole('img', { name: 'No profile picture for Amina Njoya' })).toHaveTextContent('AN');
  });

  it('shows the photo with alt text and the completion ring', () => {
    render(<Avatar name="Amina Njoya" src="https://cdn.example/a.webp" size="xl" completion={72} />);
    expect(screen.getByRole('img', { name: 'Profile picture of Amina Njoya' })).toHaveAttribute('src', 'https://cdn.example/a.webp');
    expect(screen.getByTestId('hfa-avatar-ring')).toHaveAttribute('data-tone', 'fair');
    expect(screen.getByText('Profile 72% complete')).toBeInTheDocument();
  });

  it('rejects a wrong file type with a clear error', async () => {
    render(<Avatar name="Amina Njoya" size="xl" editable onUpload={vi.fn()} />);
    const input = screen.getByTestId('hfa-avatar-file-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'scan.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('This file type is not supported. Please choose a JPG, PNG or WebP photo.');
  });

  it('rejects a photo over the CHW 2 MB limit in French', async () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 });
    render(
      <I18nProvider language="fr">
        <Avatar name="Paul Etoga" size="xl" editable maxSizeBytes={2 * 1024 * 1024} onUpload={vi.fn()} />
      </I18nProvider>
    );
    fireEvent.change(screen.getByTestId('hfa-avatar-file-input'), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette photo est trop lourde. La taille maximale est de 2 Mo.');
  });

  it('offers choose and remove actions when editable', () => {
    render(<Avatar name="Amina Njoya" src="https://cdn.example/a.webp" size="lg" editable onUpload={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove photo' })).toBeInTheDocument();
    expect(screen.getByText(/at least 200×200 pixels/)).toBeInTheDocument();
  });

  it('removes optimistically and rolls back with retry when removal fails', async () => {
    const onRemove = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce();
    render(<Avatar name="Amina Njoya" src="https://cdn.example/a.webp" size="lg" editable onUpload={vi.fn()} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The photo could not be removed. Please try again.');
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/a.webp');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRemove).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Profile picture removed', { selector: 'p:not(.sr-only)' })).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
