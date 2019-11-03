import * as Net from "net";
import { Client } from "./client";
import {
  IParsedUserLine,
  IParsedUserObject,
  IServer,
  IOnlineUsers,
  TOnOfflineState,
  IServerChannelUser
} from "./interfaces";
import { AppVersion } from "./appVersion";

export class IRCD {
  private users: IOnlineUsers[] = [];

  constructor(
    private port: number = 6667,
    private debug: boolean = false,
    private channels: IServer[],
    private serverhostname: string = `localghost`,
    private clientInstance: Client,
    private listenOnAll: boolean
  ) {
    this.startServer();
  }

  /**
   * Starts the IRC-Server, set up EventListeners...
   */
  private startServer(): void {
    // TODO: ugh, need some refactor
    const server = Net.createServer(socket => {
      let nick: boolean = false;
      let user: boolean = false;
      let timerHandle;
      let messageQueue: string[] = [];
      const userObject: IParsedUserLine = {} as any;
      userObject.hostname = socket.remoteAddress;
      console.log(`connection from: ${userObject.hostname}`);
      timerHandle = setInterval(() => socket.write(`PING :1\n`), 60 * 1000); // once a minute, actually we dont need ping/ponging, its just for compatibility issues
      socket.on("data", msg => {
        const readadbleMsg: string = msg.toString().trim();
        const readableMsgArr: string[] = readadbleMsg.split(`\n`);
        this.debugMsg(`Received Message from IRC-Client: ${readadbleMsg}`);
        if (!user || !nick) {
          this.debugMsg(`User has not been identified yet, but trying so...`);
          if (readableMsgArr.length > 0) {
            const messages: string[] = readableMsgArr.map(msgs => msgs.trim());
            this.debugMsg(
              `Multiple Commands on One Line, Splitting up into Message Queue (Total: ${messages.length})`
            );
            messageQueue = messageQueue.concat(messages);
            for (let i = 0; i < messageQueue.length; i++) {
              const msg: string = messageQueue[i];
              const msgType: string = msg.split(` `)[0];
              if (user && nick) break;
              switch (msgType) {
                case "NICK":
                  this.debugMsg(`Have NICK Message, trying to parse...`);
                  const myNickname: string = this.parseNick(msg);
                  this.debugMsg(`Parsed Nickname: ${myNickname}`);
                  if (myNickname) {
                    userObject.nickname = myNickname;
                    nick = true;
                    this.debugMsg(`Parsing NICK Line successful!`);
                  }
                  break;
                case "USER":
                  this.debugMsg(`Have USER Message, trying to parse...`);
                  const myUser = this.parseUser(msg);
                  this.debugMsg(
                    `Parsed User Line: ${JSON.stringify(myUser, null, 1)}`
                  );
                  if (
                    myUser &&
                    myUser.realname &&
                    myUser.username &&
                    myUser.servername
                  ) {
                    userObject.realname = myUser.realname;
                    userObject.username = myUser.username;
                    userObject.servername = myUser.servername;
                    user = true;
                    this.debugMsg(`Parsing USER Line successful!`);
                  }
                  break;
                default:
                  this.debugMsg(
                    `Expected NICK or USER from IRC-Client, but got instead: ${readadbleMsg}`
                  );
                  socket.write(
                    `:${this.serverhostname} 451 * :Please Identify first\n`
                  );
              }
            }
            if (user && nick) {
              this.afterLogin(
                socket,
                userObject.nickname,
                userObject.username,
                userObject.hostname,
                userObject
              );
            }
          }
        } else {
          // we are past login
          if (readableMsgArr.length > 0) {
            readableMsgArr.forEach(msg => {
              let msgType: any | string = msg.split(` `);
              if (msgType && msgType[0]) msgType = msgType[0].trim();
              let msgParameter: any | string = msg.split(` `);
              if (msgParameter && msgParameter[1])
                msgParameter = msgParameter[1].trim();
              const msgIndex = msg.indexOf(`:`) + 1;
              let msgValue: any | string = msg
                .slice(msgIndex, msg.length)
                .trim();
              switch (msgType) {
                case `PRIVMSG`:
                  this.debugMsg(
                    `send privmsg to ${msgParameter} with content: ${msgValue}`
                  );
                  if (msgParameter.startsWith(`#`)) {
                    const servername: string = msgParameter
                      .split(`.`)[0]
                      .slice(1);
                    const channelname: string = msgParameter.split(`.`)[1];
                    const server = this.channels.find(
                      srv => srv.name === servername
                    );
                    const channel = server.channels.find(ch => {
                      const chname: string = ch.name.split(`.`)[1].trim();
                      return chname === channelname;
                    });
                    const chid: string = channel.id;
                    this.clientInstance.sendToDiscord(chid, msgValue);
                  } else {
                    this.debugMsg(`Send Private Message`);
                    this.notifyUser(
                      `Sorry, Private Messages to another Users are not supported yet :(`
                    );
                    // this.clientInstance.sendToDiscordUser(msgParameter, msgValue);
                  }
                  break;
                case `NAMES`:
                  break;
              }
            });
          }
        }
      });
      socket.on("close", hasError => {
        this.users = this.users.filter(u => u.nickname !== userObject.nickname);
        if (timerHandle) clearInterval(timerHandle);
        console.error(`Closing Connection: with Error?: ${hasError}`);
      });
    });
    if (this.listenOnAll) {
      server.listen(this.port);
      console.log(`IRCD started on Port ${this.port}, Listening on 0.0.0.0`);
      console.log(
        `WARNING! Anyone can connect to this dircd instance and this is probably not that what you want!`
      );
    } else {
      server.listen(this.port, `127.0.0.1`);
      console.log(`IRCD started on Port ${this.port}, Listening on 127.0.0.1`);
    }
  }

