import { MODULES, settingsModule } from '../modules/registry';
import { TAB_BAR_SLOTS, arrangeModules } from '../modules/arrange';
import type { AppModule } from '../modules/types';
import { getUi, setUi, useStore } from '../state/store';
import { GearIcon, MoreIcon, RightIcon } from '../ui/icons';
import { MORE_ROUTE, useRoute } from './router';
import { reloadForUpdate } from './updates';

function NavLink({ module, active }: { module: AppModule; active: boolean }) {
  const Icon = module.icon;
  return (
    <a href={`#/${module.id}`} aria-current={active ? 'page' : undefined}>
      <Icon />
      {module.navLabel}
    </a>
  );
}

function MoreScreen({ modules }: { modules: AppModule[] }) {
  return (
    <div class="more-grid">
      {modules.map((m) => {
        const Icon = m.icon;
        return (
          <a key={m.id} class="more-link" href={`#/${m.id}`}>
            <Icon class="lead" />
            <span class="grow"><strong>{m.title}</strong><span class="summary-sub">{m.description}</span></span>
            <RightIcon class="chev" />
          </a>
        );
      })}
    </div>
  );
}

function ToastHost() {
  const { ui } = useStore();
  const toast = ui.toast;
  // The live region stays mounted so screen readers announce each new message.
  return (
    <div aria-live="polite">
      {toast && (
        <div class="toast" key={toast.id}>
          <span>{toast.message}</span>
          {toast.undo && <button type="button" onClick={() => { const undo = getUi().toast?.undo; setUi({ toast: null }); undo?.(); }}>Undo</button>}
        </div>
      )}
    </div>
  );
}

export function App() {
  const { state, ui } = useStore();
  const route = useRoute();
  const visible = arrangeModules(MODULES, state.moduleOrder).filter((m) => !state.hiddenModules.includes(m.id));
  const tabs = visible.slice(0, TAB_BAR_SLOTS);
  const overflow = [...visible.slice(TAB_BAR_SLOTS), settingsModule];

  const isMore = route === MORE_ROUTE;
  const active = [...MODULES, settingsModule].find((m) => m.id === route) ?? (isMore ? null : visible[0] ?? settingsModule);
  const moreActive = isMore || (active !== null && !tabs.includes(active));
  const Screen = active?.component;

  return (
    <div class="frame">
      <nav class="rail" aria-label="Main">
        <div class="brand">Meal Planner</div>
        {visible.map((m) => <NavLink key={m.id} module={m} active={m === active} />)}
        <a href="#/settings" aria-current={active === settingsModule ? 'page' : undefined} style={{ marginTop: 'auto' }}><GearIcon />Settings</a>
      </nav>
      <div>
        <header class="topbar">
          <div>
            <h1>{active ? active.title : 'More'}</h1>
            {isMore && <div class="sub">All your tools</div>}
          </div>
        </header>
        <main class="content">
          {ui.loadError && <div class="notice danger" role="alert">{ui.loadError}</div>}
          {ui.updateReady && (
            <div class="notice info update-ready" role="status">
              <span>A new version of the planner is ready.</span>
              <button type="button" class="btn" onClick={reloadForUpdate}>Update now</button>
            </div>
          )}
          {ui.saveFailed && <div class="notice danger" role="alert">Changes can't be saved in this browser right now. Private Browsing or full storage can cause this. Save a backup before closing this page.</div>}
          {Screen ? <Screen key={active?.id} /> : <MoreScreen modules={overflow} />}
        </main>
      </div>
      <nav class="tabbar" aria-label="Main">
        {tabs.map((m) => <NavLink key={m.id} module={m} active={m === active} />)}
        <a href="#/more" aria-current={moreActive ? 'page' : undefined}><MoreIcon />More</a>
      </nav>
      <ToastHost />
    </div>
  );
}
