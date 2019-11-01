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
.option(`i`, {
  alias: `listenOnAll`,
  describe: `Listens on all Network Interfaces. DO NOT USE THAT, UNLESS YOU KNOW WHAT YOU DOING! Default Listens only on 127.0.0.1`,
  type: `boolean`,
  default: false
})
.argv;
