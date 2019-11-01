import * as discordjs from "discord.js";

export class Client {
  private client: discordjs.Client = new discordjs.Client({
    sync: true,
    fetchAllMembers: true
  });
  public channels = [];
  public discordUser: string;

  constructor(private token: string) {}

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.on(`ready`, () => {
        this.discordUser = this.client.user.tag;
        console.log(`Logged in as ${this.client.user.tag}`);
        this.channels = this.client.guilds.array().map(g => ({
          id: g.id,
          name: this.getServerName(g.name),
          channels: this.getChannelsOfServer(g.channels.array(), this.getServerName(g.name))
        }));
        return resolve();
      });
      this.client.on(`message`, msg => {
        console.log(`msg: ${msg}`);
      });
      this.client.login(this.token);
    });
  }

  private getServerName(unformatted: string): string {
    return unformatted.replace(/ /g, `_`).replace(/:/g, `|`)
  }

  private getChannelsOfServer(chanArr: discordjs.GuildChannel[], servername: string) {
    const chans = chanArr.filter(ca => ca.type === `text`);
    const newChans = [];
    chans.forEach(channel => {
      let newChannel: any = {};
      newChannel.name = `${servername}.${channel.name}`;
      newChannel.users = channel[`members`]
      .map(member => ({
        id: member.id,
        nickname: member.nickname
      }))
      .filter(member => member && member.nickname);
      newChans.push(newChannel);
    });
    return newChans;
  }

  public send(channelId: string, message: string): void {
    // this.client.channels.get(`639754920441937940`)['send'](message);
    // this.client.channels.get(id)['send'](message);
  }
}
