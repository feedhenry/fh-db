var assert = require("assert");

/**
 * Parse a MongodB connection URL, split it up and return an object
 * containing the configuration properties.
 * @param mongoConnectionURL The connection URL as String
 * @returns Configuration Object
 */
exports.parseMongoConnectionURL = function (mongoConnectionURL) {
  var result = {};

  //The connection string will be of the form mongodb://user:password@host:port,host2port2/databasename?option=someOption
  //String to break down the mongodb url into a ditch config hash
  var auth_hosts_path_options = new Buffer(mongoConnectionURL).toString().split("//")[1];

  //user:password , host:port,host2:port2/databasename?option=someOption
  var auth = auth_hosts_path_options.split("@")[0];


  var hosts_path_options = auth_hosts_path_options.split("@")[1];

  // host:port,host2:port2/databasename , option=someOption
  var hosts_path = hosts_path_options.split("?")[0];
  var options = hosts_path_options.split("?")[1];

  //host:port,host2:port2, databasename
  var hosts = hosts_path.split("/")[0];
  var databaseName = hosts_path.split("/")[1];

  //host:port host2:port2
  var hostList = hosts.split(",");

  //user, password
  var authUser = auth.split(":")[0];
  var authPassword = auth.split(":")[1];

  result.database = {};
  result.database.driver_options = {};
  result.database.auth = {};
  result.database.auth.user = authUser;
  result.database.auth.pass = authPassword;
  result.database.auth.source = databaseName;
  result.database.name = databaseName;

  assert.ok(authUser !== undefined);
  assert.ok(authPassword !== undefined);
  assert.ok(databaseName !== undefined);

  //Parsing options
  if (options) {
    var parsedOptions = options.split(",");
    //If options are parsed, they should have an even number of elements in the split array
    assert.ok(parsedOptions.length > 0);

    for (var i = 0; i < parsedOptions.length; i++) {
      var splitOption = parsedOptions[i].split("=");
      //Each option should be something=value
      assert.ok(splitOption && splitOption.length === 2);
      assert.ok(splitOption[0].length > 0);
      assert.ok(splitOption[1].length > 0);
      //Checking it does not already exist
      assert.ok(!result.database.driver_options[splitOption[0]]);

      result.database.driver_options[splitOption[0]] = splitOption[1];
    }
  }

  var host_port;
  if (hostList.length > 1) {
    result.database.host = [];
    result.database.port = [];
    for (i = 0; i < hostList.length; i++) {
      host_port = hostList[i].split(":");
      assert.ok(host_port[0] && host_port[0].length > 0);
      result.database.host.push(host_port[0]);
      if (host_port.length > 1) {
        result.database.port.push(host_port[1]);
      } else {
        result.database.port.push('27017');
      }
    }
  }
  else {
    host_port = hostList[0].split(":");
    assert.ok(host_port[0] && host_port[0].length > 0);
    result.database.host = host_port[0];
    if (host_port.length > 1) {
      result.database.port = host_port[1];
    } else {
      result.database.port = '27017';
    }
  }


  //Verify the config to be returned
  assert.ok(result.database.name.length > 0);
  assert.ok(result.database.auth.user.length > 0);
  assert.ok(result.database.auth.pass.length > 0);


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