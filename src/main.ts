// import * as discordjs from 'discord.js';
import {args} from './args';
import * as fs from 'fs';
import { Client } from './client';
import { IRCD } from './ircd';
import {IServer, IConfigFile} from './interfaces';

args;
const configFile: string = args.c;
const debugMode: boolean = args.d;

if (!configFile || !fs.existsSync(configFile)) {
  console.error(`Config File ${configFile} does not exist!`);
  process.exit(1);
}

const config: IConfigFile = JSON.parse(fs.readFileSync(configFile).toString());
const discordToken: string = config.discordToken;

if (!discordToken) {
  console.error(`DiscordToken Property not found in Configfile!`);
  process.exit(1);
}


const client: Client = new Client(discordToken);
client.connect()
.then(() => {
  const channels: IServer[] = client.channels;
  const ircd: IRCD = new IRCD(6667, debugMode, channels, `localghost`, client);
  client.ircd = ircd;
})
.catch(err => {
  console.error(`MainLoop Error: ${err}`);
  process.exit(1);
});