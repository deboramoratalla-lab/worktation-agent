import { scenarios, type ScenarioId } from './data';

export function loadScenario(id: unknown) {
  const key = (typeof id === 'string' && id in scenarios ? id : 'ready') as ScenarioId;
  return scenarios[key].build();
}
