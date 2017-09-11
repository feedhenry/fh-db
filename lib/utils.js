var assert = require('assert');
var qs = require('querystring');
var url = require('url');
var env = require('env-var');

/**
 * Parse a MongodB connection URL, split it up and return an object
 * containing the configuration properties.
 * @param mongoConnectionURL The connection URL as String
 * @returns Configuration Object
 */
exports.parseMongoConnectionURL = function (mongoConnectionURL) {

  //The connection string will be of the form mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]
  //String to break down the mongodb url into a ditch config hash
  const parts = mongoConnectionURL.split(',');

  // The name comes from the path in the URL. We must always use the last host
  function getName () {
    const pathname = url.parse(parts[parts.length - 1]).pathname;

    return pathname ? pathname.replace('/', '') : pathname;
  }

  // Parse the query string from the last host portion
  function getOptionsObject () {
    if (parts.length > 1) {
      // Options should be appended to the last hosts querystring
      return qs.parse(url.parse(parts[parts.length - 1]).query);
    }

    return {};
  }

  // Authentication is defined in the primary host URL
  function getAuthenticationObject () {
    const authString = url.parse(parts[0]).auth;

    if (authString) {
      return {
        source: getName(),
        user: authString.split(':')[0],
        pass: authString.split(':')[1]
      };
    } else {
      return {};
    }
  }

  // Only the primary host string contains the "mongodb://" so we use this
  // function to prepend it to others when passing to url.parse
  function prependProtocol (str) {
    if (str.indexOf('mongodb://') === -1) {
      return 'mongodb://' + str;
    } else {
      return str;
    }
  }

  var result = {
    database: {
      driver_options: getOptionsObject(),
      auth: getAuthenticationObject(),
      name: getName(),

      // Use map since we can have multiple hosts and ports
      host: parts.map((p) => url.parse(prependProtocol(p)).hostname),
      port: parts.map((p) => url.parse(p).port || 27017)
    }
  };

  // Verify a database name is given in the connection string
  assert.ok(result.database.name, 'database name must be defined, e.g mongodb://localhost:27017/DATABASE_NAME');

  // At least one host and port must exist
  assert.notEqual(result.database.host.length, 0, 'at least one host must be specified in the mongodb connection string');
  assert.notEqual(result.database.port.length, 0, 'at least one port must be specified in the mongodb connection string');

  result.database.host.forEach((h) => assert(h, `host value of "${h}" is not valid. must be a non empty string`));
  result.database.port.forEach((p) => assert(p, `port value of "${p}" is not valid. must be a non empty string`));

  if (!env('FH_USE_LOCAL_DB').asBool()) {
    // We can't assume authentication is being used if run locally
    assert.ok(result.database.auth.user, 'mongodb username was missing in connection string');
    assert.ok(result.database.auth.pass, 'mongodb password was missing in connection string');
  }

  return result;
};

/**
 * This will return a connection URL like:
 * host1[:port1][,host2[:port2],...[,hostN[:portN]]]
 *
 * With the intention that it can be prepended with "mongodb://[username]:[password]@"
 * and appended with "/[database][?options]
 *
 * @param host This is expected in the format: "host1" or "host1,host2" or ["host1", "host2"]
 * @param port This is expected in the format: 123 or "123" or "123,456" or ["123", "456"] or [123, 456]
 *
 * @returns {string} host1[:port1][,host2[:port2],...[,hostN[:portN]]]
 */
exports.parseConnectionUrl = function (host, port){
  var hosts = [];
  var ports = [];

  //normalise host to an array
  if(! host) {
    hosts  = ['localhost'];
  } else if('string' === typeof host && host.split(',').length <= 1){
    hosts = [host];
  } else if ('string' === typeof host && host.split(',').length > 1){
    hosts = host.split(',');
  } else if (Array.isArray(host)){
    hosts = host;
  }

  //normalise port to an array
  if(! port){
    ports = [27017];
  } else if('string' === typeof port && port.split(',').length <= 1 || 'number' === typeof port){
    ports = [port];
  } else if ('string' === typeof port && port.split(',').length > 1){
    ports = port.split(',');
  } else if (Array.isArray(port)){
    ports = port;
  }

  var connectionHosts = [];

  for( var hostIndex=0; hostIndex < hosts.length; hostIndex++ ){
    connectionHosts[hostIndex] = hosts[hostIndex];

    //if only one port specified, use it on all hosts, otherwise assume number of ports and hosts are equal
    if(ports.length === 1){
      connectionHosts[hostIndex] += ":" + ports[0];
    } else {
      connectionHosts[hostIndex] += ":" + ports[hostIndex];
    }
  }

  return connectionHosts.join(',');
};


/**
 * Returns the driver options URL encoded for the connection string; e.g.: w=1&j=true
 *
 * @param options an Array of options
 *
 * @returns {string}
 */
exports.parseConnectionUrlOptions = function (options) {
  //set default values
  var retOptions = { w: 1, j: true, numberOfRetries: 5, retryMiliSeconds: 2000, native_parser:false};

  //override defaults
  if (options) {
    for (var field in options) {
      // RHMAP-9817 if a field (more explicitly replicaSet) is empty don't include it in the options
      // The reason that the comparator to an empty string was used is that the options[field] value can be set to false
      // and hence not get included
      if (options[field] !== "") {
        retOptions[field] = options[field];
      }
    }
  }
  var argParts = [];

  //convert options to arg string
  for(var opt in retOptions) {
    if (retOptions.hasOwnProperty(opt)) {
      argParts.push(encodeURIComponent(opt) + "=" + encodeURIComponent(retOptions[opt]));
    }
  }
  if(argParts.length) {
    return "?" + argParts.join("&");
  }
  return "";
};
