import * as discordjs from "discord.js";
import { IRCD } from "./ircd";

export class Client {
  private client: discordjs.Client = new discordjs.Client({
    sync: true,
    fetchAllMembers: true
  });
  public channels = [];
  public discordUser: string;
  public ircd: IRCD;

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
        const chid: string = msg.channel.id;
        const fromUser: string = msg.author.username;
        this.receiveFromDiscord(chid, fromUser, msg.cleanContent);
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
      newChannel.id = channel.id;
      newChannel.name = `${servername}.${channel.name}`;
      newChannel.users = channel[`members`]
      .map(member => ({
        id: member.id,
        nickname: member.nickname
      }))
      .filter(member => member && member.nickname);
      if (!newChannel.users || newChannel.users.length === 0) newChannel.users = [{id:0, nickname: ``}];
      newChans.push(newChannel);
    });
    return newChans;
  }

  private receiveFromDiscord(channelId: string, fromUser: string, message: string): void {
    const chan = this.getChannel(channelId);
    if (!chan) return; // not supported message received?
    const servername: string = chan.name.split(`.`)[0].trim();
    const channelname: string = chan.name.split(`.`)[1].trim();
    this.ircd.injectChannelMessage(servername, channelname, fromUser, message);
  }

  private getChannel(channelId: string) {
    let cha;
    this.channels.find(server => {
      const haveChan = server.channels.find(ch => ch.id === channelId);
      if (!cha && haveChan) cha = haveChan;
    });
    return cha;
  }

  public sendToDiscord(channelId: string, message: string): void {
    const channel = this.client.channels.get(channelId);
    if (!channel) throw new Error(`Uh oh! this should never happen...channel not found :(`);
    channel[`send`](message); // Bug in discord.js Type Definition, send() definitly exists!
  }

  public sendToDiscordUser(userId: string, message: string): void {

  }
}
