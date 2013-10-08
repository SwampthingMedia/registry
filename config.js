var log = require('./log')
  , Loggly = require('winston-loggly').Loggly
  , providers = require('./providers')
  , winston = require('winston');

var config = null;

// To enable proxies like NGINX, Nitrogen has internal and external ports.
//
// external_port defines the port that clients should use to access the service.
// internal_port defines the port that the service will listen to.

if (process.env.NODE_ENV === "production") {
    config = {
        internal_port: process.env.PORT
    };
} else if (process.env.NODE_ENV === "test") {
    config = {
        external_port: 3050,
        internal_port: 3050,
        protocol: 'http',
        mongodb_connection_string: "mongodb://localhost/nitrogen_test"
    };
} else {
    config = {
        external_port: 3030,
        protocol: 'http',
        mongodb_connection_string: "mongodb://localhost/nitrogen_dev"
    };
}

config.internal_port = config.internal_port || 3030;
config.external_port = config.external_port || 443;
config.protocol = process.env.PROTOCOL || config.protocol || "https";
config.host = process.env.HOST_NAME || config.host || "localhost";
config.mongodb_connection_string = config.mongodb_connection_string || process.env.MONGODB_CONNECTION_STRING;

// Endpoint URI configuration

config.api_prefix = "/api/";
config.path_prefix = config.api_prefix + "v1";

config.base_endpoint = config.protocol + "://" + config.host + ":" + config.external_port;
config.api_endpoint = config.base_endpoint + config.path_prefix;

config.subscriptions_path = '/';
config.subscriptions_endpoint = config.base_endpoint + config.subscriptions_path;

config.agents_endpoint = config.api_endpoint + "/agents";
config.blobs_endpoint = config.api_endpoint + "/blobs";
config.messages_endpoint = config.api_endpoint + "/messages";
config.principals_endpoint = config.api_endpoint + "/principals";
config.ops_endpoint = config.api_endpoint + "/ops";

// Security configuration parameters.  Make sure you know what you are doing before changing 
// any of these parameters.

config.password_hash_iterations = 10000;
config.password_hash_length = 128;
config.device_secret_bytes = 128;
config.salt_length_bytes = 64;

config.access_token_bytes = 32;
config.access_token_lifetime = 14; // days

// # of days a message should live by default
config.default_message_lifetime = 365;

// when the token gets within 10% (default) of config.access_token_lifetime,
// refresh it with a new token via the response header.
config.refresh_token_threshold = 0.8;

// You can use Azure's Blob storage as a blob provider by uncommenting this configuration.
//
// if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
//    config.blob_provider = new providers.azure.AzureBlobProvider(config);
// }

config.blob_storage_path = './storage';
config.blob_provider = new providers.local.LocalBlobProvider(config);

// You can use Azure's Service Bus as a pubsub provider using this configuration.
//
// if (process.env.AZURE_SERVICEBUS_NAMESPACE && process.env.AZURE_SERVICEBUS_ACCESS_KEY) {
//    config.pubsub_provider = new providers.azure.AzurePubSubProvider(config);
// }

config.pubsub_provider = new providers.local.MemoryPubSubProvider(config);

config.request_log_format = ':remote-addr - - [:date] ":method :url HTTP/:http-version" :status :res[content-length] :response-time ":referrer" ":user-agent"';

// You can use Loggly's log service by uncommenting this lines and providing the appropriate 
// environmental variables
if (process.env.LOGGLY_SUBDOMAIN && 
    process.env.LOGGLY_INPUT_TOKEN && 
    process.env.LOGGLY_USERNAME && 
    process.env.LOGGLY_PASSWORD) {
    log.add(winston.transports.Loggly, {
        "subdomain": process.env.LOGGLY_SUBDOMAIN,
        "inputToken": process.env.LOGGLY_INPUT_TOKEN,
        "auth": {
            "username": process.env.LOGGLY_USERNAME,
            "password": process.env.LOGGLY_PASSWORD
        }
    });
}

log.add(winston.transports.Console, { colorize: true, timestamp: true });

// if you'd like additional indexes applied to messages, you can specify them here.
config.message_indexes = [
];

// Claim codes are what users use to claim devices they have added to the service when IP matching fails.
// Longer claim codes are more secure but less convienent for users.
config.claim_code_length = 8;

// run the janitor every minute
config.janitor_interval = 60 * 1000;

// Validate all message schemas to conform to all core and installed schemas.
config.validate_schemas = true;

config.default_permissions = [
    { principal: 'service', action: 'send', filter: { type: 'ip' }, authorized: true,  priority: 1000 },
    {                       action: 'send', filter: { type: 'ip' }, authorized: false, priority: 1001 },
    {                       action: 'send',                         authorized: true,  priority: 100001 }
//    {                      action: 'sub',                          authorized: false,  priority: 100002 }
];

module.exports = config;
