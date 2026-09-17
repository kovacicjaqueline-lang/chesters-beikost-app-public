import fs from "node:fs";
import vm from "node:vm";

const context = vm.createContext({ console });
for (const file of ["data/recipes.js", "data/recipe-preparation-overrides.js", "js/recipes.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}
vm.runInContext("installRecipePreparationOverrides(RECIPES)", context);
const recipes = JSON.parse(vm.runInContext("JSON.stringify(RECIPES)", context));
if (recipes.length !== 123) throw new Error(`Expected 123 runtime recipes, got ${recipes.length}`);
console.log(`Recipe preparation audit loaded ${recipes.length} runtime recipes.`);
