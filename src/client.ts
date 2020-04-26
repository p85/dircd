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
   * Connects with the Discord API and sets up the Event Handlers
   * @returns {void}
   */
  public connect(): Promise<void> {
    return new Promise((resolve, _reject) => {
      this.client.on(`ready`, () => {
        console.log(`Logged in as ${this.client.user.tag}`);
        this.channels = this.client.guilds.array().map(g => ({
          // Populate the Channels Array...
          id: g.id,
          name: this.getServerName(g.name),
          channels: this.getChannelsOfServer(
            g.channels.array(),
            this.getServerName(g.name)
          )
        }));
        return resolve();
      });
      this.client.on(`message`, msg => {
        // On Receiving a Message...
        const chid: string = msg.channel.id; // channelId
        const fromUser: string = msg.author.username; // received from User
        this.receiveFromDiscord(chid, fromUser, msg.cleanContent);
      });
      this.client.on(`error`, error => {
        const errMsg: string = `client.ts: An Error happened: ${error.message}`;
        if (this.ircd) this.ircd.notifyUser(errMsg);
        console.error(errMsg);
      });
      // When a new Channel is created
      this.client.on(`channelCreate`, (channel: discordjs.Channel) => {
        const serverName: string = channel[`guild`][`name`];
        const channelName: string = channel[`name`];
        this.debugMsg(`discord Event channelCreate: ${serverName}.${channelName}`);
        this.ircd.joinChannel(serverName, channelName);
      });
      // When a Channel is deleted
      this.client.on(`channelDelete`, (channel: discordjs.Channel) => {
        const serverName: string = channel[`guild`][`name`];
        const channelName: string = channel[`name`];
        this.debugMsg(`discord Event channelDelete: ${serverName}.${channelName}`);
        this.ircd.leaveChannel(serverName, channelName);
      });
      // o Channel Update, name Change, topic Change
      this.client.on(`channelUpdate`, (oldChan: discordjs.Channel, newChan: discordjs.Channel) => {
          const topicChanged: boolean = oldChan[`topic`] !== newChan[`topic`];
          if (topicChanged) {
            const newTopic: string = newChan[`topic`];
            const serverName: string = newChan[`guild`][`name`];
            const channelName: string = newChan[`name`];
            const topicSetBy: string = newChan[`client`][`user`][`username`];
            this.debugMsg(`discord Event channelUpdate new Topic: ${newTopic} set by ${topicSetBy} on Server ${serverName} in Channel ${channelName}`);
            this.ircd.changeTopic(serverName, channelName, newTopic, topicSetBy);
          }
        }
      );
      // debug?
      this.client.on(`debug`, info => {
        this.debugMsg(`on Debug: ${info}`);
      });
      // on websocket disconnect
      this.client.on(`disconnect`, e => {
        const msg: string = `Got disconnected from Discord API: ${e}`;
        console.warn(msg);
      });
      // on websocket error
      this.client.on(`error`, error => {
        const msg: string = `Websocket Error: ${error.message}`;
        if (this.ircd) this.ircd.notifyUser(msg);
        console.error(msg);
      });
      // on user ban server
      this.client.on(`guildBanAdd`, (guild: discordjs.Guild, user: discordjs.User) => {});
      // on user unban server
      this.client.on(`guildBanRemove`, (guild: discordjs.Guild, user: discordjs.User) => {});
      // user creates new server
      this.client.on(`guildCreate`, (guild: discordjs.Guild) => {});
      // user deletes server
      this.client.on(`guildDelete`, (guild: discordjs.Guild) => {});
      // user joins guild
      this.client.on(`guildMemberAdd`, (member: discordjs.GuildMember) => {});
      // user leaves guild or is kicked
      this.client.on(`guildMemberRemove`, (member: discordjs.GuildMember) => {});
      // called when guild member updates, i.e. role, nickname
      this.client.on(`guildMemberUpdate`, (oldMember: discordjs.GuildMember, newMember: discordjs.GuildMember) => {});
      // guild outtage due to server fail
      this.client.on(`guildUnavailable`, (guild: discordjs.Guild) => {
        const msg: string = `Server ${guild.name} became unavailable due to Server Outtage!`;
        if (this.ircd) this.ircd.notifyUser(msg);
        console.warn(msg);
      });
      // on guild update, i.e. name change
      this.client.on(`guildUpdate`, (oldGuild: discordjs.Guild, newGuild: discordjs.Guild) => {});
      // presence update, possible off or online?
      this.client.on(`presenceUpdate`, (oldMember: discordjs.GuildMember, newMember: discordjs.GuildMember) => {
        if (this.ircd)
          this.ircd.changeOnOfflineState(newMember.id, newMember.presence.status);
      });
      // reconnect to websocket
      this.client.on(`reconnecting`, () => console.info(`Websocket reconnecting to Discord API`));
      // resume websocket
      this.client.on(`resume`, (replayed: number) => console.info(`Websocket successfully resumed, replayed ${replayed} Events`));
      // on user update, i.e. change nickname
      this.client.on(`userUpdate`, (oldUser: discordjs.User, newUser: discordjs.User) => {});
      // for warnigns
      this.client.on(`warn`, info => this.debugMsg(`on Warn: ${info}`));
      this.client.login(this.token); // try discord login
    });
  }

  /**
   * Formats the Servername, Replacing all Whitespaces with _ and alle Colons with a Pipe
   * @param {string} unformatted
   * @returns {string}
   */
  private getServerName(unformatted: string): string {
    return unformatted.replace(/ /g, `_`).replace(/:/g, `|`);
  }

  /**
   * Get all Channels within a Discord Server
   * @param {discordjs.GuildChannel[]} chanArr
   * @param {string} servername
   * @returns {IServerChannel[]}
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
          nickname: member.user.username ? member.user.username.replace(/ /g, `_`) : `_NOTFOUND_${member.id.slice(2, 5)}`,
          tag: member.user.tag,
          mode: member.presence.status === `offline` || member.presence.status === `invisible` ? `` : `+`
        }))
        .filter(member => member); // discard users without actual nicknames
      if (!newChannel.users || newChannel.users.length === 0) {
        newChannel.users = [{ id: 0, nickname: ``, mode: ``, tag: `` }]; // apply a fake user to show empty channels
      }
      newChans.push(newChannel);
    });
    return newChans;
  }

  /**
   * Is being called, when a new Message is being received from Discord
   * @param {string} channelId
   * @param {string} fromUser
   * @param {string} message
   */
  private receiveFromDiscord(channelId: string, fromUser: string, message: string): void {
    const chan = this.getChannel(channelId);
    const user = this.getUser(fromUser);
    if (!chan && !user) {
      this.ircd.notifyUser(
        `client.ts: receiveFromDiscord(...): Could not find Channel/User with Id: ${channelId}!`
      );
      return;
    }
    if (chan) {
      const servername: string = chan.name.split(`.`)[0].trim();
      const channelname: string = chan.name.split(`.`)[1].trim();
      this.ircd.injectChannelMessage(servername, channelname, fromUser, message);
    } else if (user) {
      this.ircd.injectUserMessage(fromUser, message);
    }
  }

  /**
   * Returns a Channel Object, respecting the given channelId
   * @param {string} channelId
   * @returns {IServerChannel}
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
   * @param {string} nickname
   * @returns {IServerChannelUser}
   */
  private getUser(nickname: string): IServerChannelUser {
    let foundUser;
    this.channels.forEach(server => {
      server.channels.forEach(ch => {
        const haveUser = ch.users.find(user => user.nickname === nickname);
        if (!foundUser && haveUser) {
          foundUser = haveUser;
        }
      });
    });
    return foundUser;
  }

  /**
   * Sends a Message to a Discord Channel
   * @param {string} channelId
   * @param {string} message
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
   * @param {string} nickname
   * @param {string} message
   */
  public sendToDiscordUser(nickname: string, message: string): void {
    const toUser = this.getUser(nickname);
    if (!toUser) {
      this.ircd.notifyUser(`client.ts: sendToDiscordUser(...): Could not find the User to Message or you tried to message yourself?`);
      return;
    }
    const user = this.client.users.get(toUser.id);
    if (!user) {
      this.ircd.notifyUser(`client.ts: sendToDiscordUser(...): Could not find a User with this Id!`);
      return;
    }
    user.send(message);
  }

  /**
   * Print a Debug Message, when DebugMode is enabled
   * @param {string} msg
   */
  private debugMsg(msg: string): void {
    if (this.debug) console.log(msg);
  }
}
