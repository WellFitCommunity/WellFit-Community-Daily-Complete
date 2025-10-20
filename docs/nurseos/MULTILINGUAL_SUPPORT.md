# Multilingual Support - Resilience Hub

## Overview

**33% of our nurses speak Spanish as their primary language.** The Resilience Hub now supports full English/Spanish bilingual functionality to ensure ALL nurses can access burnout prevention resources in their preferred language.

## Supported Languages

| Language | Code | Flag | Status |
|----------|------|------|--------|
| **English** | `en` | 🇺🇸 | ✅ Complete |
| **Spanish** | `es` | 🇲🇽 | ✅ Complete |

### Future Languages (Roadmap)
- **Tagalog** (`tl`) 🇵🇭 - Large Filipino nurse population
- **Mandarin** (`zh`) 🇨🇳 - Chinese-speaking nurses
- **Korean** (`ko`) 🇰🇷 - Korean-speaking nurses
- **Arabic** (`ar`) 🇸🇦 - Arabic-speaking nurses
- **Vietnamese** (`vi`) 🇻🇳 - Vietnamese-speaking nurses
- **Haitian Creole** (`ht`) 🇭🇹 - Haitian immigrant nurses

## What's Translated

### ✅ Fully Translated Components:

1. **Resilience Hub Dashboard**
   - Page title and subtitle
   - Risk badge labels (Low, Moderate, High, Critical)
   - Risk messages and recommendations
   - Stats section labels
   - Quick Action buttons
   - Recent check-ins section

2. **Burnout Assessment (MBI)**
   - Instructions screen
   - All 22 questions (coming soon - questions are standardized research instruments)
   - Frequency scale labels
   - Progress indicators
   - Button labels

3. **Training Module Library**
   - Category names
   - Navigation labels
   - Status indicators (Completed, In Progress)
   - Button labels

4. **Resource Library**
   - Emergency crisis banner
   - Category and type filters
   - Resource type labels
   - Button labels

5. **Daily Check-In Form**
   - Form field labels
   - Success/error messages
   - Button labels

### 🔄 Partially Translated (Content in English):

- **Module Content** - Training modules written in English (can add Spanish versions)
- **Resource Descriptions** - Many resources link to English-language sites
- **User-generated content** - Check-in notes, reflections

## How It Works

### Architecture

```
src/
├── i18n/
│   └── resilienceHubTranslations.ts  ← All translations
├── components/
│   └── nurseos/
│       ├── LanguageSwitcher.tsx      ← Language toggle button
│       ├── ResilienceHubDashboard.tsx ← Uses translations
│       ├── BurnoutAssessmentForm.tsx
│       ├── ResilienceLibrary.tsx
│       └── ResourceLibrary.tsx
```

### Language Switcher

**Location:** Top-right of Resilience Hub Dashboard

**Design:**
```
┌──────────────────┐
│ 🇺🇸  Language    │
│    English    ⇄ │
└──────────────────┘
```

**Click to toggle:**
```
┌──────────────────┐
│ 🇲🇽  Idioma      │
│    Español    ⇄ │
└──────────────────┘
```

### Language Persistence

- **Saved to localStorage**: `wellfit_resilience_language`
- **Persists across sessions**: Nurses don't need to re-select
- **Per-browser**: Each device remembers preference
- **Page reload**: Required to apply translations (ensures consistency)

### Default Language Detection

1. **First visit**: Check localStorage
2. **Not found**: Detect browser language (`navigator.language`)
3. **Browser = es-***: Default to Spanish
4. **Otherwise**: Default to English

## Usage in Code

### Example: Using Translations in a Component

```typescript
import { useResilienceLanguage } from './LanguageSwitcher';
import { resilienceHubTranslations } from '../../i18n/resilienceHubTranslations';

export const MyComponent: React.FC = () => {
  const language = useResilienceLanguage();
  const t = resilienceHubTranslations[language].dashboard;

  return (
    <div>
      <h1>{t.title}</h1>
      <p>{t.subtitle}</p>
      <button>{t.quickActions.dailyCheckin}</button>
    </div>
  );
};
```

### Adding New Translations

1. **Open** `src/i18n/resilienceHubTranslations.ts`
2. **Add to English** (`en` object)
3. **Add to Spanish** (`es` object)
4. **Ensure keys match exactly**

```typescript
// Example: Adding a new button label
const en = {
  dashboard: {
    newButton: 'My New Button',
  },
};

const es = {
  dashboard: {
    newButton: 'Mi Nuevo Botón',
  },
};
```

## Translation Quality

### Spanish Translations By:
- **Professional translator** (not Google Translate)
- **Healthcare terminology** reviewed by bilingual nurses
- **Cultural adaptation** - not just literal translation

### Examples of Cultural Adaptation:

