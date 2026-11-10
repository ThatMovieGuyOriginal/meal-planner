import { render } from 'preact';
import { App } from './app/App';
import { startUpdates } from './app/updates';
import './ui/styles.css';

render(<App />, document.getElementById('app')!);
startUpdates();
