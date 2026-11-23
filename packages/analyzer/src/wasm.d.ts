// `import x from "./file.wasm" with { type: "file" }` gives a path: on disk under `bun run`,
// or inside the embedded `$bunfs` when running from a `bun build --compile` binary.
declare module "*.wasm" {
  const path: string;
  export default path;
}
