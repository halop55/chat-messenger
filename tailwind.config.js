/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./App.tsx", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [
       ["babel-preset-expo", { jsxImportSource: "nativewind" }],
       "nativewind/babel",
     ],
  theme: {
    extend: {},
  },
  plugins: [],
}