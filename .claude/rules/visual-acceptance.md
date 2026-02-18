# Visual Acceptance Checkpoint - NO EXCEPTIONS

**No new UI component, 3D feature, or visual change is "done" until Maria has seen it rendered.**

AI cannot judge visual quality from code alone. SVG paths, 3D models, animations, and layout changes MUST be visually verified before being declared complete.

## Rules

1. **New visual features require a screenshot or screen recording** before the feature is considered accepted
2. **3D/WebGL assets must be verified as separated, named meshes** — if a downloaded model is one single mesh, it is not layerable and must be rejected
3. **Do NOT assume visual quality from code review** — a component that compiles and passes tests can still look terrible
4. **If you cannot show it, it is not done** — tell Maria what needs visual verification and let her check it in the browser

## Why This Rule Exists

AI models generate SVG paths, CSS layouts, and 3D configurations from code logic — but have no visual feedback loop. Code that compiles and passes all tests can still produce:
- Gingerbread-shaped body outlines instead of anatomical silhouettes
- Overlapping or misaligned UI elements
- Invisible components (zero opacity, off-screen positioning)
- Animations that look wrong despite correct parameters

The 30 seconds Maria spends glancing at the browser saves hours of rework from shipping visually broken features.
