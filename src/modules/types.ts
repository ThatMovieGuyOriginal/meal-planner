import type { ComponentType } from 'preact';
import type { IconProps } from '../ui/icons';

/**
 * One self-contained tool in the app. To add a new one: make a folder in src/modules,
 * export one of these from it, and add it to MODULES in registry.ts. Navigation, the More
 * screen and the Arrange screen pick it up automatically.
 */
export interface AppModule {
  id: string;
  title: string;
  /** Short name for the tab bar. */
  navLabel: string;
  description: string;
  icon: ComponentType<IconProps>;
  component: ComponentType;
}
