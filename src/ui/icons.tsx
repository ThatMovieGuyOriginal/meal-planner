import type { ComponentChildren } from 'preact';

const Svg = ({ children, class: cls }: { children: ComponentChildren; class?: string }) => (
  <svg class={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export type IconProps = { class?: string };

export const HomeIcon = (p: IconProps) => <Svg {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></Svg>;
export const MealIcon = (p: IconProps) => <Svg {...p}><path d="M7 3v8a2 2 0 0 0 2 2v8" /><path d="M11 3v8a2 2 0 0 1-2 2" /><path d="M9 3v6" /><path d="M17 21v-7h-2V8c0-3 1-5 3-5v18" /></Svg>;
export const DumbbellIcon = (p: IconProps) => <Svg {...p}><path d="M6 7v10" /><path d="M3 9v6" /><path d="M18 7v10" /><path d="M21 9v6" /><path d="M6 12h12" /></Svg>;
export const TargetIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Svg>;
export const AppleIcon = (p: IconProps) => <Svg {...p}><path d="M12 7c-2-2-7-2-8 3-1 5 3 11 5 11 1 0 2-1 3-1s2 1 3 1c2 0 6-6 5-11-1-5-6-5-8-3z" /><path d="M12 7c0-2 1-4 3-4" /></Svg>;
export const ListIcon = (p: IconProps) => <Svg {...p}><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6l1 1 1.5-2" /><path d="M4 12l1 1 1.5-2" /><path d="M4 18l1 1 1.5-2" /></Svg>;
export const RulerIcon = (p: IconProps) => <Svg {...p}><path d="M3 16L16 3l5 5L8 21z" /><path d="M7 12l2 2" /><path d="M10 9l2 2" /><path d="M13 6l2 2" /></Svg>;
export const TrendIcon = (p: IconProps) => <Svg {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></Svg>;
export const GearIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Svg>;
export const MoreIcon = (p: IconProps) => <Svg {...p}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></Svg>;
export const UpIcon = (p: IconProps) => <Svg {...p}><path d="M6 15l6-6 6 6" /></Svg>;
export const DownIcon = (p: IconProps) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const RightIcon = (p: IconProps) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>;
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></Svg>;
export const PlusIcon = (p: IconProps) => <Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>;
export const TrashIcon = (p: IconProps) => <Svg {...p}><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></Svg>;
export const EditIcon = (p: IconProps) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></Svg>;
export const AlertIcon = (p: IconProps) => <Svg {...p}><path d="M12 4L2.5 20h19z" /><path d="M12 10v4" /><path d="M12 17v.5" /></Svg>;
export const InfoIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8v.5" /></Svg>;
