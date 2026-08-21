import pluginVue from "eslint-plugin-vue";
import typescriptEslint from "typescript-eslint";

export default [
    {
        ignores: ["**/*.json"]
    },
    ...pluginVue.configs["flat/recommended"],
    {
        files: ["**/*.vue"],
        languageOptions: {
            parserOptions: {
                parser: typescriptEslint.parser
            }
        }
    }
];
