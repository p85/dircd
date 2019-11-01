export interface IServer {
  id: string;
  name: string;
  channels: IServerChannel[]
}

export interface IServerChannel {
  id: string;
  name: string;
  users: IServerChannelUser[]
}

export interface IServerChannelUser {
  id: string;
  nickname: string;
  tag: string;
}

export interface IConfigFile {
  discordToken: string;
  port?: number;
  localServerName?: string;
}

export interface IParsedUserLine {
  nickname: string;
  realname: string;
  servername: string;
  username: string;
  hostname: string;
  socket;
}

export interface IOnlineUsers {
  socket;
  nickname: string;
  username: string;
  hostname: string;
}

export interface IParsedUserObject {
  realname: string;
  servername: string;
  username: string;
}