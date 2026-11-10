import { useState } from 'preact/hooks';
import { gw } from '../../domain/format';
import { portionWeight, sortRecipes } from '../../domain/recipes';
import type { Food } from '../../domain/types';
import { getFoodMap, useStore } from '../../state/store';
import { Card, Field, TextInput } from '../../ui/components';
import { EditIcon, PlusIcon, PotIcon } from '../../ui/icons';
import { AddToMealSheet, macrosLine } from '../../ui/shared';
import type { AppModule } from '../types';
import { RecipeEditorSheet } from './editor';

function RecipesScreen() {
  const { state } = useStore();
  const foods = getFoodMap();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [adding, setAdding] = useState<Food | null>(null);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const recipes = sortRecipes(state.recipes).filter((r) => r.name.toLowerCase().includes(q));
  const count = state.recipes.length;

  return (
    <>
      <Card title="Recipes" action={<span class="tiny">{count} recipe{count === 1 ? '' : 's'}</span>}>
        <p class="note">Combine foods into a recipe, say how many portions it makes, and plan it by the portion like any other food. You can also save a planned meal as a recipe from the Meals screen.</p>
        {count > 6 && <Field label="Search"><TextInput type="search" value={query} onValue={setQuery} placeholder="Recipe name" /></Field>}
        <button type="button" class="btn primary block" onClick={() => setEditing('new')}><PlusIcon /> New recipe</button>
        <div class="list">
          {recipes.map((r) => {
            const food = foods.get(r.id);
            if (!food) return null;
            return (
              <div class="list-row" key={r.id}>
                <div>
                  <b>{r.name}</b>
                  <div class="tiny">{r.portions} portion{r.portions === 1 ? '' : 's'} · {r.ingredients.length} ingredient{r.ingredients.length === 1 ? '' : 's'}{portionWeight(r) ? ` · ${gw(portionWeight(r))} g each` : ''}</div>
                  {r.ingredients.length
                    ? <div class="tiny">Per portion: {macrosLine(food, 1)}</div>
                    : <div class="tiny over-label">No ingredients left. Edit it to add some.</div>}
                </div>
                <div class="row-actions">
                  <button type="button" class="icon-btn" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r.id)}><EditIcon /></button>
                  <button type="button" class="btn" aria-label={`Add ${r.name} to a meal`} onClick={() => setAdding(food)}><PlusIcon /></button>
                </div>
              </div>
            );
          })}
          {!count && <div class="empty">No recipes yet. Start one above.</div>}
          {count > 0 && !recipes.length && <div class="empty">No recipes match.</div>}
        </div>
      </Card>
      {editing && <RecipeEditorSheet recipeId={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {adding && <AddToMealSheet food={adding} onClose={() => setAdding(null)} />}
    </>
  );
}

export const recipesModule: AppModule = {
  id: 'recipes',
  title: 'Recipes',
  navLabel: 'Recipes',
  description: 'Build recipes from your foods, see their totals and plan them by the portion.',
  icon: PotIcon,
  component: RecipesScreen,
};
