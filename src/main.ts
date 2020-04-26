import {args} from './args';
import * as fs from 'fs';
import { Client } from './client';
import { IRCD } from './ircd';
import {IServer, IConfigFile} from './interfaces';
import {AppVersion} from './appVersion';


args;
const configFile: string = args.c;
const debugMode: boolean = args.d;
const listenOnAll: boolean = args.i || false;

console.log(`dircd v${AppVersion.getVersion()} started...`);
console.log(`Config File: ${configFile}`);

if (!configFile || !fs.existsSync(configFile)) {
  console.error(`Config File ${configFile} does not exist!`);
  process.exit(1);
}

console.log(`Reading Config File ${configFile}...`);
const config: IConfigFile = JSON.parse(fs.readFileSync(configFile).toString());
const discordToken: string = config.discordToken;
const port: number = config.port || 6667;
const localServerName: string = `localghost`;
const joinChannels: string[] = config.joinChannels || [];
const ignoreChannelBounds: boolean = config.ignoreChannelBounds || false;


if (!discordToken) {
  console.error(`DiscordToken Property not found in Configfile!`);
  process.exit(1);
}

console.log(`Found DiscordToken.`);
console.log(`Starting Discord Client and IRCd...`);

const client: Client = new Client(discordToken, debugMode);
client.connect()
.then(() => {
  const channels: IServer[] = client.channels;
  const ircd: IRCD = new IRCD(port, debugMode, channels, localServerName, client, listenOnAll, joinChannels, ignoreChannelBounds);
  client.ircd = ircd; // TODO: this is ugly, needs to be done somewhat different...
})
.catch(err => {
  console.error(`main.ts Error: ${err}`);
  process.exit(1);
});