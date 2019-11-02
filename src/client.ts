import * as discordjs from "discord.js";
import { IRCD } from "./ircd";
import { IServer, IServerChannel, IServerChannelUser } from "./interfaces";

export class Client {
  private client: discordjs.Client = new discordjs.Client({
    sync: true,
    fetchAllMembers: true
  });
  public channels: IServer[] = [];
  public ircd: IRCD;

  constructor(private token: string, private debug: boolean) {
    console.log(`Starting Authentification with Discord...`);
  }

  /**
   * Connects with the Discord API
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.on(`ready`, () => {
        console.log(`Logged in as ${this.client.user.tag}`);
        this.channels = this.client.guilds.array().map(g => ({ // Populate the Channels Array...
          id: g.id,
          name: this.getServerName(g.name),
          channels: this.getChannelsOfServer(g.channels.array(), this.getServerName(g.name))
        }));
        return resolve();
      });
      this.client.on(`message`, msg => { // On Receiving a Message...
        const chid: string = msg.channel.id; // channelId
        const fromUser: string = msg.author.username; // received from User
        this.receiveFromDiscord(chid, fromUser, msg.cleanContent);
      });
      this.client.on(`error`, error => {
        if (this.ircd) {
          this.ircd.notifyUser(`client.ts: An Error happened: ${error.message}`);
        }
      });
      // When a new Channel is created
      this.client.on(`channelCreate`, (channel: discordjs.Channel) => {

      });
      // When a Channel is deleted
      this.client.on(`channelDelete`, (chan: discordjs.Channel) => {

      });
      // o Channel Update, name Change, topic Change
      this.client.on(`channelUpdate`, (oldChan: discordjs.Channel, newChan: discordjs.Channel) => {

      });
      // debug?
      this.client.on(`debug`, info => {
        this.debugMsg(`on Debug: ${info}`);
      });
      // on websocket disconnect
      this.client.on(`disconnect`, e => {
        console.warn(`Got disconnected from Discord API`);
      });
      // on websocket error
      this.client.on(`error`, error => {
        console.error(`Websocket Error: ${error.message}`);
      });
      // on user ban server
      this.client.on(`guildBanAdd`, (guild: discordjs.Guild, user: discordjs.User) => {

      });
      // on user unban server
      this.client.on(`guildBanRemove`, (guild: discordjs.Guild, user: discordjs.User) => {
        
      });
      // user creates new server
      this.client.on(`guildCreate`, (guild: discordjs.Guild) => {

      });
      // user deletes server
      this.client.on(`guildDelete`, (guild: discordjs.Guild) => {

      });
      // user joins guild
      this.client.on(`guildMemberAdd`, (member: discordjs.GuildMember) => {

      });
      // user leaves guild or is kicked
      this.client.on(`guildMemberRemove`, (member: discordjs.GuildMember) => {

      });
      // called when guild member updates, i.e. role, nickname
      this.client.on(`guildMemberUpdate`, (oldMember: discordjs.GuildMember, newMember: discordjs.GuildMember) => {

      });
      // guild outtage due to server fail
      this.client.on(`guildUnavailable`, (guild: discordjs.Guild) => {
        if (this.ircd) this.ircd.notifyUser(`Server ${guild.name} became unavailable due to Server Outtage!`);
        console.warn(`Server ${guild.name} became unavailable due to Server Outtage!`);
      });
      // on guild update, i.e. name change
      this.client.on(`guildUpdate`, (oldGuild: discordjs.Guild, newGuild: discordjs.Guild) => {

      });
      // presence update, possible off or online?
      this.client.on(`presenceUpdate`, (_oldMember: discordjs.GuildMember, newMember: discordjs.GuildMember) => {
        if (this.ircd) this.ircd.changeOnOfflineState(newMember.nickname, newMember.presence.status);
      });
      // reconnect to websocket
      this.client.on(`reconnecting`, () => {
        console.info(`Websocket reconnecting to Discord API`);
      });
      // resume websocket
      this.client.on(`resume`, (replayed: number) => {
        console.info(`Websocket successfully resumed, replayed ${replayed} Events`);
      });
      // on user update, i.e. change nickname
      this.client.on(`userUpdate`, (oldUser: discordjs.User, newUser: discordjs.User) => {

      });
      // for warnigns
      this.client.on(`warn`, info => {
        this.debugMsg(`on Warn: ${info}`);
      });
      this.client.login(this.token); // try discord login
    });
  }

  /**
   * Formats the Servername, Replacing all Whitespaces with _ and alle Colons with a Pipe
   * @param unformatted 
   */
  private getServerName(unformatted: string): string {
    return unformatted.replace(/ /g, `_`).replace(/:/g, `|`)
  }