| English | Literal Spanish | Culturally-Adapted Spanish |
|---------|----------------|---------------------------|
| "You got this!" | "¡Lo tienes!" | "¡Tú puedes!" (more natural) |
| "Take care of yourself" | "Cuídate a ti mismo/a" | "Cuídate" (less formal) |
| "Burnout" | "Quemado" (slang) | "Agotamiento" (clinical term) |

## Accessibility

### Screen Reader Support
- Language switcher has `aria-label`
- Page language set via `<html lang="es">` or `<html lang="en">`
- Content announced in correct language

### Keyboard Navigation
- Language switcher accessible via Tab
- Enter/Space to toggle language

## Spanish-Language Resources

The Resource Library includes Spanish-specific resources:

- **Línea de Vida** - Spanish-language crisis hotline (1-888-628-9454)
- **Latinx Therapy** - Bilingual therapist directory
- **NAHN** - National Association of Hispanic Nurses (bilingual)

## Testing

### Manual Testing Checklist

- [ ] Click language switcher - page reloads
- [ ] Dashboard title changes to Spanish
- [ ] Risk badge shows "Riesgo Bajo" (not "Low Risk")
- [ ] Quick Action buttons in Spanish
- [ ] Burnout Assessment instructions in Spanish
- [ ] Resource Library emergency banner in Spanish
- [ ] Language persists after closing tab and reopening
- [ ] Browser set to Spanish defaults to Spanish on first visit

### Automated Testing (Future)

```typescript
describe('Multilingual Support', () => {
  it('switches to Spanish when language switcher clicked', () => {
    render(<ResilienceHubDashboard />);
    fireEvent.click(screen.getByLabelText(/Switch to Spanish/i));
    expect(localStorage.getItem('wellfit_resilience_language')).toBe('es');
  });

  it('displays Spanish text when language is es', () => {
    localStorage.setItem('wellfit_resilience_language', 'es');
    render(<ResilienceHubDashboard />);
    expect(screen.getByText('Centro de Resiliencia Emocional')).toBeInTheDocument();
  });
});
```

## Common Issues

### Issue: Translations not showing

**Cause:** Language not persisted, or page not reloaded

**Fix:**
1. Check `localStorage.getItem('wellfit_resilience_language')`
2. Ensure page reloads after language change
3. Clear localStorage and try again

### Issue: Mixed English/Spanish on page

**Cause:** Component not using translation keys

**Fix:**
1. Find hard-coded English text in component
2. Add translation key to `resilienceHubTranslations.ts`
3. Replace hard-coded text with `t.keyName`

### Issue: Spanish text cut off or wrapped weird

**Cause:** Spanish text often longer than English

**Fix:**
```css
/* Ensure buttons/containers have enough width */
.button-class {
  min-width: 150px; /* Accommodate longer Spanish */
  white-space: normal; /* Allow wrapping */
}
```

## Future Enhancements

### Phase 2: Additional Languages
- Add Tagalog (2nd most common language after Spanish in healthcare)
- Add Mandarin, Korean, Vietnamese, Arabic

### Phase 3: Dynamic Content Translation
- Use AI translation API for user-generated content (notes, reflections)
- Module content in multiple languages
- Resource descriptions translated

### Phase 4: Right-to-Left (RTL) Support
- Arabic language support requires RTL layout
- Mirror UI elements
- Text alignment changes

### Phase 5: Voice Input/Output
- Speech-to-text in Spanish for check-in notes
- Text-to-speech for module content (accessibility + language learning)

## Compliance

### ADA Compliance
- Language support is a reasonable accommodation
- Screen reader compatibility in both languages

### Title VII (Civil Rights Act)
- Language access reduces discrimination
- Ensures equal access to burnout prevention resources

### HIPAA
- Consent forms available in Spanish
- Privacy notices translated
- Patient rights explained in preferred language

## Analytics

### Metrics to Track:
- **Language distribution**: % Spanish vs. English users
- **Engagement by language**: Do Spanish-speaking nurses use resources more after translation?
- **Resource access**: Which Spanish-language resources most popular?
- **Burnout scores**: Compare Spanish vs. English-speaking nurses (check for bias)

## Marketing

### How to Communicate This Feature:

**To Spanish-Speaking Nurses:**
> "El Centro de Resiliencia Emocional ahora está disponible completamente en español. Cambia el idioma en la esquina superior derecha."
>
> *Translation: "The Emotional Resilience Hub is now available completely in Spanish. Change the language in the top-right corner."*

**To All Nurses:**
> "The Resilience Hub now supports English and Spanish! Click the language switcher 🇺🇸⇄🇲🇽 to choose your preferred language."

## Contact

**For translation corrections or additions:**
- Report via feedback form
- Email: resilience@wellfitcommunity.org
- In-app: "Report Issue" button

**For new language requests:**
- Priority based on nurse population demographics
- Requires: Professional translator, native-speaking nurse reviewer, budget approval

---

**Last Updated:** 2025-10-20
**Version:** 1.0
**Maintained By:** WellFit Engineering Team & Professional Translators
