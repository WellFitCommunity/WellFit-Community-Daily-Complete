// Type declarations for individual lucide-react icon imports
// Enables tree-shaking while maintaining TypeScript support

declare module 'lucide-react/dist/esm/icons/*' {
  import { LucideIcon } from 'lucide-react';
  const icon: LucideIcon;
  export default icon;
}
