// src/components/admin/ApiKeyManager/ClipboardUtils.ts
//
// Clipboard helpers extracted from the ApiKeyManager component.

import type { AddToast } from './types';

// `window.gtag` is declared globally in `src/custom.d.ts`.

// Control-character range: C0 controls (U+0000–U+001F), DEL (U+007F), and
// C1 controls (U+0080–U+009F). Built from a string source to avoid having
// non-printable bytes in the file itself.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');

/**
 * Strip ASCII / Latin-1 control characters to prevent code-injection style
 * payloads riding inside text that gets pasted somewhere sensitive.
 */
function sanitize(text: string): string {
  return text.replace(CONTROL_CHAR_RE, '');
}

interface CopyOptions {
  /** Toast emitter — required so we can surface success/failure to the user. */
  addToast: AddToast;
  /**
   * Optional callback to auto-mask the freshly-generated key shortly after
   * the user copies it. Only invoked when `label === 'API Key'`.
   */
  onMaskKey?: () => void;
}

/**
 * Copy `text` to the system clipboard with a modern -> legacy fallback chain.
 *
 * - Tries `navigator.clipboard.writeText` first.
 * - Falls back to `document.execCommand('copy')` on a hidden textarea.
 * - Emits success/error toasts via the provided `addToast`.
 * - For the special "API Key" label, schedules an auto-mask after 500ms.
 */
export async function copyToClipboard(
  text: string,
  label: string = 'API Key',
  options: CopyOptions,
): Promise<void> {
  const { addToast, onMaskKey } = options;

  if (!text || typeof text !== 'string') {
    addToast('error', 'Cannot copy empty value');
    return;
  }

  try {
    if (!navigator.clipboard) {
      throw new Error('Clipboard API not supported');
    }

    const sanitizedText = sanitize(text);
    await navigator.clipboard.writeText(sanitizedText);

    addToast('success', `${label} copied to clipboard!`);

    // Track copy action for analytics - DO NOT send key metadata
    if (typeof window !== 'undefined' && window.gtag && label !== 'API Key') {
      window.gtag('event', 'copy_action', {
        item_type: label,
      });
    }

    // Auto-mask immediately after copy for security
    if (label === 'API Key' && onMaskKey) {
      setTimeout(() => {
        onMaskKey();
      }, 500);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Try legacy execCommand as fallback
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.setAttribute('aria-hidden', 'true');
      document.body.appendChild(textArea);
      textArea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (ok) {
        addToast('success', `${label} copied to clipboard (legacy method)`);
        return;
      }
    } catch {
      // Fall through to the user-visible error toast below.
    }

    addToast('error', `Failed to copy: ${errorMessage}. Please copy manually.`);
  }
}