  /**
   * Returns a List of Usernames of a given Channel
   * @param channel Contains #Servername.Channelname
   */
  public getUsernamesOfChannel(channel: string): string {
    const serverName: string = channel.split(`.`)[0];
    const channelName: string = channel.split(`.`)[1];
    const server = this.channels.find(serv => serv.name === serverName);
    if (!server) {
      this.notifyUser(
        `ircd.ts getUsernamesOfChannel(...): Cannot find Server ${serverName}`
      );
      return;
    }
    const chan = server.channels.find(
      ch => ch.name === `${serverName}.${channelName}`
    );
    if (!chan) {
      this.notifyUser(
        `ircd.ts getUsernamesOfChannel(...): Cannot find Channel ${channelName} within Server ${serverName}`
      );
      return;
    }
    if (chan.users)
      return chan.users.map(user => `${user.mode}${user.nickname}`).join(` `);
  }

  /**
   * Parses the Nickname from the NICK Command
   * @param line
   */
  private parseNick(line: string): string {
    const nickname: string[] = line.split(` `);
    return !nickname[1] ? `` : nickname[1];
  }

  /**
   * Parses the Data from the USER Command
   * @param line
   */
  private parseUser(line: string): IParsedUserObject {
    let parsedLine: string[] = line.split(`:`);
    const realname: string =
      parsedLine && parsedLine[1] ? parsedLine[1].replace(/ /g, `_`) : null;
    this.debugMsg(`Parsed Realname: ${realname}`);
    let rest = parsedLine[0].trim().split(` `);
    rest.shift(); // screw USER
    const servername: string = rest.pop().replace(/ /g, `_`);
    this.debugMsg(`Parsed Servername: ${servername}`);
    const username: string = rest.join(`_`);
    this.debugMsg(`Parsed Username: ${username}`);
    return {
      realname,
      servername,
      username
    };
  }

  /**
   * Print a Debug Message, when DebugMode is enabled
   * @param msg
   */
  private debugMsg(msg: string): void {
    if (this.debug) console.log(msg);
  }

  /**
   * Messages that will be send right after the Login, is being called by afterLogin(...)
   * @param socket
   * @param nickname
   * @param username
   * @param hostname
   */
  private loginMsg(
    socket,
    nickname: string,
    username: string,
    hostname: string
  ): void {
    socket.write(
      `:${nickname}!${username}@${hostname} 001 ${nickname} :You are connected to DIRCD v${AppVersion.getVersion()}\n`
    );
    socket.write(
      `:${nickname}!${username}@${hostname} 003 ${nickname} :looks like we're online.\n`
    );
    socket.write(`:${nickname}!${username}@${hostname} 003 ${nickname} :---\n`);
    socket.write(
      `:${nickname}!${username}@${hostname} 003 ${nickname} :Please wait, while we attempt to join all your Channels...\n`
    );
  }

  /**
   * Creates JOIN Commands for all the Channels you are in
   * @param nickname
   * @param username
   * @param hostname
   */
  private joinAllChannels(
    nickname: string,
    username: string,
    hostname: string
  ): string[] {
    let joinCommands: string[] = [];
    this.channels.forEach(server => {
      server.channels.forEach(channel => {
        const channelname: string = channel.name;
        channel.users.forEach(_userInChan => {
          joinCommands.push(
            `:${nickname}!${username}@${hostname} JOIN #${channelname}\n`
          );
        });
      });
    });
    return joinCommands;
  }

  /**
   * Creates JOIN Commands for all other available Users in those Channels
   */
  // private joinAllUsers(): string[] {
  //   const joins: string[] = [];
  //   this.channels.forEach(server => {
  //     server.channels.forEach(channel => {
  //       const channelname: string = channel.name;
  //       channel.users.forEach(userInChan => {
  //         joins.push(
  //           `:${userInChan.nickname}!${userInChan.nickname}@discord JOIN #${channelname}\n`
  //         );
  //       });
  //     });
  //   });
  //   return joins;
  // }

