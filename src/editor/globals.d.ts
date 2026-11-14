// Vite injects CSS imports as side-effect modules; tsc needs to know about them.
declare module "*.css" {
  const content: string;
  export default content;
}