  /**
   * Get all Channels within a Discord Server
   * @param chanArr 
   * @param servername 
   */
  private getChannelsOfServer(chanArr: discordjs.GuildChannel[], servername: string): IServerChannel[] {
    const chans = chanArr.filter(ca => ca.type === `text`);
    const newChans = [];
    chans.forEach(channel => {
      let newChannel: any = {};
      newChannel.id = channel.id;
      newChannel.name = `${servername}.${channel.name}`;
      newChannel.users = channel[`members`]
      .map(member => ({
        id: member.id,
        nickname: member.nickname,
        tag: member.user.tag,
        mode: ``
      }))
      .filter(member => member && member.nickname);
      if (!newChannel.users || newChannel.users.length === 0) newChannel.users = [{id:0, nickname: ``, mode: ``}]; // apply a fake user to show empty channels
      newChans.push(newChannel);
    });
    return newChans;
  }

  /**
   * Is being called, when a new Message is being received from Discord
   * @param channelId 
   * @param fromUser 
   * @param message 
   */
  private receiveFromDiscord(channelId: string, fromUser: string, message: string): void {
    const chan = this.getChannel(channelId);
    if (!chan) {
      this.ircd.notifyUser(`client.ts: receiveFromDiscord(...): Could not find Channel with Id: ${channelId}!`);
      return;
    }
    const servername: string = chan.name.split(`.`)[0].trim();
    const channelname: string = chan.name.split(`.`)[1].trim();
    this.ircd.injectChannelMessage(servername, channelname, fromUser, message);
  }

  /**
   * Returns a Channel Object, respecting the given channelId
   * @param channelId 
   */
  private getChannel(channelId: string): IServerChannel {
    let channel: IServerChannel;
    this.channels.forEach(server => {
      const haveChan = server.channels.find(ch => ch.id === channelId);
      if (!channel && haveChan) channel = haveChan;
    });
    return channel;
  }

  /**
   * Finds a User by their nickname
   * @param nickname 
   */
  private getUser(nickname: string): IServerChannelUser {
    let foundUser;
    this.channels.forEach(server => {
      server.channels.forEach(ch => {
        const haveUser = ch.users.find(user => {
          console.log(user.nickname);
          return user.nickname === nickname;
        });
        if (!foundUser && haveUser) foundUser = haveUser;
      });
    });
    return foundUser;
  }

  /**
   * Sends a Message to a Discord Channel
   * @param channelId 
   * @param message 
   */
  public sendToDiscord(channelId: string, message: string): void {
    const channel = this.client.channels.get(channelId);
    if (!channel) {
      this.ircd.notifyUser(`client.ts: sendToDiscord(...): Could not find the Discord Channel with the ID: ${channelId}!`);
      return;
    }
    channel[`send`](message); // Bug in discord.js Type Definition, send() definitly exists!
  }

  /**
   * Sends a Message to a Discord User
   * @param nickname 
   * @param message 
   */
  public sendToDiscordUser(nickname: string, message: string): void {
    const toUser = this.getUser(nickname);
    if (!toUser) {
      this.ircd.notifyUser(`client.ts: sendToDiscordUser(...): Could not find the User to Message or you tried to message yourself?`);
      return;
    }
    const user = this.client.channels.get(toUser.id);
    if (!user) {
      this.ircd.notifyUser(`client.ts: sendToDiscordUser(...): Could not find a User with this Id!`);
      return;
    }
    user[`send`](message); // Bug in discord.js Type Definition, send() definitly exists!
  }

    /**
   * Print a Debug Message, when DebugMode is enabled
   * @param msg
   */
  private debugMsg(msg: string): void {
    if (this.debug) console.log(msg);
  }
}