  /**
   * These Actions will be peformed once a User successfully identified with the IRC-Server
   * @param socket
   * @param nickname
   * @param username
   * @param hostname
   */
  private afterLogin(
    socket,
    nickname: string,
    username: string,
    hostname: string,
    userObject: IOnlineUsers
  ): void {
    this.users.push({
      socket,
      nickname,
      username,
      hostname
    });
    this.loginMsg(socket, nickname, username, hostname);
    const joinCommands = this.joinAllChannels(nickname, username, hostname);
    // const userJoinCommands = this.joinAllUsers();
    this.debugMsg(`Channels to Join Command: ${joinCommands.join(`\n`)}`);
    joinCommands.forEach(join => socket.write(join));
    // this.debugMsg(`Joining Users... Total: ${userJoinCommands.length}`);
    // userJoinCommands.forEach(join => socket.write(join));
    this.channels.forEach(server => {
      server.channels.forEach(channel => {
        this.namesCommand(channel.name, userObject);
      });
    });
  }

  /**
   * Writes a received Message to the connected IRC-Client(s), is being called by client.ts, DiscordClient.on('message)
   * @param servername
   * @param channelname
   * @param fromUser
   * @param message
   */
  public injectChannelMessage(
    servername: string,
    channelname: string,
    fromUser: string,
    message: string
  ) {
    const messages: string[] = message.split(`\n`);
    this.users.forEach(user => {
      messages.forEach(msg => {
        const msgToSend: string = `:${fromUser}!${fromUser}@${fromUser} PRIVMSG #${servername}.${channelname} :${msg}\n`;
        if (user.nickname !== fromUser) {
          user.socket.write(msgToSend);
        }
      });
    });
  }

  /**
   * Used to write a Notification to the User, only used for Error Notifiying!
   * @param message
   */
  public notifyUser(message: string): void {
    this.users.forEach(user => {
      user.socket.write(`NOTICE * :${message}\n`);
    });
  }

  /**
   * Chnages the On/Offline State for a User, means, (de)voices a User on all his Channels
   * @param nickname
   * @param newState
   */
  public changeOnOfflineState(userId: string, newState: TOnOfflineState): void {
    this.channels.forEach(server => {
      server.channels.forEach(chan => {
        const chanName: string = chan.name;
        chan.users.forEach(user => {
          if (user.id === userId && this.canApplyModeChange(user, newState)) {
            this.debugMsg(
              `change On/Offline State: New State ${newState} for ${user.nickname}`
            );
            const modePrefix: string =
              newState === `offline` || newState === `invisible` ? `-` : `+`;
            user.mode = modePrefix === `-` ? (`` as any) : modePrefix;
            const modeCommand: string = `:${this.serverhostname} MODE #${chanName} ${modePrefix}v ${user.nickname}\n`;
            this.users.forEach(user => user.socket.write(modeCommand));
          }
        });
      });
    });
  }
  /**
   * Determines if any Mode Change for a given User and his NewState needs to be applied
   * @param channelUser
   * @param newState
   */
  private canApplyModeChange(
    channelUser: IServerChannelUser,
    newState: TOnOfflineState
  ): boolean {
    switch (channelUser.mode) {
      case `@`:
      case `+`:
        if (newState === `offline` || newState === `invisible`) return true;
        break;
      case ``:
        if (newState !== `offline` && newState !== `invisible`) return true;
        break;
    }
    return false;
  }

  /**
   * Changes the Topic on a Channel
   * @param serverName
   * @param channelName
   * @param newTopic
   */
  public changeTopic(
    serverName: string,
    channelName: string,
    newTopic: string,
    topicSetBy: string
  ): void {
    const topicChange: string = `:${topicSetBy} TOPIC #${serverName}.${channelName} :${newTopic}\n`;
    this.users.forEach(user => user.socket.write(topicChange));
  }

  public joinChannel(
    serverName: string,
    channelName: string,
    userObject: IOnlineUsers
  ): void {
    this.users.forEach(user =>
      user.socket.write(
        `:${user.nickname}!${user.username}@${user.hostname} JOIN #${serverName}.${channelName}\n`
      )
    );
    // const joinAll = this.joinAllUsers();
    // this.users.forEach(user => joinAll.forEach(j => user.socket.write(j)));
    if (userObject) this.namesCommand(`${serverName}.${channelName}`, null);
  }

  public leaveChannel(serverName: string, channelName: string): void {
    this.users.forEach(user =>
      user.socket.write(
        `:${user.nickname}!${user.username}@${user.hostname} PART #${serverName}.${channelName}\n`
      )
    );
  }

  /**
   * Creates the Userlist for the /NAMES Command
   * @param serverChannelName
   * @param userObject
   */
  private namesCommand(
    serverChannelName: string,
    userObject: IOnlineUsers
  ): void {
    this.debugMsg(`Names for Channel: ${serverChannelName}`);
    let response: string = `:${this.serverhostname} 353 ${
      userObject.nickname
    } = #${serverChannelName} :${this.getUsernamesOfChannel(
      serverChannelName
    )} ${userObject.nickname}\n`;
    if (userObject && userObject.socket) {
      userObject.socket.write(response);
    } else {
      this.users.forEach(user => user.socket.write(response));
    }
  }
}
