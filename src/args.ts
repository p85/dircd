import * as yargs from "yargs";

export const args = yargs
.option(`c`, {
  alias: `config`,
  describe: `Configuration File`,
  type: "string"
})
.demandOption(`c`, `Configuration File missing!`)
.option(`d`, {
  alias: `debug`,
  describe: `Debug Mode, Shows more Messages (may slow Things down)`,
  type: `boolean`,
  default: false
})
.argv;
