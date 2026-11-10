import { bodyModule } from './body';
import { exerciseModule } from './exercise';
import { foodsModule } from './foods';
import { mealsModule } from './meals';
import { prepModule } from './prep';
import { recipesModule } from './recipes';
import { createSettingsModule } from './settings';
import { targetsModule } from './targets';
import { timelineModule } from './timeline';
import { todayModule } from './today';
import type { AppModule } from './types';

/** Adding a tool: create its folder, then add it here. This is also the default order. */
export const MODULES: AppModule[] = [
  todayModule,
  mealsModule,
  exerciseModule,
  targetsModule,
  foodsModule,
  recipesModule,
  prepModule,
  bodyModule,
  timelineModule,
];

/** Always reachable, so she can never hide her way out of restoring a backup or the layout. */
export const settingsModule = createSettingsModule(() => MODULES);
