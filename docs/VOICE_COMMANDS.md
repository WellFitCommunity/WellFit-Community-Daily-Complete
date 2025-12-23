# Voice Command Infrastructure (ATLUS: Intuitive Technology)

The application includes **continuous global voice recognition** for healthcare workers, enabling hands-free navigation and actions throughout the platform.

## Voice Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `VoiceCommandBar` | `src/components/admin/VoiceCommandBar.tsx` | Global floating voice UI (rendered in App.tsx) |
| `VoiceCommandButton` | `src/components/voice/VoiceCommandButton.tsx` | Standalone floating "Hey Vision" button |
| `useVoiceCommand` | `src/hooks/useVoiceCommand.ts` | React hook for voice recognition |
| `voiceCommandService` | `src/services/voiceCommandService.ts` | "Hey Vision" wake word service |
| `workflowPreferences` | `src/services/workflowPreferences.ts` | Voice command registry (VOICE_COMMANDS array) |

## How Voice Works

1. **Global Availability**: `VoiceCommandBar` is rendered in `App.tsx` - available on ALL pages
2. **Keyboard Shortcut**: `Ctrl+Shift+V` toggles listening
3. **Wake Word**: Say "Hey Vision" to activate the VoiceCommandButton
4. **Command Matching**: Spoken phrases matched against `VOICE_COMMANDS` in `workflowPreferences.ts`

## Adding New Voice Commands

Add commands to `VOICE_COMMANDS` array in `src/services/workflowPreferences.ts`:

```typescript
{
  phrases: ['my command', 'alternative phrase'],
  targetType: 'route' | 'section' | 'category' | 'action',
  targetId: '/route-path' | 'section-id' | 'action:identifier',
  displayName: 'Human Readable Name',
}
```

### Target Types

| Type | Description | targetId Example |
|------|-------------|------------------|
| `route` | Navigate to a page | `/shift-handoff` |
| `section` | Scroll to section in admin panel | `section-id` |
| `category` | Expand/collapse category in admin panel | `category-id` |
| `action` | Custom action (handled by component) | `action:refresh` |

## Healthcare Voice Commands (Current)

| Command | Action |
|---------|--------|
| "Shift handoff" | Navigate to `/shift-handoff` |
| "Available beds" | Filter bed board to available |
| "High risk patients" | Filter to critical patients |
| "NeuroSuite" | Navigate to `/neuro-suite` |
| "Care coordination" | Navigate to `/care-coordination` |
| "Refresh beds" | Reload bed board data |

## Privacy/Pause Commands

Vision supports a **pause timer** for private discussions. Say "Hey Vision" followed by:

| Command | Action |
|---------|--------|
| "Pause for 5 minutes" | Stop listening for 5 min, then auto-resume |
| "Mute for 10 minutes" | Stop listening for 10 min, then auto-resume |
| "Privacy for 20 minutes" | Stop listening for 20 min, then auto-resume |
| "Pause 30 minutes" | Stop listening for 30 min, then auto-resume |
| "Resume" / "Unpause" | Resume listening early |

**Note:** Compass Riley (Smart Scribe) does NOT have pause - it uses explicit start/stop for patient encounters.

## Voice in Specific Dashboards

Some dashboards have **local voice commands** for context-specific actions:

### BedManagementPanel
- "Mark bed 205A ready"
- "Start cleaning room 302"

### ShiftHandoffDashboard
- "Accept all handoffs"
- "Escalate patient in room 101"

These are implemented directly in the component and work in addition to global commands.

## SmartScribe (Medical Transcription)

For real-time medical documentation, use **SmartScribe**:

| Aspect | Details |
|--------|---------|
| **Location** | `src/components/smart/RealTimeSmartScribe.tsx` |
| **Route** | `/smart-scribe` |
| **Features** | Real-time transcription, SOAP notes, CPT/ICD-10 suggestions |
| **Voice Commands** | "Start scribe", "Stop recording" |

## Browser Support

Voice recognition requires Web Speech API support:
- Chrome: Full support
- Edge: Full support
- Firefox: Limited support
- Safari: Partial support

## Security Considerations

- Voice data is processed locally (Web Speech API)
- No voice recordings are stored
- Commands only trigger UI actions, not data mutations
- HIPAA compliant - no PHI in voice commands
