# WellFit Community Daily

This is the official frontend for the WellFit senior wellness PWA app. It is designed to support daily engagement, health tracking, and well-being for senior users.

---

### 📦 Firebase Install Note (May 2025)

When adding Firebase to the project, we encountered a peer dependency conflict with `react-scripts@5.0.1` and `typescript@4.9.5`.

To resolve this safely and move forward, we used the following command:

```bash
npm install firebase --legacy-peer-deps
