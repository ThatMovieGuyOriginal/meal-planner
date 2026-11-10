import { useState } from 'preact/hooks';
import { filterFoods, foodCategories, foodWeight } from '../../domain/foods';
import { countFoodUses, removeFoodEverywhere } from '../../domain/plan';
import { fmt, one } from '../../domain/format';
import { prepInfo } from '../../domain/prep';
import { countRecipesUsing, removeIngredientEverywhere } from '../../domain/recipes';
import type { Food } from '../../domain/types';
import { getAllFoods, updateWithUndo, useStore } from '../../state/store';
import { ConfirmSheet, Card, Field, Select, TextInput } from '../../ui/components';
import { AppleIcon, EditIcon, PlusIcon, TrashIcon } from '../../ui/icons';
import { AddToMealSheet, FoodFormSheet, YieldSheet } from '../../ui/shared';
import { RecipeEditorSheet } from '../recipes/editor';
import type { AppModule } from '../types';

function FoodsScreen() {
  const { state } = useStore();
  const foods = getAllFoods();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [adding, setAdding] = useState<Food | null>(null);
  const [yieldFor, setYieldFor] = useState<Food | null>(null);
  const [form, setForm] = useState<Food | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Food | null>(null);
  const [recipe, setRecipe] = useState<string | null>(null);
  const shown = filterFoods(foods, query, category);
  const categories = foodCategories(foods);

  return (
    <>
      <Card title="Food library" action={<span class="tiny">{shown.length} food{shown.length === 1 ? '' : 's'}</span>}>
        <div class="form-grid">
          <Field label="Search"><TextInput type="search" value={query} onValue={setQuery} placeholder="Egg, rice, chicken…" /></Field>
          <Field label="Category"><Select value={categories.includes(category) ? category : 'All'} onValue={setCategory} options={categories.map((c) => ({ value: c, label: c }))} /></Field>
        </div>
        <button type="button" class="btn block" onClick={() => setForm('new')}><PlusIcon /> Add your own food</button>
        <div class="list">
          {shown.map((f) => {
            const w = foodWeight(f, state.yieldOverrides);
            return (
              <div class="list-row" key={f.id}>
                <div>
                  <b>{f.name}</b>
                  <div class="tiny">{f.serving} · {fmt(f.kcal)} kcal · P {one(f.p)}g · C {one(f.c)}g · F {one(f.f)}g</div>
                  {w.g ? <div class="tiny">{prepInfo(f, 1, state.yieldOverrides).primary}</div> : null}
                </div>
                <div class="row-actions">
                  {w.stage === 'cooked' && <button type="button" class="btn subtle" aria-label={`Cooking yield for ${f.name}`} onClick={() => setYieldFor(f)}>Yield</button>}
                  {f.custom && <button type="button" class="icon-btn" aria-label={`Edit ${f.name}`} onClick={() => setForm(f)}><EditIcon /></button>}
                  {f.recipe && <button type="button" class="icon-btn" aria-label={`Edit recipe ${f.name}`} onClick={() => setRecipe(f.id)}><EditIcon /></button>}
                  {f.custom && <button type="button" class="icon-btn danger" aria-label={`Delete ${f.name}`} onClick={() => setDeleting(f)}><TrashIcon /></button>}
                  <button type="button" class="btn" aria-label={`Add ${f.name} to a meal`} onClick={() => setAdding(f)}><PlusIcon /></button>
                </div>
              </div>
            );
          })}
          {!shown.length && <div class="empty">No foods match. Add it as your own food above.</div>}
        </div>
      </Card>
      <p class="tiny" style={{ padding: '0 4px' }}>Approximate USDA FoodData Central reference values. Sources are listed in Settings.</p>
      {adding && <AddToMealSheet food={adding} onClose={() => setAdding(null)} />}
      {yieldFor && <YieldSheet food={yieldFor} onClose={() => setYieldFor(null)} />}
      {recipe && <RecipeEditorSheet recipeId={recipe} onClose={() => setRecipe(null)} />}
      {form && <FoodFormSheet food={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {deleting && (
        <ConfirmSheet
          title={`Delete ${deleting.name}?`}
          message={(() => {
            const uses = countFoodUses(state.plan, deleting.id);
            const inRecipes = countRecipesUsing(state.recipes, deleting.id);
            const parts = [uses && `${uses} planned meal${uses === 1 ? '' : 's'}`, inRecipes && `${inRecipes} recipe${inRecipes === 1 ? '' : 's'}`].filter(Boolean);
            return parts.length ? `It's in ${parts.join(' and ')} and will be removed from them. You can undo this straight afterwards.` : 'You can undo this straight afterwards.';
          })()}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            const id = deleting.id;
            updateWithUndo((s) => {
              const yieldOverrides = { ...s.yieldOverrides };
              delete yieldOverrides[id];
              return { ...s, customFoods: s.customFoods.filter((x) => x.id !== id), recipes: removeIngredientEverywhere(s.recipes, id), plan: removeFoodEverywhere(s.plan, id), yieldOverrides };
            }, `Deleted ${deleting.name}`);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

export const foodsModule: AppModule = {
  id: 'foods',
  title: 'Foods',
  navLabel: 'Foods',
  description: 'Browse foods and recipes, add your own, edit or delete them, and adjust cooking yields.',
  icon: AppleIcon,
  component: FoodsScreen,
};
