const utils = require('@basedakp48/plugin-utils');

const regex = /{(\d+)(?:-(\d+)|(\*))?}/g;
const plugin = new utils.Plugin({ dir: __dirname });
let prefix = '.'; // Get prefix from config

let configRef;
let config = null;

plugin.on('config', (val, ref) => {
  // TODO: setup config
  config = val;
  configRef = ref;

  // Validate commands
  if (config.command) {
    Object.keys(config.command).forEach((key) => {
      const cmd = config.command[key];
      if (!cmd.command /*|| !cmd.match*/ || !cmd.replace) {
        delete config.command[key];
      } else {
        // Other validation for structure I haven't made yet
      }
    });
  }
});

// Register our presence
plugin.presenceSystem();
// Listen to incoming messages
plugin.messageSystem().on('message-in', moreThanMeetsTheEye);

function moreThanMeetsTheEye(msg) {
  // This message has been transformed before
  if (msg.type !== 'text' || msg.data && msg.data.previousText) return;
  // Config isn't valid
  if (!config || !config.command || !config.mapping) return;
  const mapping = config.mapping[msg.cid];
  // No config for this plugin
  if (!mapping) return;
  let prefix = config.prefix || false;
  // Store all commands that are available, but we can't process them until we know the prefix
  const commands = {};
  if (msg.data) {
    // Check server first
    if (mapping.server && msg.data.serverID) {
      const data = mapping.server[msg.data.serverID];
      if (data) {
        // Server is the base of everything
        if (data.prefix) {
          prefix = data.prefix;
        }
        if (data.commands) {
          Object.assign(commands, data.commands);
        }
      }
    }
    // Check "category" -> Discord specific, mostly
    if (mapping.category && msg.data.parentID) {
      const data = mapping.category[msg.data.parentID];
      if (data) {
        // Category overrides "server"
        if (data.prefix) {
          prefix = data.prefix;
        }
        if (data.commands) {
          Object.assign(commands, data.commands);
        }
      }
    }
  }
  if (mapping.channel) {
    const data = mapping.channel[msg.channel];
    if (data) {
      // Channel overrides everything
      if (data.prefix) {
        prefix = data.prefix;
      }
      if (data.commands) {
        Object.assign(commands, data.commands);
      }
    }
  }
  const found = Object.keys(commands).length;
  if (!prefix || !found) return;
  // Check if message is prefixed
  // This  message isn't one we care about
  if (!msg.text.length || !msg.text.startsWith(prefix)) return;
  /** @type {String[]} */
  const args = msg.text.split(' ');
  const command = args.shift().substring(prefix.length);
  Object.keys(commands).forEach((key) => {
    // Checking permissions
    if (typeof commands[key] === 'object') {
      const users = commands[key];
      if (!users[msg.uid]) {
        delete commands[key];
        return;
      }
    }
    const cmd = config.command[key];
    // the command match feels wrong too
    if (!cmd || command !== cmd.command) {
      delete commands[key];
    } else {
      commands[key] = cmd;
    }
  });
  // No valid commands
  const keys = Object.keys(commands);
  if (!keys.length) return;
  // This structure seems wrong...
  // For now I just want something that works... so:
  if (!msg.data) { // Make a data object
    msg.data = {};
  }
  msg.data.previousText = [msg.text];
  msg.text = getText(commands[keys[0]].replace, args).trim();
  // resend the message
  plugin.messageSystem().sendMessage(msg);
}

/**
 * @param {Command} text 
 * @param {String[]} args 
 */
function getText(text, args) {
  if (regex.test(text)) {
    return text.replace(regex, (match, start, end, rest) => {
      if (start === '0') return args.join(' ');
      if (start > args.length) return '';
      if (end || rest) {
        const range = getRange(args, start, rest ? args.length : end);
        return range.join(' ').trim();
      }
      return args[start - 1];
    });
  }
  // Otherwise just return the text
  return text;
}

// This is 1 indexed, not 0 indexed
function getRange(array, start, end) {
  const ret = [];
  if (start <= array.length && start <= end) {
    for (let i = start - 1; i < end; i++) {
      ret.push(array[i]);
    }
  }
  return ret;
}
