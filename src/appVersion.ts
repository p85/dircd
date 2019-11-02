const pjson = require('../package.json');

export class AppVersion {
  public static getVersion(): string {
    return pjson.version;
  }
}