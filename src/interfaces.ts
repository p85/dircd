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
  mode: `` | `+` | `@`;
}

export interface IConfigFile {
  discordToken: string;
  port?: number; // The Port to Listen on, Default is: 6667
  joinChannels?: string[]; // define which channels to join, leave empty for all. Example: ['ServerX.', 'ServerY.ChannelA', '.ChannelB'], See more Examples in config.json_example
  ignoreChannelBounds?: boolean; // when joinChannels are defined and this option is set, you will still receive all messages
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

export type TOnOfflineState = `online` | `idle` | `dnd` | `invisible` | `offline`;
