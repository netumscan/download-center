import flowbitePlugin from "flowbite/plugin";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{astro,html,js,jsx,ts,tsx,svelte,vue}",
    "./node_modules/flowbite/**/*.js",
    "./node_modules/flowbite-astro/**/*.{js,mjs}"
  ],
  theme: {
    extend: {}
  },
  plugins: [flowbitePlugin]
};
