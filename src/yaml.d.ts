// YAML files are imported as parsed data objects via @rollup/plugin-yaml.
declare module "*.yaml" {
  const data: unknown;
  export default data;
}

declare module "*.yml" {
  const data: unknown;
  export default data;
}
