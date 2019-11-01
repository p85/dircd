import {args} from './args';
import * as fs from 'fs';
import { Client } from './client';
import { IRCD } from './ircd';
import {IServer, IConfigFile} from './interfaces';

args;
const configFile: string = args.c;
const debugMode: boolean = args.d;
const myVersion: string = process.env.npm_package_version;
const listenOnAll: boolean = args.i || false;

console.log(`dircd v${myVersion} started...`);
console.log(`Config File: ${configFile}`);

if (!configFile || !fs.existsSync(configFile)) {
  console.error(`Config File ${configFile} does not exist!`);
  process.exit(1);
}

console.log(`Reading Config File ${configFile}...`);
const config: IConfigFile = JSON.parse(fs.readFileSync(configFile).toString());
const discordToken: string = config.discordToken;
const port: number = config.port || 6667;
const localServerName: string = config.localServerName || `localghost`;


if (!discordToken) {
  console.error(`DiscordToken Property not found in Configfile!`);
  process.exit(1);
}

console.log(`Found DiscordToken.`);
console.log(`Starting Discord Client and IRCd...`);

const client: Client = new Client(discordToken);
client.connect()
.then(() => {
  const channels: IServer[] = client.channels;
  const ircd: IRCD = new IRCD(port, debugMode, channels, localServerName, client, listenOnAll);
  client.ircd = ircd; // TODO: this is ugly, needs to be done somewhat different...
})
.catch(err => {
  console.error(`main.ts Error: ${err}`);
  process.exit(1);
});