// import * as discordjs from 'discord.js';
import {args} from './args';
import * as fs from 'fs';
import { Client } from './client';
import { IRCD } from './ircd';

args;
const configFile: string = args.c;
const debugMode: boolean = args.d;

if (!configFile || !fs.existsSync(configFile)) {
  console.error(`Config File ${configFile} does not exist!`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configFile).toString()); // TODO: interface!
const discordToken: string = config.discordToken;

if (!discordToken) {
  console.error(`DiscordToken Property not found in Configfile!`);
  process.exit(1);
}


const client: Client = new Client(discordToken);
client.connect()
.then(() => {
  // const discordUser: string = client.discordUser;
  const channels = client.channels;
  const ircd: IRCD = new IRCD(6667, debugMode, channels, `localhorst`, client);
  client.ircd = ircd;
})
.catch(err => {
  console.error(`MainLoop Error: ${err}`);
  process.exit(1);
});