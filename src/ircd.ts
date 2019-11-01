import * as Net from "net";
import { Client } from "./client";
import { IParsedUserLine, IParsedUserObject } from "./interfaces";



export class IRCD {
  private users: any[] = [];

  constructor(
    private port: number = 6667,
    private debug: boolean = false,
    private channels,
    private serverhostname: string = `localghost`,
    private clientInstance: Client
  ) {
    this.startServer();
  }

  /**
   * Starts the IRC-Server, set up EventListeners...
   */
  private startServer(): void {
    const server = Net.createServer(socket => {
      let nick: boolean = false;
      let user: boolean = false;
      let timerHandle;
      let messageQueue: string[] = [];
      const userObject: IParsedUserLine = {} as any;
      userObject.hostname = socket.remoteAddress;
      socket.on("connect", () => {
        console.log(`have connection from: ${userObject.hostname}`);
        timerHandle = setInterval(() => socket.write(`PING: 1\n`), 1000);
      });
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
                userObject.hostname
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
              let msgValue: any | string = msg.split(`:`);
              if (msgValue && msgValue[1]) msgValue = msgValue[1].trim();
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
                    this.clientInstance.sendToDiscordUser(msgParameter, msgValue);
                  }
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
    server.listen(this.port);
    console.log(`IRCD started on Port ${this.port}`);
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
      `:${nickname}!${username}@${hostname} 001 ${nickname} :You are connected to DIRCD\n`
    );
    socket.write(
      `:${nickname}!${username}@${hostname} 003 ${nickname} :guess we're online.\n`
    );
    socket.write(
      `:${nickname}!${username}@${hostname} 003 ${nickname} :---\n`
    );
    socket.write(
      `:${nickname}!${username}@${hostname} 003 ${nickname} :Please wait, while we attempt to join all your Channels...`
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
        channel.users.forEach(userInChan => {
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
  private joinAllUsers(): string[] {
    const joins: string[] = [];
    this.channels.forEach(server => {
      server.channels.forEach(channel => {
        const channelname: string = channel.name;
        channel.users.forEach(userInChan => {
          joins.push(
            `:${userInChan.nickname}!${userInChan.nickname}@discord JOIN #${channelname}\n`
          );
        });
      });
    });
    return joins;
  }

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
    hostname: string
  ): void {
    this.users.push({
      socket,
      nickname,
      username,
      hostname
    });
    this.loginMsg(socket, nickname, username, hostname);
    const joinCommands = this.joinAllChannels(nickname, username, hostname);
    const userJoinCommands = this.joinAllUsers();
    this.debugMsg(`Channels to Join Command: ${joinCommands.join(`\n`)}`);
    joinCommands.forEach(join => socket.write(join));
    this.debugMsg(`Joining Users... Total: ${userJoinCommands.length}`);
    userJoinCommands.forEach(join => socket.write(join));
  }

  /**
   * Writes a received Message to the connected IRC-Client(s), is being called by client.ts, DiscordClient.on('message)
   * @param servername 
   * @param channelname 
   * @param fromUser 
   * @param message 
   */
  public injectChannelMessage(servername: string, channelname: string, fromUser: string, message: string) {
    const msgToSend: string = `:${fromUser}!${fromUser}@${fromUser} PRIVMSG #${servername}.${channelname} :${message}\n`;
    this.users.forEach(user => {
      user.socket.write(msgToSend);
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
}
